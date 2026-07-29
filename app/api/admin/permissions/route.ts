import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// All valid roles in the system
export const VALID_ROLES = ['admin', 'registrar', 'dgm', 'gm', 'manager', 'employee'] as const
export type Role = typeof VALID_ROLES[number]

// Role → capabilities mapping (static definition)
export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  admin: [
    'manage_users', 'disable_users', 'reset_passwords', 'manage_departments',
    'view_logs', 'manage_email_settings', 'manage_permissions',
    'view_submissions', 'manage_submissions', 'manage_projects',
    'view_employees', 'manage_employees', 'view_analytics',
    'export_reports', 'database_backup',
  ],
  dgm: [
    'view_submissions', 'manage_submissions', 'manage_projects',
    'view_employees', 'manage_employees', 'view_analytics',
    'export_reports', 'manage_users', 'disable_users', 'reset_passwords',
  ],
  gm: [
    'view_submissions', 'view_employees', 'view_analytics',
    'manage_submissions', 'manage_projects', 'export_reports',
  ],
  registrar: [
    'view_submissions', 'manage_submissions', 'view_employees',
    'manage_employees', 'export_reports',
  ],
  manager: [
    'view_submissions', 'manage_submissions', 'view_employees', 'export_reports',
  ],
  employee: [
    'submit_reports', 'view_own_submissions',
  ],
}

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
 * GET /api/admin/permissions
 * Returns the role→capabilities matrix and current employee role distribution.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const admin = createAdminClient()

    // Role distribution
    const { data: employees } = await admin
      .from('employees')
      .select('id, full_name, email, role')
      .order('full_name')

    const distribution: Record<string, number> = {}
    for (const role of VALID_ROLES) distribution[role] = 0
    for (const emp of employees ?? []) {
      const r = emp.role as Role
      if (r in distribution) distribution[r]++
      else distribution[r] = (distribution[r] ?? 0) + 1
    }

    return NextResponse.json({
      roles: VALID_ROLES,
      capabilities: ROLE_CAPABILITIES,
      distribution,
      employees: (employees ?? []).map((e) => ({ id: e.id, full_name: e.full_name, email: e.email, role: e.role })),
    })
  } catch (err) {
    console.error('[admin/permissions] GET error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/permissions
 * Updates a single employee's role.
 * Body: { id: string, role: Role }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const id = String(body.id ?? '').trim()
    const role = String(body.role ?? '').trim() as Role

    if (!id) return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })
    if (!VALID_ROLES.includes(role))
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })

    // Prevent self-demotion from admin
    if (id === user.id && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('employees')
      .update({ role })
      .eq('id', id)
      .select('id, full_name, email, role')
      .single()

    if (error) {
      console.error('[admin/permissions] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update role.' }, { status: 500 })
    }

    return NextResponse.json({ employee: data })
  } catch (err) {
    console.error('[admin/permissions] PATCH error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
