import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Auth & Role Guard ──────────────────────────────────────
async function checkAdminOrManager(userId: string) {
  const admin = createAdminClient()
  const { data: emp } = await admin
    .from('employees')
    .select('id, role, department_id, department')
    .eq('id', userId)
    .maybeSingle()

  if (!emp) return { authorized: false, isDepartmentManager: false, employee: null }

  const isDGM = emp.role === 'admin' || emp.role === 'dgm' || emp.role === 'gm' || emp.role === 'registrar'
  const isDepartmentManager = emp.role === 'manager' || emp.department_id === 'contract'

  return {
    authorized: isDGM || isDepartmentManager,
    isDGM,
    isDepartmentManager: !isDGM && isDepartmentManager,
    employee: emp,
  }
}

// ── Colour Palette (AARRGGBB — ExcelJS ARGB format) ─────────
const C = {
  NAVY_BG:   'FF1E3A8A', // #1E3A8A corporate header fill
  NAVY_FG:   'FFFFFFFF',
  SLATE_BG:  'FFE2E8F0', // #E2E8F0 column header fill
  SLATE_HDR: 'FF475569',
  BLACK_FG:  'FF111827',
  GRAY_FG:   'FF475569',
  MUTED_FG:  'FF64748B',
  BAND_A:    'FFFFFFFF',
  BAND_B:    'FFF8FAFC',
  MARGIN_BG: 'FFFFFFFF',
  
  // Status Badge Fills
  APPROVED_BG: 'FFF0FDF4', APPROVED_FG: 'FF166534',
  PENDING_BG:  'FFFEF3C7', PENDING_FG:  'FF92400E',
  RETURNED_BG: 'FFFEE2E2', RETURNED_FG: 'FF991B1B',
  NEUTRAL_BG:  'FFF3F4F6', NEUTRAL_FG:  'FF374151',

  // Summary Row Fills
  SUMMARY_BG:  'FFEFF6FF', SUMMARY_FG:  'FF1E3A8A',

  THIN: { style: 'thin'   as const },
  MED:  { style: 'medium' as const },
  DBL:  { style: 'double' as const },
}

// ── Helper Utilities ───────────────────────────────────────
function sf(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function ab(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}

function mb(cell: ExcelJS.Cell) {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}

function applyStatusPill(cell: ExcelJS.Cell, bg: string, fg: string) {
  cell.fill = sf(bg)
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fg } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  ab(cell)
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s
}

/** 
 * Safely compute working hours for a log entry.
 *
 * Priority order:
 *   1. Manager-verified actual_working_hour  (explicit override — highest priority)
 *   2. Manager-verified hours_worked         (secondary override)
 *   3. Punch-card duration derived from entrance/leave times (minus 1h lunch for >5h shifts)
 *   4. Standard shift default (Saturday = 4h, weekday = 8h)
 */
function getCalculatedHours(log: any): number {
  const isSaturday = log.log_date ? new Date(log.log_date).getDay() === 6 : false

  // 1. Manager-set actual_working_hour takes highest priority
  const actualH = log.actual_working_hour != null ? Number(log.actual_working_hour) : NaN
  if (!isNaN(actualH) && actualH > 0) {
    return actualH
  }

  // 2. Manager-set hours_worked as secondary override
  const workedH = log.hours_worked != null ? Number(log.hours_worked) : NaN
  if (!isNaN(workedH) && workedH > 0) {
    return workedH
  }

  // 3. Derive from entrance/leave punch times with 1h lunch deduction for shifts > 5h
  if (log.office_entrance_time && log.office_leave_time) {
    try {
      const inParts  = String(log.office_entrance_time).split(':').map(Number)
      const outParts = String(log.office_leave_time).split(':').map(Number)
      if (inParts.length >= 2 && outParts.length >= 2 && !isNaN(inParts[0]) && !isNaN(outParts[0])) {
        const inMins  = inParts[0]  * 60 + (inParts[1]  || 0)
        const outMins = outParts[0] * 60 + (outParts[1] || 0)
        let diffMin   = outMins - inMins
        if (diffMin > 0) {
          if (diffMin > 300) diffMin -= 60 // 1 hour lunch break deduction
          return Math.round((diffMin / 60) * 100) / 100
        }
      }
    } catch {
      // fall through to default
    }
  }

  // 4. Standard shift default
  return isSaturday ? 4.0 : 8.0
}

/** Today formatted as YYYY-MM-DD */
function todayISOString(): string {
  return new Date().toISOString().split('T')[0]
}

