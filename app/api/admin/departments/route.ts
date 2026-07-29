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
 * GET /api/admin/departments
 * Returns all departments from the departments table merged with member counts.
 * Falls back to deriving from employee records if departments table is missing.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const admin = createAdminClient()

    // Try the canonical departments table first
    const { data: deptRows, error: deptErr } = await admin
      .from('departments')
      .select('id, name, description')
      .order('name', { ascending: true })

    const { data: employees } = await admin.from('employees').select('department_id')

    if (!deptErr && deptRows) {
      const countMap = new Map<string, number>()
      for (const emp of employees ?? []) {
        if (emp.department_id) countMap.set(emp.department_id, (countMap.get(emp.department_id) ?? 0) + 1)
      }
      const departments = deptRows.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description ?? '',
        count: countMap.get(d.id) ?? 0,
      }))
      return NextResponse.json({ departments })
    }

    // Fallback: derive from employee records (pre-migration schema)
    const { data: empsFallback, error: fallbackErr } = await admin
      .from('employees')
      .select('id, department, department_id')
      .not('department', 'is', null)

    if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 })

    const deptMap = new Map<string, { name: string; id: string | null; count: number }>()
    for (const emp of empsFallback ?? []) {
      const name = (emp.department as string).trim()
      if (!name) continue
      const existing = deptMap.get(name)
      if (existing) { existing.count++ } else {
        deptMap.set(name, { name, id: emp.department_id ?? null, count: 1 })
      }
    }
    const departments = [...deptMap.values()].sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ departments })
  } catch (err) {
    console.error('[admin/departments] GET error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/departments
 * Creates a new department.
 * Body: { name: string, description?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const description = String(body.description ?? '').trim()

    if (!name) return NextResponse.json({ error: 'Department name is required.' }, { status: 400 })

    // Auto-generate a slug ID from the name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)

    if (!id) return NextResponse.json({ error: 'Could not generate a valid ID from the name.' }, { status: 400 })

    const admin = createAdminClient()

    // Check for duplicate
    const { data: existing } = await admin.from('departments').select('id').eq('id', id).maybeSingle()
    if (existing) return NextResponse.json({ error: `A department with slug "${id}" already exists. Use a different name.` }, { status: 409 })

    const { data: dept, error } = await admin
      .from('departments')
      .insert({ id, name, description: description || null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ department: { ...dept, count: 0 } }, { status: 201 })
  } catch (err) {
    console.error('[admin/departments] POST error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/departments
 * Updates a department name/description by id, syncing all employee records.
 * Body: { id: string, name: string, description?: string }
 * Legacy: { old_name: string, new_name: string }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const admin = createAdminClient()

    // New schema: update by id
    if (body.id) {
      const id = String(body.id).trim()
      const name = String(body.name ?? '').trim()
      const description = body.description !== undefined ? String(body.description).trim() : undefined

      if (!name) return NextResponse.json({ error: 'Department name is required.' }, { status: 400 })

      const updatePayload: Record<string, string | null> = { name }
      if (description !== undefined) updatePayload.description = description || null

      const { data: dept, error } = await admin
        .from('departments')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Sync department display name on all employees in this dept
      await admin.from('employees').update({ department: name }).eq('department_id', id)

      return NextResponse.json({ department: dept })
    }

    // Legacy schema: rename by old_name across employees
    const oldName = String(body.old_name ?? '').trim()
    const newName = String(body.new_name ?? '').trim()

    if (!oldName || !newName)
      return NextResponse.json({ error: 'Both old_name and new_name are required.' }, { status: 400 })
    if (oldName === newName)
      return NextResponse.json({ error: 'New name must be different from old name.' }, { status: 400 })

    const { count, error } = await (admin
      .from('employees')
      .update({ department: newName })
      .eq('department', oldName) as any)
      .select('*', { count: 'exact', head: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, updated: count ?? 0 })
  } catch (err) {
    console.error('[admin/departments] PATCH error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/departments
 * Removes a department. Blocked if any employees are still assigned to it.
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const id = String(body.id ?? '').trim()
    if (!id) return NextResponse.json({ error: 'Department id is required.' }, { status: 400 })

    const admin = createAdminClient()

    // Safety check: block deletion if members exist
    const { count } = await admin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} employee${count !== 1 ? 's are' : ' is'} still assigned to this department. Reassign them first.` },
        { status: 409 },
      )
    }

    const { error } = await admin.from('departments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/departments] DELETE error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
