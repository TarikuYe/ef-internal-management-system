import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getEmployee(userId: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('employees')
    .select('id, full_name, email, role, department_id, active')
    .eq('id', userId)
    .maybeSingle()
  return existing
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const currentEmp = await getEmployee(user.id)
    if (!currentEmp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('department_id') || currentEmp.department_id

    const admin = createAdminClient()
    
    // If manager/admin/dgm, they see all tasks for the department.
    // If employee, they only see tasks where their ID is in assigned_to array.
    let query = admin.from('weekly_tasks').select('*').order('created_at', { ascending: false })

    if (currentEmp.role === 'employee') {
      // Fetch all tasks for the department, then filter in JS to avoid Supabase JSONB contains issues
      query = query
        .eq('department_id', currentEmp.department_id)
    } else {
      // Managers see all tasks for the requested department
      if (departmentId) {
        query = query.eq('department_id', departmentId)
      }
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('[weekly-tasks] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve weekly tasks' }, { status: 500 })
    }

    let filteredTasks = tasks || []
    if (currentEmp.role === 'employee') {
      filteredTasks = filteredTasks.filter((t: any) => 
        Array.isArray(t.assigned_to) && t.assigned_to.includes(currentEmp.id)
      )
    }

    return NextResponse.json({ tasks: filteredTasks })
  } catch (err) {
    console.error('[weekly-tasks] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const currentEmp = await getEmployee(user.id)
    if (!currentEmp || !['admin', 'dgm', 'manager'].includes(currentEmp.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      task_code, 
      discipline, 
      task_description, 
      priority, 
      start_date, 
      end_date,
      deadline,
      assigned_to, 
      status, 
      remarks,
      department_id
    } = body

    if (!task_description) {
      return NextResponse.json({ error: 'Task description is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const finalDepartmentId = (['admin', 'dgm'].includes(currentEmp.role) && department_id) ? department_id : currentEmp.department_id

    const { data: task, error } = await admin.from('weekly_tasks').insert({
      department_id: finalDepartmentId,
      task_code: task_code || null,
      discipline: discipline || null,
      task_description,
      priority: priority || 'Medium',
      start_date: start_date || null,
      end_date: end_date || null,
      deadline: deadline || null,
      assigned_to: Array.isArray(assigned_to) ? assigned_to : [],
      status: status || 'Active',
      remarks: remarks || null
    }).select().single()

    if (error) {
      console.error('[weekly-tasks] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task })
  } catch (err) {
    console.error('[weekly-tasks] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const currentEmp = await getEmployee(user.id)
    if (!currentEmp || !['admin', 'dgm', 'manager'].includes(currentEmp.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })

    const admin = createAdminClient()
    
    // Prevent changing department ID across tenants unless admin
    if (updates.department_id && currentEmp.role === 'manager' && updates.department_id !== currentEmp.department_id) {
      delete updates.department_id
    }

    updates.updated_at = new Date().toISOString()

    const { data: task, error } = await admin
      .from('weekly_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[weekly-tasks] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task })
  } catch (err) {
    console.error('[weekly-tasks] PATCH unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const currentEmp = await getEmployee(user.id)
    if (!currentEmp || !['admin', 'dgm', 'manager'].includes(currentEmp.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })

    const admin = createAdminClient()
    
    // Check if task belongs to manager's department
    if (currentEmp.role === 'manager') {
      const { data: existing } = await admin.from('weekly_tasks').select('department_id').eq('id', id).maybeSingle()
      if (existing && existing.department_id !== currentEmp.department_id) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
      }
    }

    const { error } = await admin.from('weekly_tasks').delete().eq('id', id)

    if (error) {
      console.error('[weekly-tasks] DELETE error:', error.message)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[weekly-tasks] DELETE unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