/** Auto-fit column widths based on cell content */
function measureColumnWidths(
  ws: ExcelJS.Worksheet,
  headers: string[],
  dataStartRow: number,
  dataEndRow: number,
) {
  headers.forEach((h, idx) => {
    const colIdx = idx + 1
    const col = ws.getColumn(colIdx)
    let maxLen = h.length + 4

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      const cell = ws.getRow(r).getCell(colIdx)
      const val = cell.value
      if (val === null || val === undefined) continue
      let len = 0
      if (typeof val === 'object' && 'formula' in val) {
        len = 12
      } else {
        len = String(val).length
      }
      if (len > maxLen) maxLen = len
    }

    col.width = Math.min(Math.max(maxLen + 2, 12), 50)
  })
}

// ── GET Handler ─────────────────────────────────────────────
export async function GET(_req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { authorized, isDepartmentManager, employee: requester } = await checkAdminOrManager(user.id)

    if (!authorized || !requester) {
      return NextResponse.json({ error: 'Permission denied. Admin, DGM, or Manager access required.' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Fetch all logs paginating past Supabase 1000-row limit
    const PAGE_SIZE = 1000
    let rawLogs: any[] = []
    let page = 0

    while (true) {
      const { data: pageData, error } = await admin
        .from('daily_work_logs')
        .select(
          '*, employees(full_name, email, department, role, department_id), ' +
          'daily_work_log_reviews(approval_status, head_comments, reviewed_at, reviewed_by)'
        )
        .order('log_date', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) {
        console.error('[export-work-logs] DB fetch error:', error.message)
        return NextResponse.json({ error: 'Failed to retrieve daily work logs.' }, { status: 500 })
      }

      rawLogs = rawLogs.concat(pageData ?? [])
      if (!pageData || pageData.length < PAGE_SIZE) break
      page++
    }

    // If requester is a department manager, scope logs to their department
    if (isDepartmentManager) {
      const targetDeptId = requester.department_id
      const targetDeptName = requester.department
      rawLogs = rawLogs.filter((log: any) => {
        const empDeptId = log.employees?.department_id
        const empDeptName = log.employees?.department
        const matchId = targetDeptId && empDeptId && empDeptId.toLowerCase() === targetDeptId.toLowerCase()
        const matchName = targetDeptName && empDeptName && empDeptName.toLowerCase() === targetDeptName.toLowerCase()
        return matchId || matchName
      })
    }

    // 1. Flatten latest review onto each log
    const allEnrichedLogs = rawLogs.map((log: any) => {
      const reviews: any[] = log.daily_work_log_reviews ?? []
      const latestReview = reviews.sort(
        (a: any, b: any) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
      )[0]

      const status = latestReview?.approval_status ?? 'Pending'
      const baseCalcHours = getCalculatedHours(log)
      const isReturnedOrRejected = status === 'Returned' || status === 'Rejected'

      return {
        ...log,
        daily_work_log_reviews: undefined,
        approval_status: status,
        head_comments:   latestReview?.head_comments   ?? null,
        reviewed_at:     latestReview?.reviewed_at     ?? null,
        // Returned / Rejected logs do NOT count towards calculated working hours
        calc_hours:      isReturnedOrRejected ? 0 : baseCalcHours,
      }
    })

    // 2. Deduplicate resubmission pairs (per employee per log_date):
    // Identify all employee_id + log_date combinations that have a non-Returned/non-Rejected row
    const activeKeysWithNonReturned = new Set<string>()
    allEnrichedLogs.forEach((log: any) => {
      const isReturnedOrRejected = log.approval_status === 'Returned' || log.approval_status === 'Rejected'
      if (!isReturnedOrRejected && log.employee_id && log.log_date) {
        activeKeysWithNonReturned.add(`${log.employee_id}_${log.log_date}`)
      }
    })

    // Suppress old Returned/Rejected rows if a non-Returned row exists for the same employee + log_date
    const logs = allEnrichedLogs
      .filter((log: any) => {
        const isReturnedOrRejected = log.approval_status === 'Returned' || log.approval_status === 'Rejected'
        if (!isReturnedOrRejected) return true
        const key = `${log.employee_id}_${log.log_date}`
        return !activeKeysWithNonReturned.has(key)
      })
      .sort((a: any, b: any) => {
        // Sort by date DESC then employee name ASC
        const dateCmp = (b.log_date ?? '').localeCompare(a.log_date ?? '')
        if (dateCmp !== 0) return dateCmp
        const na = (a.employees?.full_name ?? '').toLowerCase()
        const nb = (b.employees?.full_name ?? '').toLowerCase()
        return na.localeCompare(nb)
      })

    // Calculate Summary Metrics for KPI Bar
    const totalLogsCount = logs.length
    const approvedCount = logs.filter((l: any) => l.approval_status === 'Approved').length
    const pendingCount = logs.filter((l: any) => l.approval_status === 'Pending').length
    const returnedCount = logs.filter((l: any) => l.approval_status === 'Returned' || l.approval_status === 'Rejected').length
    const grandTotalHours = logs.reduce((sum: number, l: any) => sum + (l.calc_hours || 0), 0)

    // Build Excel Workbook
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'EF Architects & Engineers Consulting PLC'
    wb.created  = new Date()
    wb.modified = new Date()

    const ws = wb.addWorksheet('Daily Work Logs')
    ws.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 5 }]

    const headers = [
      'S/N',
      'Log Date',
      'Day of Week',
      'Employee Name',
      'Email',
      'Department',
      'Biometric In',
      'Biometric Out',
      'Calculated Working Hours',
      'Assigned Tasks / Description',
      'Actual Work Done',
      '% Progress Complete',
      'Done At Home?',
      'Approval Status',
      'Supervisor Comments',
      'Employee Remarks',
    ]

    const lastColLetter = colLetter(headers.length)

    // ── ROW 1: Banner Header ─────────────────────────────────
    ws.mergeCells(`A1:${lastColLetter}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = 'EF Architects & Engineers Consulting — Master Executive Daily Work Logs & Attendance Ledger'
    titleCell.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
    titleCell.fill  = sf(C.NAVY_BG)
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(1).height = 38

    // ── ROW 2: Spacer ────────────────────────────────────────
    ws.mergeCells(`A2:${lastColLetter}2`)
    ws.getCell('A2').fill = sf('FFF1F5F9')
    ws.getRow(2).height   = 6

    // ── ROW 3: Metadata Bar ──────────────────────────────────
    ws.getRow(3).height = 22
    ws.mergeCells(`A3:H3`)
    const metaLeft = ws.getCell('A3')
    metaLeft.value = `Prepared By: ${requester.department || 'Executive Office'} (${requester.role.toUpperCase()})`
    metaLeft.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: C.GRAY_FG } }
    metaLeft.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    metaLeft.fill  = sf('FFF8FAFC')

    ws.mergeCells(`I3:${lastColLetter}3`)
    const metaRight = ws.getCell('I3')
    metaRight.value = `Report As of Date: ${todayISOString()}`
    metaRight.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
    metaRight.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
    metaRight.fill  = sf('FFF8FAFC')

    // ── ROW 4: KPI Bar ───────────────────────────────────────
    ws.getRow(4).height = 26
    const kpiDefs = [
      { label: 'Total Logs Recorded', value: totalLogsCount, bg: C.NAVY_BG, fg: C.NAVY_FG },
      { label: 'Total Hours Worked', value: `${grandTotalHours.toFixed(2)} hrs`, bg: 'FF0F766E', fg: C.NAVY_FG },
      { label: '🟢 Approved Logs', value: approvedCount, bg: 'FF166534', fg: C.NAVY_FG },
      { label: '🟡 Pending Review', value: pendingCount, bg: 'FFB45309', fg: C.NAVY_FG },
      { label: '🔴 Returned / Rejected', value: returnedCount, bg: 'FF991B1B', fg: C.NAVY_FG },
    ]

    const colSpan = Math.floor(headers.length / kpiDefs.length)
    kpiDefs.forEach((k, i) => {
      const startCol = i * colSpan + 1
      const endCol = i === kpiDefs.length - 1 ? headers.length : (i + 1) * colSpan
      const startL = colLetter(startCol)
      const endL = colLetter(endCol)
      if (startCol !== endCol) ws.mergeCells(`${startL}4:${endL}4`)
      const cell = ws.getCell(`${startL}4`)
      cell.value = `${k.label}: ${k.value}`
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: k.fg } }
      cell.fill = sf(k.bg)
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      mb(cell)
    })

    // ── ROW 5: Column Headers ────────────────────────────────
    ws.getRow(5).height = 28
    headers.forEach((h, idx) => {
      const cell = ws.getRow(5).getCell(idx + 1)
      cell.value = h
      cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.BLACK_FG } }
      cell.fill  = sf(C.SLATE_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
    })

    // ── ROWS 6+: Data Rows ───────────────────────────────────
    const DATA_START_ROW = 6
    logs.forEach((log: any, idx: number) => {
      const rowNum = DATA_START_ROW + idx
      const row = ws.getRow(rowNum)
      row.height = 20
      const band = idx % 2 === 0 ? C.BAND_A : C.BAND_B

      const emp = log.employees ?? {}
      const pctVal = log.completion_percentage != null ? parseFloat(String(log.completion_percentage)) : null

      const rowValues: [number, any, 'left' | 'center' | 'right', boolean][] = [
        [1,  idx + 1,                                       'center', false],
        [2,  log.log_date                             ?? '—', 'center', false],
        [3,  log.day_of_week                          ?? '—', 'center', false],
        [4,  emp.full_name                            ?? '—', 'left',   false],
        [5,  emp.email                                ?? '—', 'left',   false],
        [6,  emp.department                           ?? '—', 'left',   false],
        [7,  log.office_entrance_time                 ?? '—', 'center', false],
        [8,  log.office_leave_time                    ?? '—', 'center', false],
        [9,  log.calc_hours,                                  'right',  false], // Column I = Calculated Working Hours
        [10, log.assigned_tasks                       ?? '—', 'left',   true],
        [11, log.actual_work_done                     ?? '—', 'left',   true],
        [12, pctVal !== null ? pctVal : '—',                  'right',  false],
        [13, log.done_at_home ? 'Yes' : 'No',                 'center', false],
        [14, log.approval_status                      ?? 'Pending', 'center', false],
        [15, log.head_comments                        ?? '—', 'left',   true],
        [16, log.remark                               ?? '—', 'left',   true],
      ]

      rowValues.forEach(([colIdx, value, align, wrap]) => {
        const cell = row.getCell(colIdx)
        cell.value = value
        cell.font = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        cell.fill = sf(band)
        cell.alignment = {
          vertical: 'middle',
          horizontal: align,
          wrapText: wrap,
          indent: align === 'left' ? 1 : 0,
        }
        ab(cell)
      })

      // Column Number Formats
      row.getCell(2).numFmt = 'yyyy-mm-dd'
      row.getCell(9).numFmt = '0.00' // Hours formatted float
      if (pctVal !== null) {
        row.getCell(12).numFmt = '0%'
      }

      // Status Pill Formatting (Col 14)
      const statusCell = row.getCell(14)
      const st = String(log.approval_status)
      if (st === 'Approved') {
        applyStatusPill(statusCell, C.APPROVED_BG, C.APPROVED_FG)
      } else if (st === 'Returned' || st === 'Rejected') {
        applyStatusPill(statusCell, C.RETURNED_BG, C.RETURNED_FG)
      } else {
        applyStatusPill(statusCell, C.PENDING_BG, C.PENDING_FG)
      }
    })

    // ── SUMMARY FOOTER BLOCK ─────────────────────────────────
    const dataEndRow = DATA_START_ROW + Math.max(logs.length - 1, 0)
    const footerStartRow = dataEndRow + 2

    if (logs.length > 0) {
      // Row 1: Total Operational Hours Worked
      const totalRow = ws.getRow(footerStartRow)
      totalRow.height = 22

      ws.mergeCells(`A${footerStartRow}:H${footerStartRow}`)
      const labelHours = totalRow.getCell(1)
      labelHours.value = 'Total Operational Working Hours (Calculated & Manager Verified):'
      labelHours.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.SUMMARY_FG } }
      labelHours.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }

      const sumHoursCell = totalRow.getCell(9) // Col 9 = Calculated Working Hours
      sumHoursCell.value = { formula: `SUM(I${DATA_START_ROW}:I${dataEndRow})` }
      sumHoursCell.numFmt = '0.00'
      sumHoursCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.SUMMARY_FG } }
      sumHoursCell.fill = sf(C.SUMMARY_BG)
      sumHoursCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
      sumHoursCell.border = { top: C.MED, bottom: C.DBL, left: C.THIN, right: C.THIN }

      // Row 2: Average Completion Rate
      const avgRow = ws.getRow(footerStartRow + 1)
      avgRow.height = 22

      ws.mergeCells(`A${footerStartRow + 1}:K${footerStartRow + 1}`)
      const labelAvg = avgRow.getCell(1)
      labelAvg.value = 'Average Daily Task Progress Completion Rate:'
      labelAvg.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.SUMMARY_FG } }
      labelAvg.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }

      const avgPctCell = avgRow.getCell(12) // Col 12 = % Progress Complete
      avgPctCell.value = { formula: `AVERAGE(L${DATA_START_ROW}:L${dataEndRow})` }
      avgPctCell.numFmt = '0.0%'
      avgPctCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.SUMMARY_FG } }
      avgPctCell.fill = sf(C.SUMMARY_BG)
      avgPctCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
      avgPctCell.border = { top: C.MED, bottom: C.DBL, left: C.THIN, right: C.THIN }
    } else {
      // Empty state
      ws.mergeCells(`A${DATA_START_ROW}:${lastColLetter}${DATA_START_ROW}`)
      const emptyCell = ws.getCell(`A${DATA_START_ROW}`)
      emptyCell.value = 'No daily work log records found matching your department criteria.'
      emptyCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: C.MUTED_FG } }
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' }
      ws.getRow(DATA_START_ROW).height = 28
    }

    // Auto Column Widths
    measureColumnWidths(ws, headers, DATA_START_ROW, dataEndRow)

    // Stream Buffer Output
    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    const fileDate = todayISOString().replace(/-/g, '')
    const filename = `Daily_Work_Logs_Ledger_${fileDate}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[export-work-logs] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Unexpected server error generating daily work logs export.' },
      { status: 500 },
    )
  }
}
