import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/daily-work-logs/review
 *
 * Allows admin / dgm to record an approval decision for one or more submitted
 * log rows WITHOUT mutating the original immutable daily_work_logs records.
 *
 * Body (JSON):
 * {
 *   reviews: Array<{
 *     log_id: number        // ID of the daily_work_logs row being reviewed
 *     approval_status: 'Approved' | 'Returned' | 'Pending'
 *     head_comments?: string
 *   }>
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify reviewer is admin, dgm, or manager
    const { data: reviewer } = await admin
      .from('employees')
      .select('id, role, department_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!reviewer || (reviewer.role !== 'admin' && reviewer.role !== 'dgm' && reviewer.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Permission denied. Only admin, DGM, or managers can record approval decisions.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const reviews: Array<{
      log_id: number
      approval_status: 'Approved' | 'Returned' | 'Pending'
      head_comments?: string
      hours_worked?: number
      actual_working_hour?: number
      office_entrance_time?: string
      office_leave_time?: string
    }> = body.reviews

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'No review entries provided.' }, { status: 400 })
    }

    const validStatuses = ['Approved', 'Returned', 'Pending']
    const reviewRecords = []

    for (const rev of reviews) {
      if (!rev.log_id || typeof rev.log_id !== 'number') {
        return NextResponse.json(
          { error: 'Each review entry must include a numeric log_id.' },
          { status: 400 },
        )
      }
      if (!validStatuses.includes(rev.approval_status)) {
        return NextResponse.json(
          { error: `Invalid approval_status "${rev.approval_status}".` },
          { status: 400 },
        )
      }

      // Verify the referenced log exists and load the employee's department
      const { data: logRow } = await admin
        .from('daily_work_logs')
        .select('id, employee_id, employees(department_id)')
        .eq('id', rev.log_id)
        .maybeSingle()

      if (!logRow) {
        return NextResponse.json(
          { error: `Log row with id=${rev.log_id} not found.` },
          { status: 404 },
        )
      }

      // Enforce department limit for managers
      if (reviewer.role === 'manager') {
        const employeeDeptId = (logRow.employees as any)?.department_id
        if (employeeDeptId !== reviewer.department_id) {
          return NextResponse.json(
            { error: `Permission denied. Managers can only approve timesheets within their own department.` },
            { status: 403 },
          )
        }
      }

      // If manager updated working hours or entrance/leave times, patch the daily_work_logs table record
      if (
        typeof rev.hours_worked === 'number' ||
        typeof rev.actual_working_hour === 'number' ||
        rev.office_entrance_time ||
        rev.office_leave_time
      ) {
        const logUpdates: Record<string, any> = {}
        if (typeof rev.hours_worked === 'number') logUpdates.hours_worked = rev.hours_worked
        if (typeof rev.actual_working_hour === 'number') logUpdates.actual_working_hour = rev.actual_working_hour
        if (rev.office_entrance_time) logUpdates.office_entrance_time = rev.office_entrance_time
        if (rev.office_leave_time) logUpdates.office_leave_time = rev.office_leave_time
        
        await admin
          .from('daily_work_logs')
          .update(logUpdates)
          .eq('id', rev.log_id)
      }

      reviewRecords.push({
        log_id: rev.log_id,
        reviewed_by: reviewer.id,
        approval_status: rev.approval_status,
        head_comments: rev.head_comments ? String(rev.head_comments).trim() : null,
      })
    }

    const { data: insertedReviews, error: insertError } = await admin
      .from('daily_work_log_reviews')
      .insert(reviewRecords)
      .select()

    if (insertError) {
      console.error('[daily-work-logs/review] insert error:', insertError.message)
      return NextResponse.json(
        { error: 'Failed to record reviews: ' + insertError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      count: insertedReviews?.length ?? 0,
      reviews: insertedReviews,
    })
  } catch (err) {
    console.error('[daily-work-logs/review] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
