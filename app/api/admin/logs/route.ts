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
 * GET /api/admin/logs
 * Returns recent auth events from Supabase Auth admin API.
 * Falls back to a synthetic activity log built from employee + submission data.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

    const admin = createAdminClient()
    const logs: {
      id: string
      ts: string
      type: string
      actor: string
      detail: string
      level: 'info' | 'warn' | 'error'
    }[] = []

    // Pull recent Auth users (last sign-in acts as an activity signal)
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: limit })
      const now = new Date()
      for (const u of authList?.users ?? []) {
        if (u.last_sign_in_at) {
          logs.push({
            id: `auth-signin-${u.id}`,
            ts: u.last_sign_in_at,
            type: 'auth.sign_in',
            actor: u.email ?? u.id,
            detail: 'User signed in',
            level: 'info',
          })
        }
        if (u.created_at) {
          logs.push({
            id: `auth-created-${u.id}`,
            ts: u.created_at,
            type: 'auth.user_created',
            actor: u.email ?? u.id,
            detail: 'Account created',
            level: 'info',
          })
        }
        const isBanned = u.banned_until && new Date(u.banned_until) > now
        if (isBanned) {
          logs.push({
            id: `auth-banned-${u.id}`,
            ts: u.updated_at ?? u.created_at,
            type: 'admin.user_disabled',
            actor: u.email ?? u.id,
            detail: 'Account disabled by admin',
            level: 'warn',
          })
        }
      }
    } catch (_) { /* non-fatal */ }

    // Pull recent submissions as activity
    try {
      const { data: subs } = await admin
        .from('report_submissions')
        .select('id, employee_email, submitted_at, status, project_code')
        .order('submitted_at', { ascending: false })
        .limit(50)
      for (const s of subs ?? []) {
        logs.push({
          id: `sub-${s.id}`,
          ts: s.submitted_at,
          type: 'report.submitted',
          actor: s.employee_email,
          detail: `Report submitted — ${s.project_code} (${s.status})`,
          level: 'info',
        })
      }
    } catch (_) { /* non-fatal */ }

    // Sort descending by timestamp
    logs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    return NextResponse.json({ logs: logs.slice(0, limit) })
  } catch (err) {
    console.error('[admin/logs] error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
