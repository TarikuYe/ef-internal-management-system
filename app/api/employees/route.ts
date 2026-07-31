import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string, userEmail: string, allowRegistrar = false) {
  // Fast-path: DGM_EMAIL env var match (covers first login before DB row exists)
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) {
    return true
  }
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role, department_id')
    .eq('id', userId)
    .maybeSingle()
  if (allowRegistrar) {
    return (
      employee?.role === 'admin' ||
      employee?.role === 'dgm' ||
      employee?.role === 'registrar' ||
      employee?.role === 'manager'   // any dept manager
    )
  }
  return (
    employee?.role === 'admin' ||
    employee?.role === 'dgm' ||
    employee?.role === 'manager'     // any dept manager
  )
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────
export async function GET(_request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email, true)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    // Determine caller's role — scope results to their own department for managers/registrar
    const admin = createAdminClient()
    const { data: caller } = await admin
      .from('employees')
      .select('role, department_id')
      .eq('id', user.id)
      .maybeSingle()

    // True cross-dept roles see everyone; managers and registrar are scoped to their own dept
    const isScopedRole =
      caller?.role === 'registrar' || caller?.role === 'manager'

    let query = admin
      .from('employees')
      .select('*')
      .not('role', 'eq', 'admin')
      .order('created_at', { ascending: true })

    if (isScopedRole && caller?.department_id) {
      query = query.eq('department_id', caller.department_id)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.log('[employees] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to load employees.' }, { status: 500 })
    }

    // Enrich with active status from Auth ban state
    let bannedIds = new Set<string>()
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const now = new Date()
      bannedIds = new Set(
        (authList?.users ?? [])
          .filter(u => u.banned_until && new Date(u.banned_until) > now)
          .map(u => u.id)
      )
    } catch (authErr) {
      console.log('[employees] Auth list warning:', authErr instanceof Error ? authErr.message : String(authErr))
    }

    const enriched = (profiles ?? []).map(p => ({
      ...p,
      active: !bannedIds.has(p.id),
    }))

    return NextResponse.json({ employees: enriched })
  } catch (err) {
    console.log('[employees] GET unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// POST /api/employees  — create new employee account (admin only)
// ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const isExec = ['dgm', 'gm'].includes(String(body.role ?? '').trim())
    const departmentId = isExec ? null : (String(body.department_id ?? '').trim() || 'contract')
    const role = String(body.role ?? '').trim() || 'employee'

    // Map department_id slug → ef_department enum value
    const DEPT_ENUM_MAP: Record<string, string> = {
      'contract':    'contract_admin',
      'design':      'design',
      'office-eng':  'office_engineering',
      'procurement': 'procurement',
      'supervision': 'supervision',
    }
    // Accept a pre-resolved enum value from the client, or derive it from department_id
    const rawDeptEnum = String(body.department ?? '').trim()
    const departmentEnum = isExec
      ? null
      : (rawDeptEnum || DEPT_ENUM_MAP[departmentId ?? ''] || departmentId || null)

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const tempPassword = generateTempPassword()
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: `An account with email "${email}" already exists.` },
          { status: 409 },
        )
      }
      console.log('[employees] createUser error:', authError.message)
      return NextResponse.json({ error: 'Failed to create user account.' }, { status: 500 })
    }

    const newUserId = authData.user.id

    const { data: profile, error: profileError } = await admin
      .from('employees')
      .insert({
        id: newUserId,
        full_name: fullName,
        email,
        department_id: departmentId,
        department: departmentEnum,
        role: role,
      })
      .select()
      .single()

    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId)
      console.log('[employees] profile insert error:', profileError.message)
      return NextResponse.json({ error: 'Failed to create employee profile.' }, { status: 500 })
    }

    return NextResponse.json(
      { employee: { ...profile, employee_project_assignments: [] }, temp_password: tempPassword },
      { status: 201 },
    )
  } catch (err) {
    console.log('[employees] POST unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// PATCH /api/employees  — update profile or active status (admin only)
// ─────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email, true)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()

    if (typeof body.active === 'boolean') {
      if (body.active === false) {
        await admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })
      } else {
        await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
      }
      if (body.full_name === undefined && body.department_id === undefined && body.department === undefined && body.role === undefined) {
        return NextResponse.json({ employee: { id, active: body.active } })
      }
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim()
    }
    const deptId: string | null | undefined =
      body.department_id !== undefined ? (String(body.department_id).trim() || null)
      : undefined

    if (deptId !== undefined) {
      updates.department_id = deptId

      // Also update the ef_department enum column to keep both in sync
      const DEPT_ENUM_MAP: Record<string, string> = {
        'contract':    'contract_admin',
        'design':      'design',
        'office-eng':  'office_engineering',
        'procurement': 'procurement',
        'supervision': 'supervision',
      }
      // Use client-provided enum value if given, otherwise derive from department_id
      const rawEnum = typeof body.department === 'string' ? body.department.trim() : ''
      updates.department = deptId === null ? null : (rawEnum || DEPT_ENUM_MAP[deptId] || deptId)
    }
    if (typeof body.role === 'string') {
      updates.role = body.role.trim() || 'employee'
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    // Use the safe RPC that disables triggers for this transaction.
    // This prevents the broken sync trigger from writing a display-name string
    // into the ef_department enum column (which would cause a 500).
    const { data, error } = await admin.rpc('patch_employee_safe', {
      p_id:            id,
      p_full_name:     (updates.full_name as string)     ?? null,
      p_department_id: (updates.department_id as string) ?? null,
      p_role:          (updates.role as string)          ?? null,
    }).select().single()

    if (error) {
      console.log('[employees] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update employee.' }, { status: 500 })
    }

    return NextResponse.json({ employee: data })
  } catch (err) {
    console.log('[employees] PATCH unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// DELETE /api/employees  — permanently remove employee (admin/dgm only)
// ─────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })
    }

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Use a SECURITY DEFINER Postgres function that temporarily disables the
    // lock_submitted_tasks trigger (which blocks even service-role deletes)
    // then removes all child rows before deleting the employee profile.
    const { error: rpcError } = await admin.rpc('admin_delete_employee', { target_id: id })

    if (rpcError) {
      console.log('[employees] DELETE rpc error:', rpcError.message, rpcError.code)
      return NextResponse.json({ error: `Failed to delete employee: ${rpcError.message}` }, { status: 500 })
    }

    // ── Delete the Supabase Auth user (profile row already gone via RPC) ──
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) {
      // Profile is gone; auth cleanup failure is non-fatal
      console.log('[employees] DELETE auth user error:', authError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('[employees] DELETE unexpected:', msg)
    return NextResponse.json({ error: `Unexpected server error: ${msg}` }, { status: 500 })
  }
}
