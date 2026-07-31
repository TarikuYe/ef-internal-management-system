'use client'
import React, { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Users,
  FolderKanban,
  FileStack,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Layers,
  Calendar,
  Award,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  RotateCw,
  UserCircle,
  Mail,
  Clock,
  Inbox,
  BarChart2,
  PencilRuler,
  Ruler,
  Hammer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserProfile } from '@/components/user-profile'
import { createClient } from '@/lib/supabase/client'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    console.error(`[DesignManagerWorkspace] API error ${res.status} for ${url}:`, json?.error)
    return json
  }
  return json
}

type Tab = 'dashboard' | 'weekly-plan' | 'timesheets' | 'projects' | 'evaluations' | 'exports' | 'profile' | 'analytics'

function calcHoursFromTime(entrance: string, leave: string, isSaturday: boolean): number {
  if (!entrance || !leave) return isSaturday ? 4 : 8
  const [eH, eM] = entrance.split(':').map(Number)
  const [lH, lM] = leave.split(':').map(Number)
  if (isNaN(eH) || isNaN(lH)) return isSaturday ? 4 : 8
  const startMin = eH * 60 + (eM || 0)
  const endMin = lH * 60 + (lM || 0)
  let diffMin = endMin - startMin
  if (diffMin <= 0) return isSaturday ? 4 : 8
  if (diffMin > 300) diffMin -= 60
  return Math.round((diffMin / 60) * 10) / 10
}

