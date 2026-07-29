import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin(userId: string, userEmail: string) {
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) return true
  const admin = createAdminClient()
  const { data } = await admin.from('employees').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin' || data?.role === 'dgm'
}

/**
 * GET /api/admin/health
 * Returns server and database health metrics.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const admin = createAdminClient()
    const checks: Record<string, { status: 'ok' | 'degraded' | 'error'; latencyMs?: number; detail?: string }> = {}

    // DB ping
    const dbStart = Date.now()
    try {
      const { error } = await admin.from('employees').select('id').limit(1)
      checks.database = {
        status: error ? 'error' : 'ok',
        latencyMs: Date.now() - dbStart,
        detail: error ? error.message : 'Reachable',
      }
    } catch (e) {
      checks.database = { status: 'error', latencyMs: Date.now() - dbStart, detail: String(e) }
    }

    // Auth service ping
    const authStart = Date.now()
    try {
      const { error } = await admin.auth.admin.listUsers({ perPage: 1 })
      checks.auth = {
        status: error ? 'degraded' : 'ok',
        latencyMs: Date.now() - authStart,
        detail: error ? error.message : 'Reachable',
      }
    } catch (e) {
      checks.auth = { status: 'error', latencyMs: Date.now() - authStart, detail: String(e) }
    }

    // Storage ping
    const storageStart = Date.now()
    try {
      const { error } = await admin.storage.listBuckets()
      checks.storage = {
        status: error ? 'degraded' : 'ok',
        latencyMs: Date.now() - storageStart,
        detail: error ? error.message : 'Reachable',
      }
    } catch (e) {
      checks.storage = { status: 'error', latencyMs: Date.now() - storageStart, detail: String(e) }
    }

    // Table row counts — map logical keys to actual Supabase table names
    const tableMap: Record<string, string> = {
      employees:        'employees',
      report_submissions: 'report_submissions',
      bonds:            'project_bonds',
      correspondence:   'correspondence_register',
      eot_claims:       'eot_tracker',
      evaluations:      'performance_evaluations',
    }
    const counts: Record<string, number> = {}
    await Promise.allSettled(
      Object.entries(tableMap).map(async ([key, table]) => {
        const { count } = await admin.from(table).select('*', { count: 'exact', head: true })
        counts[key] = count ?? 0
      }),
    )

    // Auth user count (Total Users = all auth accounts)
    // Active Staff = non-admin/dgm employees who are not currently banned
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const allAuthUsers = authList?.users ?? []
      counts.auth_users = allAuthUsers.length

      // Build set of banned auth IDs
      const now = new Date()
      const bannedIds = new Set(
        allAuthUsers
          .filter(u => u.banned_until && new Date(u.banned_until) > now)
          .map(u => u.id)
      )

      // Active staff = employees table rows that are NOT admin/DGM AND NOT banned
      const { data: staffRows } = await admin
        .from('employees')
        .select('id, role')
        .not('role', 'in', '("admin","gm","dgm")')
      counts.employees = (staffRows ?? []).filter(r => !bannedIds.has(r.id)).length
    } catch (_) {
      counts.auth_users = 0
      // fallback: employees count already set from tableMap above
    }

    const overall = Object.values(checks).some((c) => c.status === 'error')
      ? 'error'
      : Object.values(checks).some((c) => c.status === 'degraded')
      ? 'degraded'
      : 'ok'

    return NextResponse.json({
      status: overall,
      checkedAt: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      checks,
      counts,
    })
  } catch (err) {
    console.error('[admin/health] error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
