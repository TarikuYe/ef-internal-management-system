import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROJECTS } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkProjectsWriteAccess(userId: string, email: string) {
  if (process.env.DGM_EMAIL && email.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()) {
    return true
  }
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role, department_id')
    .eq('id', userId)
    .maybeSingle()
  return (
    employee?.role === 'admin' ||
    employee?.role === 'dgm' ||
    employee?.role === 'registrar' ||
    (employee?.role === 'manager' && employee?.department_id === 'contract')
  )
}

// ─────────────────────────────────────────
// GET /api/projects
// ?all=1   → include archived (admin use only)
// ?mine=1  → only projects assigned to the current user
// ─────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === '1'
    const mineOnly = searchParams.get('mine') === '1'

    const admin = createAdminClient()

    if (mineOnly) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.id) {
        return NextResponse.json({ projects: [] })
      }

      const { data: assignments } = await admin
        .from('employee_project_assignments')
        .select('project_code')
        .eq('employee_id', user.id)

      let assignedCodes: string[] = (assignments ?? []).map((a: { project_code: string }) => a.project_code)

      if (assignedCodes.length === 0 && user.email) {
        const { data: empProfile } = await admin
          .from('employees')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .maybeSingle()

        if (empProfile?.id && empProfile.id !== user.id) {
          const { data: altAssignments } = await admin
            .from('employee_project_assignments')
            .select('project_code')
            .eq('employee_id', empProfile.id)

          if (altAssignments && altAssignments.length > 0) {
            assignedCodes = altAssignments.map((a: { project_code: string }) => a.project_code)
          }
        }
      }

      if (assignedCodes.length === 0) {
        return NextResponse.json({ projects: [] })
      }

      const { data: projects, error } = await admin
        .from('projects')
        .select('*')
        .in('code', assignedCodes)
        .eq('active', true)
        .order('created_at', { ascending: true })

      if (error) {
        console.log('[projects] mine GET error:', error.message)
        return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 })
      }

      return NextResponse.json({ projects: projects ?? [] })
    }

    let query = admin.from('projects').select('*').order('created_at', { ascending: true })
    if (!showAll) query = query.eq('active', true)

    const { data, error } = await query

    if (error) {
      // Table may not exist yet — fall back to static list
      console.log('[projects] GET error (fallback):', error.message)
      return NextResponse.json({ projects: PROJECTS })
    }

    // Return whatever the DB has — empty is a valid state
    return NextResponse.json({ projects: data ?? [] })
  } catch (err) {
    console.log('[projects] GET unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ projects: [] })
  }
}

// ─────────────────────────────────────────
// POST /api/projects  — create a new project (admin only)
// ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkProjectsWriteAccess(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or Contract Manager access required.' }, { status: 403 })
    }

    const body = await request.json()
    const code = String(body.code ?? '').trim().toUpperCase()
    const name = String(body.name ?? '').trim()

    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .insert({ code, name, active: true })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Project code "${code}" already exists.` }, { status: 409 })
      }
      console.log('[projects] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (err) {
    console.log('[projects] POST unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// PATCH /api/projects  — update a project (admin, contract manager, or assigned employee)
// ─────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch current project to check code assignment
    const { data: project } = await admin
      .from('projects')
      .select('code')
      .eq('id', id)
      .maybeSingle()

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const hasAccess = await checkProjectsWriteAccess(user.id, user.email)
    let isAssignedEmployee = false

    if (!hasAccess) {
      const { data: empProfile } = await admin
        .from('employees')
        .select('role, department_id')
        .eq('id', user.id)
        .maybeSingle()

      if (empProfile && empProfile.department_id === 'contract') {
        const { data: assignment } = await admin
          .from('employee_project_assignments')
          .select('project_code')
          .eq('employee_id', user.id)
          .eq('project_code', project.code)
          .maybeSingle()

        if (assignment) {
          isAssignedEmployee = true
        }
      }
    }

    if (!hasAccess && !isAssignedEmployee) {
      return NextResponse.json({ error: 'Permission denied. Admin, Contract Manager, or assigned employee role required.' }, { status: 403 })
    }

    // Limit fields employee can update
    const updatesToApply = { ...updates }
    if (isAssignedEmployee) {
      delete updatesToApply.code
      delete updatesToApply.name
      delete updatesToApply.client
      delete updatesToApply.contractor
      delete updatesToApply.start_date
      delete updatesToApply.estimated_completion
      delete updatesToApply.priority
    }

    const { data, error } = await admin
      .from('projects')
      .update(updatesToApply)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.log('[projects] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
    }

    return NextResponse.json({ project: data })
  } catch (err) {
    console.log('[projects] PATCH unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// DELETE /api/projects  — delete a project (admin only)
// ─────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkProjectsWriteAccess(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or Contract Manager access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '').trim()

    if (!id) {
      return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('projects').delete().eq('id', id)

    if (error) {
      console.log('[projects] DELETE error:', error.message)
      return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.log('[projects] DELETE unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