export function DesignManagerWorkspace({
  userId,
  userEmail,
  userName,
  userDepartment,
  userDepartmentId,
  userRole,
  initialTab = 'dashboard',
}: {
  userId: string
  userEmail: string
  userName: string
  userDepartment: string
  userDepartmentId: string
  userRole: string
  initialTab?: Tab
}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // SWR data queries
  const { data: employeesData, mutate: mutateEmployees } = useSWR<{ employees: any[] }>('/api/employees', fetcher)
  const { data: projectsData, mutate: mutateProjects } = useSWR<{ projects: any[] }>('/api/projects?all=1', fetcher)
  const { data: evalsData, mutate: mutateEvals } = useSWR('/api/evaluations', fetcher)
  const { data: pendingLogsData, mutate: mutatePendingLogs } = useSWR<{ logs: any[] }>(
    '/api/daily-work-logs?pending=true',
    fetcher,
    { refreshInterval: 3_000 }
  )
  const { data: weeklyTasksData, mutate: mutateWeeklyTasks } = useSWR<{ tasks: any[] }>(
    `/api/weekly-tasks?department_id=${userDepartmentId}`,
    fetcher
  )

  // Real-time listener for pending daily work logs
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('design-mgr-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_work_logs' }, () => mutatePendingLogs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_work_log_reviews' }, () => mutatePendingLogs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mutatePendingLogs])

  const employees = useMemo(
    () => {
      const all = employeesData?.employees ?? []
      return all.filter((e: any) => {
        // Strip cross-dept executive roles
        if (e.role === 'admin' || e.role === 'dgm' || e.role === 'gm') return false
        // For admin/dgm callers who see all employees, still scope to this dept
        // For manager callers the API already scopes, but this is a safety net
        if (userRole === 'admin' || userRole === 'dgm') {
          return e.department_id === userDepartmentId
        }
        return true // API already scoped — trust it
      })
    },
    [employeesData, userDepartmentId, userRole]
  )
  const projects = projectsData?.projects ?? []
  const evaluations = evalsData?.evaluations ?? []
  const pendingLogs = pendingLogsData?.logs ?? []
  const weeklyTasks = weeklyTasksData?.tasks ?? []

  const handleRefresh = async (mutateFn: () => Promise<any>, name: string) => {
    const id = toast.loading(`Refreshing ${name}...`)
    try { await mutateFn(); toast.dismiss(id); toast.success(`${name} refreshed`) }
    catch { toast.dismiss(id); toast.error(`Failed to refresh ${name}`) }
  }

  // Timesheet review state
  const [submittingReview, setSubmittingReview] = useState(false)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [logEditsMap, setLogEditsMap] = useState<Record<number, {
    hours_worked: number; actual_working_hour: number
    office_entrance_time: string; office_leave_time: string; head_comments: string
  }>>({})

  // Group pending logs by employee
  const groupedTimesheets = useMemo(() => {
    const map = new Map<string, {
      employeeId: string; employeeName: string; employeeEmail: string; employeeRole: string
      logs: any[]; totalLogs: number; totalHours: number; totalOnsiteHours: number
      startDate: string; endDate: string
    }>()
    pendingLogs.forEach((log: any) => {
      const empId = log.employee_id || log.employees?.id || 'unknown'
      const empName = log.employees?.full_name || log.employees?.email?.split('@')[0] || 'Employee'
      if (!map.has(empId)) {
        map.set(empId, { employeeId: empId, employeeName: empName,
          employeeEmail: log.employees?.email || '', employeeRole: log.employees?.role || 'employee',
          logs: [], totalLogs: 0, totalHours: 0, totalOnsiteHours: 0,
          startDate: log.log_date, endDate: log.log_date })
      }
      const item = map.get(empId)!
      item.logs.push(log); item.totalLogs += 1
      item.totalHours += Number(log.hours_worked || 0)
      item.totalOnsiteHours += Number(log.actual_working_hour || 0)
      if (log.log_date < item.startDate) item.startDate = log.log_date
      if (log.log_date > item.endDate) item.endDate = log.log_date
    })
    map.forEach(g => g.logs.sort((a, b) => a.log_date.localeCompare(b.log_date)))
    return Array.from(map.values())
  }, [pendingLogs])

  const handleToggleExpand = (empId: string, logs: any[]) => {
    if (expandedEmployeeId === empId) { setExpandedEmployeeId(null); return }
    setExpandedEmployeeId(empId)
    const init: typeof logEditsMap = {}
    logs.forEach(l => {
      const isSat = l.log_date ? new Date(l.log_date).getDay() === 6 : false
      const dH = isSat ? 4 : 8
      const entrance = l.office_entrance_time ? l.office_entrance_time.substring(0, 5) : '08:30'
      const leave = l.office_leave_time ? l.office_leave_time.substring(0, 5) : (isSat ? '12:30' : '17:30')
      const hw = l.hours_worked > 0 ? Number(l.hours_worked) : (l.actual_working_hour > 0 ? Number(l.actual_working_hour) : dH)
      init[l.id] = { hours_worked: hw, actual_working_hour: l.actual_working_hour > 0 ? Number(l.actual_working_hour) : hw,
        office_entrance_time: entrance, office_leave_time: leave, head_comments: l.head_comments || '' }
    })
    setLogEditsMap(init)
  }

  const handleLogEditChange = (logId: number, field: keyof typeof logEditsMap[number], value: any) => {
    setLogEditsMap(prev => {
      const ex = prev[logId] ?? { hours_worked: 8, actual_working_hour: 8, office_entrance_time: '08:30', office_leave_time: '17:30', head_comments: '' }
      const upd = { ...ex, [field]: value }
      if (field === 'office_entrance_time' || field === 'office_leave_time') {
        const h = calcHoursFromTime(upd.office_entrance_time, upd.office_leave_time, false)
        upd.hours_worked = h; upd.actual_working_hour = h
      }
      return { ...prev, [logId]: upd }
    })
  }

  const handleApproveSingleLog = async (logId: number) => {
    const edits = logEditsMap[logId]
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: [{ log_id: logId, approval_status: 'Approved',
          head_comments: edits?.head_comments || null,
          hours_worked: Number(edits?.hours_worked ?? 8), actual_working_hour: Number(edits?.actual_working_hour ?? 8),
          office_entrance_time: edits?.office_entrance_time, office_leave_time: edits?.office_leave_time }] })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Approval failed.')
      toast.success('Work log approved'); mutatePendingLogs()
    } catch (err: any) { toast.error(err.message || 'Approval failed') }
    finally { setSubmittingReview(false) }
  }

  const handleReturnSingleLog = async (logId: number) => {
    const edits = logEditsMap[logId]
    if (!edits?.head_comments?.trim()) { toast.error('Comment required', { description: 'Add a comment before returning.' }); return }
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: [{ log_id: logId, approval_status: 'Returned',
          head_comments: edits.head_comments, hours_worked: Number(edits?.hours_worked ?? 8),
          actual_working_hour: Number(edits?.actual_working_hour ?? 8),
          office_entrance_time: edits?.office_entrance_time, office_leave_time: edits?.office_leave_time }] })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Return failed.')
      toast.success('Work log returned'); mutatePendingLogs()
    } catch (err: any) { toast.error(err.message || 'Return failed') }
    finally { setSubmittingReview(false) }
  }

  const handleApproveAllForGroup = async (group: any) => {
    setSubmittingReview(true)
    try {
      const reviews = group.logs.map((log: any) => {
        const edits = logEditsMap[log.id]
        return { log_id: log.id, approval_status: 'Approved',
          head_comments: edits?.head_comments || null,
          hours_worked: Number(edits?.hours_worked ?? log.hours_worked ?? 8),
          actual_working_hour: Number(edits?.actual_working_hour ?? log.actual_working_hour ?? 8),
          office_entrance_time: edits?.office_entrance_time, office_leave_time: edits?.office_leave_time }
      })
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Bulk approval failed.')
      toast.success(`Approved all ${group.totalLogs} logs for ${group.employeeName}`)
      setExpandedEmployeeId(null); mutatePendingLogs()
    } catch (err: any) { toast.error(err.message || 'Bulk approval failed') }
    finally { setSubmittingReview(false) }
  }

  // Project management state
  const [projectCode, setProjectCode] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectClient, setProjectClient] = useState('')
  const [projectContractor, setProjectContractor] = useState('')
  const [projectStart, setProjectStart] = useState('')
  const [projectEnd, setProjectEnd] = useState('')
  const [projectPriority, setProjectPriority] = useState('Medium')
  const [projectStatus, setProjectStatus] = useState('Active')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const [selectedAssignEmployeeId, setSelectedAssignEmployeeId] = useState('')
  const [selectedAssignProjectCode, setSelectedAssignProjectCode] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Weekly Task form state
  const [wtCode, setWtCode] = useState('')
  const [wtDiscipline, setWtDiscipline] = useState('')
  const [wtDesc, setWtDesc] = useState('')
  const [wtStart, setWtStart] = useState('')
  const [wtEnd, setWtEnd] = useState('')
  const [wtDeadline, setWtDeadline] = useState('')
  const [wtPriority, setWtPriority] = useState('Medium')
  const [wtAssignedTo, setWtAssignedTo] = useState<string[]>([])
  const [wtStatus, setWtStatus] = useState('Active')
  const [wtRemarks, setWtRemarks] = useState('')
  const [editingWeeklyTaskId, setEditingWeeklyTaskId] = useState<string | null>(null)
  const [showWeeklyTaskForm, setShowWeeklyTaskForm] = useState(false)
  const [savingWeeklyTask, setSavingWeeklyTask] = useState(false)

  const handleWeeklyTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingWeeklyTask(true)
    const method = editingWeeklyTaskId ? 'PATCH' : 'POST'
    const payload: any = {
      task_code: wtCode, discipline: wtDiscipline, task_description: wtDesc,
      priority: wtPriority, start_date: wtStart || null, end_date: wtEnd || null,
      deadline: wtDeadline || null, assigned_to: wtAssignedTo, status: wtStatus, remarks: wtRemarks
    }
    if (editingWeeklyTaskId) payload.id = editingWeeklyTaskId
    try {
      const res = await fetch('/api/weekly-tasks', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save weekly task.')
      toast.success(editingWeeklyTaskId ? 'Weekly task updated' : 'Weekly task created')
      clearWeeklyTaskForm(); mutateWeeklyTasks()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setSavingWeeklyTask(false) }
  }

  const clearWeeklyTaskForm = () => {
    setEditingWeeklyTaskId(null); setShowWeeklyTaskForm(!showWeeklyTaskForm)
    setWtCode(''); setWtDiscipline(''); setWtDesc(''); setWtStart(''); setWtEnd(''); setWtDeadline('')
    setWtPriority('Medium'); setWtAssignedTo([]); setWtStatus('Active'); setWtRemarks('')
  }

  const handleEditWeeklyTask = (t: any) => {
    setEditingWeeklyTaskId(t.id); setShowWeeklyTaskForm(true)
    setWtCode(t.task_code || ''); setWtDiscipline(t.discipline || ''); setWtDesc(t.task_description || '')
    setWtStart(t.start_date || ''); setWtEnd(t.end_date || ''); setWtDeadline(t.deadline || '')
    setWtPriority(t.priority || 'Medium'); setWtAssignedTo(t.assigned_to || [])
    setWtStatus(t.status || 'Active'); setWtRemarks(t.remarks || '')
  }

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingProject(true)
    const method = editingProjectId ? 'PATCH' : 'POST'
    const payload: any = { code: projectCode, name: projectName, client: projectClient,
      contractor: projectContractor, start_date: projectStart || null,
      estimated_completion: projectEnd || null, priority: projectPriority, status: projectStatus }
    if (editingProjectId) payload.id = editingProjectId
    try {
      const res = await fetch('/api/projects', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save project.')
      toast.success(editingProjectId ? 'Project updated' : 'Project registered')
      clearProjectForm(); mutateProjects()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setSavingProject(false) }
  }

  const clearProjectForm = () => {
    setEditingProjectId(null); setProjectCode(''); setProjectName(''); setProjectClient('')
    setProjectContractor(''); setProjectStart(''); setProjectEnd('')
    setProjectPriority('Medium'); setProjectStatus('Active')
  }

  const handleEditProject = (p: any) => {
    setEditingProjectId(p.id); setProjectCode(p.code); setProjectName(p.name)
    setProjectClient(p.client || ''); setProjectContractor(p.contractor || '')
    setProjectStart(p.start_date || ''); setProjectEnd(p.estimated_completion || '')
    setProjectPriority(p.priority || 'Medium'); setProjectStatus(p.status || 'Active')
  }

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignEmployeeId || !selectedAssignProjectCode) return
    setAssigning(true)
    try {
      const res = await fetch('/api/employees/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selectedAssignEmployeeId, project_code: selectedAssignProjectCode })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign.')
      toast.success('Employee assigned to project')
      setSelectedAssignEmployeeId(''); setSelectedAssignProjectCode(''); mutateEmployees()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setAssigning(false) }
  }

  // Evaluation form state
  const [evalEmployeeId, setEvalEmployeeId] = useState('')
  const [evalStart, setEvalStart] = useState('')
  const [evalEnd, setEvalEnd] = useState('')
  const [evalPeriodLabel, setEvalPeriodLabel] = useState('')
  const [techScore, setTechScore] = useState('80')
  const [prodScore, setProdScore] = useState('80')
  const [puncScore, setPuncScore] = useState('80')
  const [commScore, setCommScore] = useState('80')
  const [repScore, setRepScore] = useState('80')
  const [adaptScore, setAdaptScore] = useState('80')
  const [submittingEval, setSubmittingEval] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number | string; tab: string } | null>(null)

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evalEmployeeId || !evalStart || !evalEnd) { toast.error('Employee and dates are required'); return }
    setSubmittingEval(true)
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      employee_id: evalEmployeeId, evaluation_period_start: evalStart, evaluation_period_end: evalEnd,
      tech_competence_score: parseFloat(techScore) || 0, productivity_score: parseFloat(prodScore) || 0,
      punctuality_score: parseFloat(puncScore) || 0, communication_score: parseFloat(commScore) || 0,
      reporting_score: parseFloat(repScore) || 0, adaptability_score: parseFloat(adaptScore) || 0,
    }
    if (evalPeriodLabel) payload.period_label = evalPeriodLabel
    if (editId) payload.id = editId
    try {
      const res = await fetch('/api/evaluations', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.')
      toast.success(editId ? 'Review updated' : 'Performance review logged')
      clearEvalForm(); mutateEvals()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setSubmittingEval(false) }
  }

  const clearEvalForm = () => {
    setEditId(null); setEvalEmployeeId(''); setEvalStart(''); setEvalEnd(''); setEvalPeriodLabel('')
    setTechScore('80'); setProdScore('80'); setPuncScore('80'); setCommScore('80'); setRepScore('80'); setAdaptScore('80')
  }

  // Computed evaluation score preview
  const previewScore = useMemo(() => {
    const t = (parseFloat(techScore) || 0) * 0.40
    const p = (parseFloat(prodScore) || 0) * 0.30
    const pu = (parseFloat(puncScore) || 0) * 0.10
    const c = (parseFloat(commScore) || 0) * 0.05
    const r = (parseFloat(repScore) || 0) * 0.05
    const a = (parseFloat(adaptScore) || 0) * 0.10
    const total = t + p + pu + c + r + a
    const grade = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'NI'
    const level = total >= 90 ? 'Outstanding' : total >= 80 ? 'Very Good' : total >= 70 ? 'Good' : total >= 60 ? 'Satisfactory' : 'Needs Improvement'
    return { total: total.toFixed(2), grade, level }
  }, [techScore, prodScore, puncScore, commScore, repScore, adaptScore])

  const executeDeleteRecord = async (id: number | string, tab: string) => {
    const endpoints: any = { projects: '/api/projects', evaluations: '/api/evaluations' }
    const mutators: any = { projects: mutateProjects, evaluations: mutateEvals }
    const loadingId = toast.loading('Deleting...')
    try {
      const res = await fetch(endpoints[tab], { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete.')
      toast.dismiss(loadingId); toast.success('Record deleted'); mutators[tab]()
    } catch (err: any) { toast.dismiss(loadingId); toast.error(err.message || 'Delete failed') }
  }

  const handleExportDownload = async (endpoint: string, filename: string) => {
    const loadingId = toast.loading('Preparing export...')
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss(loadingId); toast.success('Report downloaded')
    } catch (err: any) { toast.dismiss(loadingId); toast.error(err?.message || 'Failed to export') }
  }

  // Dashboard stats
  const avgPerfScore = useMemo(() => {
    if (evaluations.length === 0) return 0
    return evaluations.reduce((s: number, e: any) => s + Number(e.total_score || 0), 0) / evaluations.length
  }, [evaluations])

  const projectStats = useMemo(() => {
    const total = projects.length || 1
    const active = projects.filter((p: any) => p.status === 'Active').length
    const onHold = projects.filter((p: any) => p.status === 'On Hold').length
    const completed = projects.filter((p: any) => p.status === 'Completed').length
    const highPriority = projects.filter((p: any) => p.priority === 'High').length
    const avgProgress = projects.length
      ? Math.round(projects.reduce((s: number, p: any) => s + Number(p.progress_percentage || 0), 0) / projects.length)
      : 0
    return { total, active, onHold, completed, highPriority, avgProgress }
  }, [projects])

  const evalStats = useMemo(() => {
    if (evaluations.length === 0) return { avg: 0, outstanding: 0, veryGood: 0, good: 0, satisfactory: 0, dimensions: [] }
    const avg = evaluations.reduce((s: number, e: any) => s + Number(e.total_score || 0), 0) / evaluations.length
    const outstanding = evaluations.filter((e: any) => e.performance_level === 'Outstanding').length
    const veryGood = evaluations.filter((e: any) => e.performance_level === 'Very Good').length
    const good = evaluations.filter((e: any) => e.performance_level === 'Good').length
    const satisfactory = evaluations.filter((e: any) => e.performance_level === 'Satisfactory').length
    const dimensions = [
      { label: 'Technical', key: 'tech_competence_score', weight: 40 },
      { label: 'Productivity', key: 'productivity_score', weight: 30 },
      { label: 'Punctuality', key: 'punctuality_score', weight: 10 },
      { label: 'Communication', key: 'communication_score', weight: 5 },
      { label: 'Reporting', key: 'reporting_score', weight: 5 },
      { label: 'Adaptability', key: 'adaptability_score', weight: 10 },
    ].map(dim => ({
      ...dim,
      avg: evaluations.length
        ? Math.round(evaluations.reduce((s: number, e: any) => s + Number(e[dim.key] || 0), 0) / evaluations.length)
        : 0
    }))
    return { avg, outstanding, veryGood, good, satisfactory, dimensions }
  }, [evaluations])

  const timesheetStats = useMemo(() => {
    const queueSize = pendingLogs.length
    const totalStaff = employees.length
    const totalHoursPending = Math.round(pendingLogs.reduce((s: number, l: any) => s + Number(l.hours_worked || 0), 0))
    return { queueSize, totalStaff, totalHoursPending }
  }, [pendingLogs, employees])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-blue-500/10 via-background to-background p-4 sm:p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-36 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <PencilRuler className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg sm:text-2xl font-extrabold text-foreground leading-tight">
                  Design Manager Control Tower
                </h1>
                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  {userRole}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Design Department &middot; Weekly Report &amp; Evaluation Center
              </p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
            <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border w-max sm:w-full sm:flex-wrap min-w-0">
              {([
                { id: 'dashboard', icon: <LayoutDashboard className="size-4" />, label: 'Dashboard' },
                { id: 'weekly-plan', icon: <Calendar className="size-4" />, label: 'Weekly Plan' },
                { id: 'timesheets', icon: <FileStack className="size-4" />, label: `Sheets (${pendingLogs.length})` },
                { id: 'projects', icon: <FolderKanban className="size-4" />, label: 'Projects' },
                { id: 'evaluations', icon: <Award className="size-4" />, label: 'Evaluations' },
                { id: 'exports', icon: <Download className="size-4" />, label: 'Export' },
                { id: 'analytics', icon: <BarChart2 className="size-4" />, label: 'Analytics' },
                { id: 'profile', icon: <UserCircle className="size-4" />, label: 'Profile' },
              ] as { id: Tab; icon: React.ReactNode; label: string }[]).map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                    activeTab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Pending Timesheets</CardTitle>
                <FileStack className="size-4.5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{pendingLogs.length}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Logs awaiting review</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Active Projects</CardTitle>
                <FolderKanban className="size-4.5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">{projectStats.active}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Design projects in progress</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">High Priority</CardTitle>
                <AlertTriangle className="size-4.5 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-500">{projectStats.highPriority}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Projects marked High priority</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Avg Performance</CardTitle>
                <Award className="size-4.5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">{avgPerfScore > 0 ? avgPerfScore.toFixed(1) : '—'}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Average evaluation score</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FolderKanban className="size-4.5 text-blue-500" />
                  Active Project Workload &amp; Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">No active projects logged.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Code</TableHead><TableHead>Project Name</TableHead>
                        <TableHead>Client</TableHead><TableHead>Progress</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {projects.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs font-bold">{p.code}</TableCell>
                            <TableCell className="text-xs font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs">{p.client || '—'}</TableCell>
                            <TableCell className="w-44">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-secondary h-2.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-500 h-full" style={{ width: `${p.progress_percentage || 0}%` }} />
                                </div>
                                <span className="text-xs font-bold font-mono">{Number(p.progress_percentage || 0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.priority === 'High' ? 'bg-rose-100 text-rose-800' : p.priority === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                              }`}>{p.priority || 'Medium'}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4.5 text-primary" />
                  Design Staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {employees.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6">No staff profiles found.</div>
                  ) : employees.map((emp: any) => (
                    <div key={emp.id} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{emp.full_name}</span>
                        <span className="text-muted-foreground text-[10px] uppercase">{emp.discipline || emp.role}</span>
                      </div>
                      <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: emp.active ? '100%' : '20%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* WEEKLY PLAN TAB */}
      {activeTab === 'weekly-plan' && (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="size-4.5 text-blue-500" />
                  Design Department Weekly Plan
                </CardTitle>
                <CardDescription>Plan tasks and assign them to employees for the upcoming week.</CardDescription>
              </div>
              <Button size="sm" onClick={() => clearWeeklyTaskForm()} className="h-8 gap-1.5 font-bold">
                <Plus className="size-3.5" /> Create Task
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {weeklyTasks.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  <Calendar className="size-10 mx-auto mb-3 text-muted-foreground/30" />
                  No weekly tasks planned yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full text-xs min-w-[800px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-24">Task ID</TableHead>
                        <TableHead className="w-32">Discipline</TableHead>
                        <TableHead className="w-64">Task Description</TableHead>
                        <TableHead className="w-24">Priority</TableHead>
                        <TableHead className="w-32">Start - End</TableHead>
                        <TableHead className="w-24">Deadline</TableHead>
                        <TableHead className="w-48">Assigned To</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyTasks.map((task: any) => (
                        <TableRow key={task.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono font-bold text-[11px]">{task.task_code || '—'}</TableCell>
                          <TableCell>{task.discipline || '—'}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={task.task_description}>
                            {task.task_description}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              task.priority === 'High' ? 'bg-rose-100 text-rose-800' : task.priority === 'Low' ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {task.priority || 'Medium'}
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {task.start_date || '—'} <br/> {task.end_date || '—'}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {task.deadline || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {task.assigned_to?.map((empId: string) => {
                                const emp = employees.find((e: any) => e.id === empId)
                                return emp ? (
                                  <span key={empId} className="inline-flex rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold truncate max-w-[100px]" title={emp.full_name}>
                                    {emp.full_name.split(' ')[0]}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              task.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : task.status === 'On Hold' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {task.status || 'Active'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-blue-600" onClick={() => handleEditWeeklyTask(task)}>
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-600" onClick={() => setDeleteConfirm({ id: task.id, tab: 'weeklyTasks' })}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form for Create/Edit Weekly Task */}
          {(editingWeeklyTaskId !== null || showWeeklyTaskForm) && (
            <Card className="border-blue-500/30 shadow-sm relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>{editingWeeklyTaskId ? 'Edit Weekly Task' : 'Create New Weekly Task'}</span>
                  <Button variant="ghost" size="sm" onClick={clearWeeklyTaskForm} className="h-6 text-xs text-muted-foreground">Cancel</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleWeeklyTaskSubmit} className="flex flex-col gap-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Task Code</Label>
                      <Input value={wtCode} onChange={e => setWtCode(e.target.value)} placeholder="e.g. BD/001" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Discipline</Label>
                      <Input value={wtDiscipline} onChange={e => setWtDiscipline(e.target.value)} placeholder="e.g. Architecture" className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Task Description *</Label>
                    <Input value={wtDesc} onChange={e => setWtDesc(e.target.value)} required placeholder="Describe the task..." className="h-8 text-xs" />
                  </div>

                  <div className="grid sm:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Start Date</Label>
                      <Input type="date" value={wtStart} onChange={e => setWtStart(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">End Date</Label>
                      <Input type="date" value={wtEnd} onChange={e => setWtEnd(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Deadline</Label>
                      <Input type="date" value={wtDeadline} onChange={e => setWtDeadline(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Priority</Label>
                      <Select value={wtPriority} onValueChange={setWtPriority}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High" className="text-xs">High</SelectItem>
                          <SelectItem value="Medium" className="text-xs">Medium</SelectItem>
                          <SelectItem value="Low" className="text-xs">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Assign To Employees</Label>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 border border-border rounded-lg p-3 max-h-40 overflow-y-auto bg-muted/20">
                      {employees.map((emp: any) => (
                        <label key={emp.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={wtAssignedTo.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) setWtAssignedTo([...wtAssignedTo, emp.id]);
                              else setWtAssignedTo(wtAssignedTo.filter(id => id !== emp.id));
                            }}
                            className="rounded border-border"
                          />
                          <span className="truncate">{emp.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Status</Label>
                      <Select value={wtStatus} onValueChange={setWtStatus}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active" className="text-xs">Active</SelectItem>
                          <SelectItem value="On Hold" className="text-xs">On Hold</SelectItem>
                          <SelectItem value="Completed" className="text-xs">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Remarks</Label>
                      <Input value={wtRemarks} onChange={e => setWtRemarks(e.target.value)} placeholder="Optional remarks..." className="h-8 text-xs" />
                    </div>
                  </div>

                  <Button type="submit" disabled={savingWeeklyTask} className="w-full sm:w-auto self-end h-8 text-xs font-bold gap-2">
                    {savingWeeklyTask ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    {editingWeeklyTaskId ? 'Save Changes' : 'Create Weekly Task'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TIMESHEETS TAB */}
      {activeTab === 'timesheets' && (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">Pending Design Team Timesheets ({groupedTimesheets.length} Staff)</CardTitle>
                  <CardDescription>Review weekly work logs grouped by design engineer. Each log includes task code, discipline, and deadline from the weekly report.</CardDescription>
                </div>
                {pendingLogs.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-500/20 w-max">
                    {pendingLogs.length} Total Pending Logs
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {groupedTimesheets.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-20">No timesheets pending review.</div>
              ) : (
                <div className="divide-y divide-border">
                  {groupedTimesheets.map(group => {
                    const isExpanded = expandedEmployeeId === group.employeeId
                    return (
                      <div key={group.employeeId} className="flex flex-col">
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold text-sm shrink-0">
                              {group.employeeName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-foreground">{group.employeeName}</h3>
                                <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">{group.employeeRole}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{group.employeeEmail}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex flex-col text-right">
                                <span className="font-semibold">{group.totalLogs} Logs</span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {group.startDate === group.endDate ? group.startDate : `${group.startDate} – ${group.endDate}`}
                                </span>
                              </div>
                              <div className="flex flex-col text-right border-l border-border pl-3">
                                <span className="font-bold text-emerald-600">{group.totalHours} hrs</span>
                                <span className="text-[10px] text-muted-foreground">({group.totalOnsiteHours} onsite)</span>
                              </div>
                            </div>
                            <Button size="sm" variant={isExpanded ? 'default' : 'outline'}
                              onClick={() => handleToggleExpand(group.employeeId, group.logs)}
                              className="text-xs font-semibold h-9 gap-1.5">
                              {isExpanded ? <>Collapse <ChevronUp className="size-4" /></> : <>Review ({group.totalLogs}) <ChevronDown className="size-4" /></>}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-secondary/15 border-t border-b border-border p-4 sm:p-6 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                              <div>
                                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Weekly Work Log — {group.employeeName}</h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Review daily task logs including task codes and discipline from the Design Weekly Report.</p>
                              </div>
                              <Button size="sm" onClick={() => handleApproveAllForGroup(group)} disabled={submittingReview}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5">
                                {submittingReview ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                Approve All ({group.totalLogs})
                              </Button>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                              <table className="w-full text-xs text-left min-w-[900px]">
                                <thead>
                                  <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
                                    <th className="py-2.5 px-3 w-28">Date</th>
                                    <th className="py-2.5 px-3 w-48">Assigned Tasks</th>
                                    <th className="py-2.5 px-3 w-48">Actual Work Done</th>
                                    <th className="py-2.5 px-3 text-center w-36">Office Hours</th>
                                    <th className="py-2.5 px-3 text-center w-44">Manager Hours</th>
                                    <th className="py-2.5 px-3 w-44">Remark / Comment</th>
                                    <th className="py-2.5 px-3 text-right w-36">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {group.logs.map((log: any) => {
                                    const isSat = log.log_date ? new Date(log.log_date).getDay() === 6 : false
                                    const dH = isSat ? 4 : 8
                                    const hw = log.hours_worked > 0 ? Number(log.hours_worked) : (log.actual_working_hour > 0 ? Number(log.actual_working_hour) : dH)
                                    const entrance = log.office_entrance_time ? log.office_entrance_time.substring(0, 5) : '08:30'
                                    const leave = log.office_leave_time ? log.office_leave_time.substring(0, 5) : (isSat ? '12:30' : '17:30')
                                    const edit = logEditsMap[log.id] || { hours_worked: hw, actual_working_hour: hw, office_entrance_time: entrance, office_leave_time: leave, head_comments: '' }
                                    return (
                                      <tr key={log.id} className="hover:bg-muted/20 align-top">
                                        <td className="py-3 px-3 font-mono font-semibold whitespace-nowrap">
                                          <div>{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5">{log.log_date}</div>
                                        </td>
                                        <td className="py-3 px-3 leading-relaxed whitespace-pre-wrap max-w-xs">{log.assigned_tasks}</td>
                                        <td className="py-3 px-3 leading-relaxed whitespace-pre-wrap max-w-xs">{log.actual_work_done}</td>
                                        <td className="py-3 px-3 text-center font-mono text-[11px]">
                                          <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-muted-foreground font-semibold">In:</span>
                                              <input type="time" value={edit.office_entrance_time}
                                                onChange={(e) => handleLogEditChange(log.id, 'office_entrance_time', e.target.value)}
                                                className="h-6 w-20 text-center text-[11px] font-mono rounded border border-border bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-muted-foreground font-semibold">Out:</span>
                                              <input type="time" value={edit.office_leave_time}
                                                onChange={(e) => handleLogEditChange(log.id, 'office_leave_time', e.target.value)}
                                                className="h-6 w-20 text-center text-[11px] font-mono rounded border border-border bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex flex-col gap-1.5 min-w-[140px]">
                                            <div className="flex items-center justify-between gap-1 text-[10px]">
                                              <span className="text-muted-foreground font-semibold">Total Hrs:</span>
                                              <Input type="number" min="0" max="24" step="0.5" value={edit.hours_worked}
                                                onChange={(e) => handleLogEditChange(log.id, 'hours_worked', parseFloat(e.target.value) || 0)}
                                                className="h-7 w-16 text-center text-xs font-mono font-bold px-1" />
                                            </div>
                                            <div className="flex items-center justify-between gap-1 text-[10px]">
                                              <span className="text-muted-foreground font-semibold">Onsite Hrs:</span>
                                              <Input type="number" min="0" max="24" step="0.5" value={edit.actual_working_hour}
                                                onChange={(e) => handleLogEditChange(log.id, 'actual_working_hour', parseFloat(e.target.value) || 0)}
                                                className="h-7 w-16 text-center text-xs font-mono font-bold text-emerald-600 px-1" />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <Input value={edit.head_comments}
                                            onChange={(e) => handleLogEditChange(log.id, 'head_comments', e.target.value)}
                                            placeholder="Manager remark..." className="h-8 text-xs" />
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <Button size="sm" onClick={() => handleApproveSingleLog(log.id)} disabled={submittingReview}
                                              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5">Approve</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleReturnSingleLog(log.id)} disabled={submittingReview}
                                              className="h-7 font-bold text-[11px] px-2.5">Return</Button>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-base font-bold">{editingProjectId ? 'Edit Project' : 'Register Project'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProjectSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dp-code">Project Code *</Label>
                    <Input id="dp-code" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} required placeholder="e.g. PRJ-134" disabled={!!editingProjectId} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dp-name">Project Name *</Label>
                    <Input id="dp-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required placeholder="e.g. IVF Complex" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dp-client">Client Name</Label>
                    <Input id="dp-client" value={projectClient} onChange={(e) => setProjectClient(e.target.value)} placeholder="e.g. Ministry of Health" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dp-contr">Contractor</Label>
                    <Input id="dp-contr" value={projectContractor} onChange={(e) => setProjectContractor(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="dp-start">Start Date</Label>
                      <Input id="dp-start" type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="dp-end">Deadline</Label>
                      <Input id="dp-end" type="date" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="dp-pri">Priority</Label>
                      <Select value={projectPriority} onValueChange={(v) => v && setProjectPriority(v)}>
                        <SelectTrigger id="dp-pri"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="dp-status">Status</Label>
                      <Select value={projectStatus} onValueChange={(v) => v && setProjectStatus(v)}>
                        <SelectTrigger id="dp-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" disabled={savingProject} className="flex-1">
                      {savingProject ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                      {editingProjectId ? 'Save Changes' : 'Create Project'}
                    </Button>
                    {editingProjectId && <Button type="button" variant="outline" onClick={clearProjectForm}>Cancel</Button>}
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Assign employee */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="size-4.5 text-primary" />
                    Assign Design Engineer to Project
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAssignSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Label htmlFor="da-emp">Select Engineer</Label>
                      <Select value={selectedAssignEmployeeId} onValueChange={(v) => v && setSelectedAssignEmployeeId(v)}>
                        <SelectTrigger id="da-emp"><SelectValue placeholder="Choose engineer..." /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp: any) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Label htmlFor="da-proj">Select Project</Label>
                      <Select value={selectedAssignProjectCode} onValueChange={(v) => v && setSelectedAssignProjectCode(v)}>
                        <SelectTrigger id="da-proj"><SelectValue placeholder="Choose project..." /></SelectTrigger>
                        <SelectContent>
                          {projects.map((proj: any) => (
                            <SelectItem key={proj.code} value={proj.code}>{proj.code} — {proj.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={assigning} className="h-10 font-bold shrink-0">
                      {assigning ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                      Assign Engineer
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Projects list */}
              <Card className="shadow-sm">
                <CardHeader><CardTitle className="text-base font-bold">Design Projects Directory</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead><TableHead>Project Name</TableHead>
                          <TableHead>Progress</TableHead><TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-10">No projects yet.</TableCell></TableRow>
                        ) : projects.map((proj: any) => (
                          <TableRow key={proj.id}>
                            <TableCell className="font-mono text-xs font-bold">{proj.code}</TableCell>
                            <TableCell className="text-xs font-semibold">{proj.name}</TableCell>
                            <TableCell className="text-xs font-bold text-blue-600">{Number(proj.progress_percentage || 0)}%</TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                proj.priority === 'High' ? 'bg-rose-100 text-rose-800' : proj.priority === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                              }`}>{proj.priority || 'Medium'}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                proj.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : proj.status === 'On Hold' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                              }`}>{proj.status}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleEditProject(proj)} className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary"><Edit2 className="size-3.5" /></button>
                                <button onClick={() => setDeleteConfirm({ id: proj.id, tab: 'projects' })} className="inline-flex size-8 items-center justify-center rounded-md border text-destructive hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* EVALUATIONS TAB */}
      {activeTab === 'evaluations' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-base font-bold">Log Performance Review</CardTitle>
              <CardDescription>EF Design Dept — Weekly/Monthly Evaluation</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEvaluationSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dev-emp">Select Engineer *</Label>
                  <Select value={evalEmployeeId} onValueChange={(v) => v && setEvalEmployeeId(v)}>
                    <SelectTrigger id="dev-emp"><SelectValue placeholder="Choose engineer..." /></SelectTrigger>
                    <SelectContent>
                      {employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="dev-label" className="text-xs">Period Label (e.g. Week 9)</Label>
                  <Input id="dev-label" value={evalPeriodLabel} onChange={(e) => setEvalPeriodLabel(e.target.value)} placeholder="e.g. Week 9" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dev-start">Start Date *</Label>
                    <Input id="dev-start" type="date" value={evalStart} onChange={(e) => setEvalStart(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dev-end">End Date *</Label>
                    <Input id="dev-end" type="date" value={evalEnd} onChange={(e) => setEvalEnd(e.target.value)} required />
                  </div>
                </div>

                {/* Criteria matching the evaluation sample */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evaluation Criteria (0–100)</h4>
                  {[
                    { id: 'dev-tech', label: 'Technical Competence & Work Quality', weight: '40%', value: techScore, setter: setTechScore },
                    { id: 'dev-prod', label: 'Productivity & Task Completion', weight: '30%', value: prodScore, setter: setProdScore },
                    { id: 'dev-punc', label: 'Punctuality & Attendance', weight: '10%', value: puncScore, setter: setPuncScore },
                    { id: 'dev-comm', label: 'Communication & Teamwork', weight: '5%', value: commScore, setter: setCommScore },
                    { id: 'dev-rep', label: 'Reporting & Documentation', weight: '5%', value: repScore, setter: setRepScore },
                    { id: 'dev-adapt', label: 'Adaptability & Learning', weight: '10%', value: adaptScore, setter: setAdaptScore },
                  ].map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <label htmlFor={c.id} className="text-[11px] font-medium text-foreground leading-tight">{c.label}</label>
                        <span className="text-[10px] text-muted-foreground ml-1">({c.weight})</span>
                      </div>
                      <Input id={c.id} type="number" min="0" max="100" value={c.value}
                        onChange={(e) => c.setter(e.target.value)}
                        className="w-16 h-7 text-center text-xs font-bold shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Live score preview */}
                <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                  previewScore.grade === 'A' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'
                  : previewScore.grade === 'B' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20'
                  : previewScore.grade === 'C' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
                }`}>
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground">Total Score</div>
                    <div className="text-xl font-extrabold text-foreground">{previewScore.total}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-black ${
                      previewScore.grade === 'A' ? 'text-emerald-600' : previewScore.grade === 'B' ? 'text-blue-600' : previewScore.grade === 'C' ? 'text-amber-600' : 'text-rose-600'
                    }`}>{previewScore.grade}</div>
                    <div className="text-[10px] font-semibold text-muted-foreground">{previewScore.level}</div>
                  </div>
                </div>

                <Button type="submit" disabled={submittingEval} className="mt-1">
                  {submittingEval ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                  {editId ? 'Update Evaluation' : 'Log Evaluation'}
                </Button>
                {editId && <Button type="button" variant="outline" onClick={clearEvalForm}>Cancel Edit</Button>}
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Design Department Performance History</CardTitle>
                <button onClick={() => handleRefresh(mutateEvals, 'Evaluations')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                  <RotateCw className="size-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Engineer</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-12">No evaluations logged yet.</TableCell></TableRow>
                    ) : evaluations.map((e: any) => {
                      const score = Number(e.total_score || 0)
                      const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'NI'
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs font-semibold">{(e.employees ?? {}).full_name || '—'}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {e.period_label ? <span className="font-semibold text-foreground">{e.period_label} </span> : null}
                            {e.evaluation_period_start} → {e.evaluation_period_end}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-center text-primary">{score.toFixed(1)}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-black ${
                              grade === 'A' ? 'bg-emerald-100 text-emerald-700' : grade === 'B' ? 'bg-blue-100 text-blue-700' : grade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                            }`}>{grade}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              e.performance_level === 'Outstanding' ? 'bg-emerald-100 text-emerald-800'
                              : e.performance_level === 'Very Good' || e.performance_level === 'Good' ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                            }`}>{e.performance_level}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => setDeleteConfirm({ id: e.id, tab: 'evaluations' })} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EXPORTS TAB */}
      {activeTab === 'exports' && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          <Card className="sm:col-span-2 md:col-span-3 hover:shadow-md transition-shadow border-blue-300/40 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <FileSpreadsheet className="size-5" />
                Master Design Department Excel Ledger
              </CardTitle>
              <CardDescription>Export all design engineers, weekly work logs, project assignments, and performance evaluations in one multi-sheet workbook.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">Includes: Staff Roster, Timesheet Logs, Project Assignments &amp; Performance Scorecards.</div>
              <Button onClick={() => handleExportDownload('/api/export-master', 'EF_Design_Master_Report.xlsx')} className="w-full sm:w-auto font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow">
                <Download className="size-4" />Export Master Excel (.xlsx)
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Performance Evaluations</CardTitle>
              <CardDescription>Export all design engineer evaluation scorecards.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-performance', 'Design_Performance_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />Download Evals (.xlsx)
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Daily Work Logs</CardTitle>
              <CardDescription>Export all engineer daily work logs and attendance hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-work-logs', 'Design_Work_Logs_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />Download Work Logs (.xlsx)
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Project Status Report</CardTitle>
              <CardDescription>Export design project progress and assignment details.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/export-master', 'Design_Projects_Report.xlsx')} variant="outline" className="w-full font-bold gap-2">
                <Download className="size-4" />Download Projects (.xlsx)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden border-border/60 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Projects</span>
                  <span className="text-3xl font-extrabold text-foreground">{projectStats.total}</span>
                  <span className="text-[11px] text-muted-foreground">{projectStats.active} active</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-sm">
                  <FolderKanban className="size-5" />
                </span>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-border/60 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Progress</span>
                  <span className="text-3xl font-extrabold text-foreground">{projectStats.avgProgress}%</span>
                  <span className="text-[11px] text-muted-foreground">across all projects</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                  <Ruler className="size-5" />
                </span>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-border/60 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Evaluations</span>
                  <span className="text-3xl font-extrabold text-foreground">{evaluations.length}</span>
                  <span className="text-[11px] text-muted-foreground">performance records</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm">
                  <Award className="size-5" />
                </span>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-border/60 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Queue</span>
                  <span className="text-3xl font-extrabold text-foreground">{timesheetStats.queueSize}</span>
                  <span className="text-[11px] text-muted-foreground">{timesheetStats.totalHoursPending} hrs to verify</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shadow-sm">
                  <FileStack className="size-5" />
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Project Portfolio */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FolderKanban className="size-4.5 text-blue-500" />
                  Project Portfolio Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Active', val: projectStats.active, cls: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' },
                    { label: 'On Hold', val: projectStats.onHold, cls: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600' },
                    { label: 'Completed', val: projectStats.completed, cls: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-lg border border-border p-3 text-center ${s.cls}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{s.label}</span>
                      <span className="text-2xl font-bold">{s.val}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">Average Progress</span>
                    <span className="text-lg font-bold text-blue-600">{projectStats.avgProgress}%</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${projectStats.avgProgress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                  <span className="font-medium flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-rose-500" />High Priority</span>
                  <span className="font-bold text-rose-600">{projectStats.highPriority}</span>
                </div>
              </CardContent>
            </Card>

            {/* Performance dimensions */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="size-4.5 text-amber-500" />
                  Performance Score Dimensions
                </CardTitle>
                <CardDescription>Average scores across all evaluations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evalStats.dimensions.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">No evaluations recorded yet.</div>
                ) : evalStats.dimensions.map((dim: any) => (
                  <div key={dim.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{dim.label} ({dim.weight}%)</span>
                      <span className="font-bold text-amber-600">{dim.avg}/100</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${dim.avg}%` }} />
                    </div>
                  </div>
                ))}
                {evalStats.dimensions.length > 0 && (
                  <div className="pt-3 border-t border-border flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500 inline-flex" /><span className="text-muted-foreground">Outstanding: <strong className="text-foreground">{evalStats.outstanding}</strong></span></span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-500 inline-flex" /><span className="text-muted-foreground">Very Good: <strong className="text-foreground">{evalStats.veryGood}</strong></span></span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500 inline-flex" /><span className="text-muted-foreground">Good: <strong className="text-foreground">{evalStats.good}</strong></span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <UserProfile
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          userRole={userRole}
          userDepartment={userDepartment}
          theme="manager"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-border bg-card p-6 rounded-xl shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/30">
                <AlertTriangle className="size-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This will permanently delete the {deleteConfirm.tab === 'projects' ? 'project record' : 'evaluation record'} from the database. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} className="h-8 text-xs font-semibold">Cancel</Button>
              <Button variant="destructive" size="sm"
                onClick={() => { executeDeleteRecord(deleteConfirm.id, deleteConfirm.tab); setDeleteConfirm(null) }}
                className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
