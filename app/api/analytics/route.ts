import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminAccess(userId: string, userEmail: string) {
  // Fast path: DGM_EMAIL env var — same pattern used across all other routes
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) {
    return true
  }
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'dgm' || employee?.role === 'gm' || employee?.role === 'admin'
}

// GET /api/analytics
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminAccess(user.id, user.email ?? '')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin, DGM, or GM access required.' }, { status: 403 })
    }

    const admin = createAdminClient()
    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Letters metrics & overdue list
    const { data: letters, error: lettersError } = await admin
      .from('correspondence_register')
      .select('*')
      .order('date_logged', { ascending: false })

    if (lettersError) {
      console.error('[analytics] letters fetch error:', lettersError.message)
      return NextResponse.json({ error: 'Failed to retrieve correspondence analytics.' }, { status: 500 })
    }

    let totalLetters = letters?.length ?? 0
    let overdueLetters = 0
    const overdueLettersList: any[] = []

    for (const letter of letters ?? []) {
      if (letter.response_required && !letter.response_sent_date) {
        if (letter.response_due_date && letter.response_due_date < todayStr) {
          overdueLetters++
          overdueLettersList.push(letter)
        }
      }
    }

    // 2. Bonds metrics & Critical expired alerts
    const { data: bonds, error: bondsError } = await admin
      .from('project_bonds')
      .select('*')
      .order('expiry_date', { ascending: true })

    if (bondsError) {
      console.error('[analytics] bonds fetch error:', bondsError.message)
      return NextResponse.json({ error: 'Failed to retrieve bonds analytics.' }, { status: 500 })
    }

    let activeBonds = 0
    let expiredOrReleasedBonds = 0
    const criticalExpiredBonds: any[] = []

    for (const bond of bonds ?? []) {
      const expDate = new Date(bond.expiry_date)
      expDate.setHours(0, 0, 0, 0)
      
      const diffTime = expDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (bond.status === 'Released') {
        expiredOrReleasedBonds++
      } else if (daysRemaining <= 0) {
        expiredOrReleasedBonds++
        criticalExpiredBonds.push({
          ...bond,
          days_overdue: Math.abs(daysRemaining)
        })
      } else {
        activeBonds++
      }
    }

    // 3. EOT tracker & EOT analytics
    const { data: eots, error: eotsError } = await admin
      .from('eot_tracker')
      .select('*')
      .order('revised_completion_date', { ascending: true })

    if (eotsError) {
      console.error('[analytics] EOT fetch error:', eotsError.message)
      return NextResponse.json({ error: 'Failed to retrieve EOT analytics.' }, { status: 500 })
    }

    const nearlyExpiredEots: any[] = []
    let totalEotClaims = eots?.length ?? 0
    let totalApprovedEotDays = 0
    let pendingEotCount = 0
    let approvedEotCount = 0
    let expiredEotCount = 0
    let expiringSoonEotCount = 0

    const processedEots = (eots ?? []).map(eot => {
      const compDate = new Date(eot.revised_completion_date)
      compDate.setHours(0, 0, 0, 0)

      const diffTime = compDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let alertStatus = 'Safe'
      if (daysRemaining <= 0) {
        alertStatus = 'Expired'
        expiredEotCount++
      } else if (daysRemaining <= 30) {
        alertStatus = 'Expiring Soon'
        expiringSoonEotCount++
        nearlyExpiredEots.push({
          ...eot,
          days_remaining: daysRemaining
        })
      }

      if ((eot.status ?? '').toLowerCase() === 'approved') {
        approvedEotCount++
        totalApprovedEotDays += Number(eot.days_approved || 0)
      } else if ((eot.status ?? '').toLowerCase() === 'pending') {
        pendingEotCount++
      }

      return {
        ...eot,
        alertStatus,
        days_remaining: daysRemaining
      }
    })

    // 4. Fetch daily work logs with reviews and employee info
    const { data: rawLogs, error: logsError } = await admin
      .from('daily_work_logs')
      .select('*, employees(full_name, email, department, department_id, role), daily_work_log_reviews(approval_status, head_comments, reviewed_at)')
      .order('log_date', { ascending: false })

    if (logsError) {
      console.error('[analytics] logs fetch error:', logsError.message)
    }

    // Process reviews and filter for Approved logs (manager-approved results)
    const approvedLogs: any[] = []
    let totalCommitmentPercentage = 0

    const departmentMap: Record<string, {
      id: string
      name: string
      approvedLogsCount: number
      totalHours: number
      onsiteHours: number
      totalCommitment: number
      employeesSet: Set<string>
    }> = {
      'contract': {
        id: 'contract',
        name: 'Contract & Procurement Admin',
        approvedLogsCount: 0,
        totalHours: 0,
        onsiteHours: 0,
        totalCommitment: 0,
        employeesSet: new Set()
      },
      'design': {
        id: 'design',
        name: 'Design Department',
        approvedLogsCount: 0,
        totalHours: 0,
        onsiteHours: 0,
        totalCommitment: 0,
        employeesSet: new Set()
      },
      'office-eng': {
        id: 'office-eng',
        name: 'Office Engineering',
        approvedLogsCount: 0,
        totalHours: 0,
        onsiteHours: 0,
        totalCommitment: 0,
        employeesSet: new Set()
      },
      'supervision': {
        id: 'supervision',
        name: 'Supervision Department',
        approvedLogsCount: 0,
        totalHours: 0,
        onsiteHours: 0,
        totalCommitment: 0,
        employeesSet: new Set()
      }
    }

    for (const log of rawLogs ?? []) {
      const reviews: any[] = log.daily_work_log_reviews ?? []
      const latestReview = reviews.sort(
        (a: any, b: any) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
      )[0]

      const approvalStatus = latestReview?.approval_status ?? log.approval_status ?? 'Pending'
      const headComments = latestReview?.head_comments ?? log.head_comments ?? null

      if (approvalStatus === 'Approved') {
        const approvedLogItem = {
          ...log,
          daily_work_log_reviews: undefined,
          approval_status: 'Approved',
          head_comments: headComments
        }
        approvedLogs.push(approvedLogItem)

        const compPct = Number(log.completion_percentage || 0)
        totalCommitmentPercentage += compPct

        // Group into departments (contract + procurement under Contract & Procurement Admin)
        const empDeptId = (log.employees?.department_id ?? '').toLowerCase()
        const empDeptName = (log.employees?.department ?? '').toLowerCase()

        let deptKey = 'contract'
        if (empDeptId === 'design' || empDeptName.includes('design')) {
          deptKey = 'design'
        } else if (empDeptId === 'office-eng' || empDeptId === 'office_eng' || empDeptName.includes('office')) {
          deptKey = 'office-eng'
        } else if (empDeptId === 'supervision' || empDeptName.includes('supervision')) {
          deptKey = 'supervision'
        }

        if (departmentMap[deptKey]) {
          const deptObj = departmentMap[deptKey]
          deptObj.approvedLogsCount += 1
          deptObj.totalHours += Number(log.hours_worked || 0)
          deptObj.onsiteHours += Number(log.actual_working_hour || 0)
          deptObj.totalCommitment += compPct
          if (log.employees?.email) {
            deptObj.employeesSet.add(log.employees.email)
          }
        }
      }
    }

    const commitmentAverage = approvedLogs.length > 0
      ? (totalCommitmentPercentage / approvedLogs.length) * 100
      : 0

    const departmentStats = Object.values(departmentMap).map(d => ({
      id: d.id,
      name: d.name,
      approvedLogsCount: d.approvedLogsCount,
      totalHours: Math.round(d.totalHours * 10) / 10,
      onsiteHours: Math.round(d.onsiteHours * 10) / 10,
      avgCommitment: d.approvedLogsCount > 0 ? Math.round((d.totalCommitment / d.approvedLogsCount) * 1000) / 10 : 0,
      activeEmployeesCount: d.employeesSet.size
    }))

    return NextResponse.json({
      metrics: {
        totalLetters,
        overdueLetters,
        activeBonds,
        expiredOrReleasedBonds,
        commitmentAverage: Math.round(commitmentAverage * 10) / 10,
        totalApprovedLogs: approvedLogs.length,
        totalEotClaims,
        totalApprovedEotDays
      },
      departmentStats,
      eotAnalytics: {
        totalClaims: totalEotClaims,
        approvedDays: totalApprovedEotDays,
        pendingCount: pendingEotCount,
        approvedCount: approvedEotCount,
        expiredCount: expiredEotCount,
        expiringSoonCount: expiringSoonEotCount,
        eots: processedEots
      },
      approvedLogs,
      alerts: {
        criticalExpiredBonds,
        nearlyExpiredEots,
        overdueLettersList
      }
    })
  } catch (err) {
    console.error('[analytics] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
