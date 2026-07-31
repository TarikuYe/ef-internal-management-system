'use client'

import React, { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Clock3, Loader2, LayoutDashboard, ChevronLeft, ChevronRight,
  Plus, Trash2, CheckCircle, AlertTriangle, Clock, Sparkles,
  Lock, FolderKanban, Save, FileText, Award, CheckCircle2,
  Edit2, RotateCw, UserCircle, PencilRuler, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserProfile } from '@/components/user-profile'
import { EmployeeReportPanel } from '@/components/employee-report-panel'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function getWeekRange(refDate: Date) {
  const current = new Date(refDate)
  const day = current.getDay()
  const diff = current.getDate() - (day === 0 ? 6 : day - 1)
  const monday = new Date(current.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d)
  }
  const sunday = days[6]
  const workDays = days.filter(d => d.getDay() !== 0)
  return { monday, sunday, days: workDays }
}

function formatDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTime12(time24: string): string {
  if (!time24) return '—'
  const [hStr, mStr] = time24.split(':')
  let h = parseInt(hStr, 10)
  const m = (mStr || '00').substring(0, 2)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

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

interface TimesheetRow {
  id?: number | string
  log_date: string
  task_code: string
  discipline: string
  assigned_tasks: string
  actual_work_done: string
  hours_worked: number
  actual_working_hour: number
  completion_percentage: number
  done_at_home: boolean
  remark: string
  office_entrance_time: string
  office_leave_time: string
  deadline: string
  approval_status: 'Pending' | 'Approved' | 'Returned'
  head_comments?: string | null
  reviewed_at?: string | null
  isNew?: boolean
  priority?: string
  starting_date?: string
  ending_date?: string
  task_status?: string
}

function isRowLocked(row: TimesheetRow): boolean {
  if (typeof row.id !== 'number') return false
  if (row.approval_status === 'Returned') return false
  return true
}

type Tab = 'dashboard' | 'timesheet' | 'projects' | 'evaluations' | 'profile'

// Disciplines from the weekly report sample
const DISCIPLINES = ['Architect', 'Civil', 'Electrical', 'Sanitary', 'Mechanical', 'Structural', 'Highway', 'Drafting', 'Other']

export function OfficeEngEmployeeWorkspace({
  userId,
  userEmail,
  userName,
  userDepartment,
  userRole,
  initialTab = 'dashboard',
}: {
  userId: string
  userEmail: string
  userName: string
  userDepartment: string
  userRole: string
  initialTab?: Tab
}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date())
  const [savingTimesheet, setSavingTimesheet] = useState(false)
  const [localRows, setLocalRows] = useState<TimesheetRow[]>([])
  const [correctingKey, setCorrectingKey] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  const { monday, sunday, days } = useMemo(() => getWeekRange(referenceDate), [referenceDate])
  const mondayStr = formatDateString(monday)
  const sundayStr = formatDateString(sunday)
  const draftKey = `office-eng-timesheet-draft-${userId}-${mondayStr}`

  const { data: timesheetData, mutate: mutateTimesheet, isLoading: timesheetLoading } = useSWR<{ logs: any[] }>(
    `/api/daily-work-logs?start_date=${mondayStr}&end_date=${sundayStr}`,
    fetcher, { refreshInterval: 3_000 }
  )
  const { data: projectsData, mutate: mutateProjects } = useSWR<{ projects: any[] }>('/api/projects?mine=1', fetcher, { refreshInterval: 3_000 })
  const { data: evalsData } = useSWR('/api/evaluations', fetcher)
  const { data: weeklyTasksData } = useSWR<{ tasks: any[] }>('/api/weekly-tasks', fetcher)

  // Real-time listeners
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('office-eng-emp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_work_logs' }, () => mutateTimesheet())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_work_log_reviews' }, () => mutateTimesheet())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_project_assignments' }, () => mutateProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => mutateProjects())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mutateTimesheet, mutateProjects])

  const projects = projectsData?.projects ?? []
  const evaluations = evalsData?.evaluations ?? []
  const weeklyTasks = weeklyTasksData?.tasks ?? []

  const navigateWeek = (weeks: number) => {
    const newRef = new Date(referenceDate)
    newRef.setDate(newRef.getDate() + weeks * 7)
    setReferenceDate(newRef)
  }

  // Sync DB logs into local rows — adding office-engineering-specific fields
  useEffect(() => {
    if (!timesheetData) return
    const dbLogs = timesheetData.logs ?? []
    const mappedRows: TimesheetRow[] = []

    days.forEach(day => {
      const dateStr = formatDateString(day)
      const dayLogs = dbLogs.filter((l: any) => l.log_date === dateStr)
      const isSaturday = day.getDay() === 6

      if (dayLogs.length === 0) {
        mappedRows.push({
          log_date: dateStr, task_code: '', discipline: '', assigned_tasks: '', actual_work_done: '',
          hours_worked: isSaturday ? 4 : 8, actual_working_hour: isSaturday ? 4 : 8,
          completion_percentage: 0.80, done_at_home: false, remark: '',
          office_entrance_time: '08:30', office_leave_time: isSaturday ? '12:30' : '17:30',
          deadline: '', approval_status: 'Pending', isNew: true,
          priority: 'Medium', starting_date: '', ending_date: '', task_status: 'In Progress',
        })
      } else {
        const hasNonReturned = dayLogs.some((l: any) => (l.approval_status ?? 'Pending') !== 'Returned')
        dayLogs.forEach((log: any) => {
          const status = log.approval_status ?? 'Pending'
          if (status === 'Returned' && hasNonReturned) return
          const entrance = log.office_entrance_time ? log.office_entrance_time.substring(0, 5) : '08:30'
          const leave = log.office_leave_time ? log.office_leave_time.substring(0, 5) : (isSaturday ? '12:30' : '17:30')
          const autoH = calcHoursFromTime(entrance, leave, isSaturday)
          const dbH = Number(log.hours_worked || 0)
          const dbOnsite = Number(log.actual_working_hour || 0)
          const finalH = dbH > 0 ? dbH : (dbOnsite > 0 ? dbOnsite : autoH)
          mappedRows.push({
            id: log.id, log_date: log.log_date,
            task_code: log.task_code || '', discipline: log.discipline || '',
            assigned_tasks: log.assigned_tasks || '', actual_work_done: log.actual_work_done || '',
            hours_worked: finalH, actual_working_hour: dbOnsite > 0 ? dbOnsite : finalH,
            completion_percentage: Number(log.completion_percentage || 0),
            done_at_home: !!log.done_at_home, remark: log.remark || '',
            office_entrance_time: entrance, office_leave_time: leave,
            deadline: log.deadline || '',
            approval_status: status, head_comments: log.head_comments ?? null,
            reviewed_at: log.reviewed_at ?? null, isNew: false,
            priority: log.priority || 'Medium', starting_date: log.starting_date || '', ending_date: log.ending_date || '', task_status: log.task_status || 'In Progress',
          })
        })
      }
    })
    setLocalRows(mappedRows)

    // Restore draft
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const draftRows: TimesheetRow[] = JSON.parse(raw)
        setLocalRows(prev => prev.map(r => {
          if (isRowLocked(r)) return r
          const draft = draftRows.find(d => d.log_date === r.log_date && !isRowLocked(d))
          if (!draft) return r
          return {
            ...r,
            task_code: draft.task_code || r.task_code,
            discipline: draft.discipline || r.discipline,
            assigned_tasks: draft.assigned_tasks || r.assigned_tasks,
            actual_work_done: draft.actual_work_done || r.actual_work_done,
            remark: draft.remark || r.remark,
            deadline: draft.deadline || r.deadline,
            completion_percentage: draft.completion_percentage ?? r.completion_percentage,
            done_at_home: draft.done_at_home ?? r.done_at_home,
            office_entrance_time: draft.office_entrance_time || r.office_entrance_time,
            office_leave_time: draft.office_leave_time || r.office_leave_time,
            priority: draft.priority || r.priority,
            starting_date: draft.starting_date || r.starting_date,
            ending_date: draft.ending_date || r.ending_date,
            task_status: draft.task_status || r.task_status,
          }
        }))
        setDraftSaved(true)
      }
    } catch (_) {}
  }, [timesheetData, days])

  const handleWeeklyTaskSelect = (index: number, taskId: string) => {
    const row = localRows[index]
    if (isRowLocked(row)) return
    
    const task = weeklyTasks.find((t: any) => t.id?.toString() === taskId)
    if (!task) return

    setLocalRows(prev => {
      const copy = [...prev]
      copy[index] = {
        ...copy[index],
        task_code: task.task_code || '',
        discipline: task.discipline || '',
        assigned_tasks: task.task_description || '',
        priority: task.priority || 'Medium',
        starting_date: task.start_date || '',
        ending_date: task.end_date || '',
        deadline: task.deadline || '',
      }
      try {
        const draftRows = copy.filter(r => !isRowLocked(r))
        localStorage.setItem(draftKey, JSON.stringify(draftRows))
        setDraftSaved(true)
      } catch (_) {}
      return copy
    })
  }

  const handleInputChange = (index: number, field: keyof TimesheetRow, value: any) => {
    const row = localRows[index]
    if (isRowLocked(row)) {
      toast.error('Submission Locked', { description: 'Once a daily log is saved it cannot be modified.' })
      return
    }
    setLocalRows(prev => {
      const copy = [...prev]
      const updated = { ...copy[index], [field]: value }
      if (field === 'office_entrance_time' || field === 'office_leave_time') {
        const isSat = new Date(updated.log_date).getDay() === 6
        const h = calcHoursFromTime(updated.office_entrance_time, updated.office_leave_time, isSat)
        updated.hours_worked = h; updated.actual_working_hour = h
      }
      copy[index] = updated
      try {
        const draftRows = copy.filter(r => !isRowLocked(r))
        localStorage.setItem(draftKey, JSON.stringify(draftRows))
        setDraftSaved(true)
      } catch (_) {}
      return copy
    })
  }

  const addSplitRow = (dateStr: string) => {
    setLocalRows(prev => {
      const lastIdx = prev.map(r => r.log_date).lastIndexOf(dateStr)
      const newRow: TimesheetRow = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        log_date: dateStr, task_code: '', discipline: '', assigned_tasks: '', actual_work_done: '',
        hours_worked: 4, actual_working_hour: 4, completion_percentage: 0.50,
        done_at_home: false, remark: '', office_entrance_time: '08:30', office_leave_time: '12:30',
        deadline: '', approval_status: 'Pending', isNew: true,
        priority: 'Medium', starting_date: '', ending_date: '', task_status: 'In Progress',
      }
      const copy = [...prev]; copy.splice(lastIdx + 1, 0, newRow); return copy
    })
    toast.info('Added task row')
  }

  const removeRow = (index: number) => {
    const row = localRows[index]
    if (isRowLocked(row)) return
    const countForDate = localRows.filter(r => r.log_date === row.log_date).length
    if (countForDate <= 1) { toast.error('Cannot remove — each day needs at least one row.'); return }
    setLocalRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveTimesheet = async () => {
    const newRows = localRows.filter(r => !isRowLocked(r))
    if (newRows.length === 0) { toast.info('Nothing to save'); return }
    const invalid = newRows.filter(r => !r.assigned_tasks.trim() || !r.actual_work_done.trim())
    if (invalid.length > 0) { toast.error('Fill assigned tasks and actual work done for all rows.'); return }
    setSavingTimesheet(true)
    try {
      const logsToInsert = newRows.map(row => ({
        log_date: row.log_date,
        task_code: row.task_code || null,
        discipline: row.discipline || null,
        assigned_tasks: row.assigned_tasks,
        actual_work_done: row.actual_work_done,
        hours_worked: Number(row.hours_worked),
        actual_working_hour: Number(row.actual_working_hour),
        completion_percentage: Number(row.completion_percentage),
        done_at_home: !!row.done_at_home,
        remark: row.remark || null,
        deadline: row.deadline || null,
        office_entrance_time: row.office_entrance_time ? `${row.office_entrance_time}:00` : null,
        office_leave_time: row.office_leave_time ? `${row.office_leave_time}:00` : null,
        priority: row.priority || null,
        starting_date: row.starting_date || null,
        ending_date: row.ending_date || null,
        task_status: row.task_status || null,
        ...(row.approval_status === 'Returned' && typeof row.id === 'number' ? { returned_log_id: row.id } : {}),
      }))
      const res = await fetch('/api/daily-work-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logsToInsert),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed.')
      toast.success('Timesheet saved successfully')
      try { localStorage.removeItem(draftKey) } catch (_) {}
      setDraftSaved(false); mutateTimesheet()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save timesheet')
    } finally { setSavingTimesheet(false) }
  }

  const correctFieldText = async (index: number, field: 'assigned_tasks' | 'actual_work_done' | 'remark') => {
    const text = localRows[index][field]?.trim()
    if (!text) return
    const key = `${index}-${field}`
    setCorrectingKey(key)
    try {
      const res = await fetch('/api/text-correction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, field }) })
      const json = await res.json()
      if (res.ok) { handleInputChange(index, field, json.corrected); toast.success('Improved with AI') }
    } catch { toast.error('Correction failed') }
    finally { setCorrectingKey(null) }
  }

  // Project update
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectProgress, setProjectProgress] = useState<number>(0)
  const [projectPriority, setProjectPriority] = useState<string>('Medium')
  const [projectNotes, setProjectNotes] = useState<string>('')
  const [projectStatus, setProjectStatus] = useState<string>('Active')
  const [updatingProj, setUpdatingProj] = useState(false)

  const handleSelectProject = (projId: string) => {
    const p = projects.find((x: any) => x.id === projId)
    if (p) {
      setSelectedProjectId(projId); setProjectProgress(Number(p.progress_percentage || 0))
      setProjectPriority(p.priority || 'Medium'); setProjectNotes(p.notes || ''); setProjectStatus(p.status || 'Active')
    }
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return
    setUpdatingProj(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProjectId, progress_percentage: projectProgress, priority: projectPriority, notes: projectNotes, status: projectStatus })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update.')
      toast.success('Project updated'); mutateProjects()
    } catch (err: any) { toast.error(err.message || 'Update failed') }
    finally { setUpdatingProj(false) }
  }

  // Export helper
  const handleExportDownload = async (endpoint: string, filename: string) => {
    const id = toast.loading('Preparing export...')
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss(id); toast.success('Downloaded')
    } catch (err: any) { toast.dismiss(id); toast.error(err?.message || 'Export failed') }
  }

  // Dashboard stats
  const pendingCount = localRows.filter(r => r.approval_status === 'Pending' && !r.isNew).length
  const returnedCount = localRows.filter(r => r.approval_status === 'Returned' && !r.isNew).length
  const lastEval = evaluations[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-blue-500/10 via-background to-background p-4 sm:p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-36 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <PencilRuler className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-lg sm:text-2xl font-extrabold text-foreground leading-tight">
                    Welcome, {userName}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {userRole}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {userDepartment.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Workspace &middot; Office Engineering Department Module
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <EmployeeReportPanel label="Export My Log" mobileLabel="Export Log" />
            </div>
          </div>

          {/* Tab nav */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
            <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border w-max sm:w-full sm:flex-wrap">
              {([
                { id: 'dashboard', icon: <LayoutDashboard className="size-4" />, label: 'Dashboard' },
                { id: 'timesheet', icon: <Clock3 className="size-4" />, label: 'Timesheet' },
                // { id: 'projects', icon: <FolderKanban className="size-4" />, label: 'Projects' },
                { id: 'evaluations', icon: <Award className="size-4" />, label: 'My Evals' },
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
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Timesheet Status</CardTitle>
                <Clock className="size-4.5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount > 0 ? `${pendingCount} Pending` : 'Up-to-date'}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Logs submitted this week</p>
              </CardContent>
            </Card>
            {false && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Assigned Projects</CardTitle>
                <FolderKanban className="size-4.5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active project allocations</p>
              </CardContent>
            </Card>
            )}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Returned Logs</CardTitle>
                <AlertTriangle className="size-4.5 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">{returnedCount}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Require resubmission</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Performance</CardTitle>
                <Award className="size-4.5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lastEval ? lastEval.performance_level : '—'}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Latest rating</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
                <CardDescription>Common office engineering workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <Button onClick={() => setActiveTab('timesheet')} className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <Clock3 className="size-4" />Submit Weekly Timesheet
                </Button>
                <EmployeeReportPanel variant="outline" label="Export Work Log Report (.xlsx)" mobileLabel="Export Log" className="w-full justify-start text-xs font-semibold h-10 gap-2" />
                {false && (
                <Button onClick={() => setActiveTab('projects')} variant="secondary" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <FolderKanban className="size-4" />Update Project Progress
                </Button>
                )}
                <Button onClick={() => setActiveTab('evaluations')} variant="outline" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <Award className="size-4" />View My Evaluations
                </Button>
              </CardContent>
            </Card>

            <div className="md:col-span-2 flex flex-col gap-6">
              {false && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FolderKanban className="size-4 text-blue-500" />
                    My Active Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {projects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">No active assignments found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="w-24">Code</TableHead><TableHead>Project Name</TableHead>
                          <TableHead className="w-24">Progress</TableHead><TableHead className="w-24">Priority</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {projects.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs font-bold">{p.code}</TableCell>
                              <TableCell className="text-xs font-medium">{p.name}</TableCell>
                              <TableCell className="text-xs font-bold text-blue-600">{Number(p.progress_percentage || 0)}%</TableCell>
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
              )}

              {returnedCount > 0 && (
                <Card className="shadow-sm border-rose-200 dark:border-rose-800">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-rose-700">
                      <AlertTriangle className="size-4 text-rose-500" />
                      Action Required — Returned Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2">
                      {localRows.filter(r => r.approval_status === 'Returned').map((r, i) => (
                        <li key={i} className="flex gap-2 text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded-lg border-l-2 border-rose-400">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-500" />
                          <span><strong>{r.log_date}</strong>: {r.head_comments || 'Please review and resubmit.'}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TIMESHEET TAB — Office Engineering Weekly Report format */}
      {activeTab === 'timesheet' && (
        <div className="flex flex-col gap-4">
          {/* Week navigator */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => navigateWeek(-1)} className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-all" title="Previous Week">
                <ChevronLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <span className="block text-sm font-semibold text-foreground">
                  {new Date(monday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(sunday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[11px] text-muted-foreground">Office Engineering Department — Weekly Report Period</span>
              </div>
              <button onClick={() => navigateWeek(1)} className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-all" title="Next Week">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {draftSaved && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Save className="size-3" /> Draft saved
                </span>
              )}
              <EmployeeReportPanel variant="outline" label="Export Work Log" mobileLabel="Export" className="h-9 px-3 text-xs" />
              <Button variant="outline" onClick={() => setReferenceDate(new Date())} className="h-9 px-4 text-xs">Current Week</Button>
              <Button onClick={handleSaveTimesheet} disabled={savingTimesheet || timesheetLoading} className="h-9 px-5 font-semibold text-xs">
                {savingTimesheet ? <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Saving...</> : 'Save & Submit'}
              </Button>
            </div>
          </div>

          {/* Office Engineering Weekly Report table — with Task Code, Discipline, Deadline columns */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
            {timesheetLoading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading timesheet...</div>
            ) : (
              <table className="w-full min-w-[1300px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-36">Day / Date</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-24">Task Code</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground min-w-[280px]">Assigned Tasks *</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-24">Priority</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground min-w-[280px]">Actual Work Done *</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-28">Starting Date</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-28">Completed Date</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-32">Status</th>
                    <th className="py-3 px-3 text-center text-xs font-bold text-foreground whitespace-nowrap w-24">% Complete</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-36">Remark</th>
                    <th className="py-3 px-3 text-left text-xs font-bold text-foreground whitespace-nowrap w-28">Head's Approval</th>
                    <th className="py-3 px-3 text-center text-xs font-bold text-foreground whitespace-nowrap w-12">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {localRows.map((row, idx) => {
                    const isWeeklyTask = weeklyTasks.some((t: any) => 
                      (t.task_code && t.task_code === row.task_code) || 
                      (t.task_description && t.task_description === row.assigned_tasks)
                    )
                    const locked = isRowLocked(row)
                    const fieldLocked = locked || isWeeklyTask
                    const completionPct = Math.round(row.completion_percentage * 100)
                    const isFirstOfDate = idx === 0 || localRows[idx - 1].log_date !== row.log_date
                    const rowsForDate = localRows.filter(r => r.log_date === row.log_date)
                    return (
                      <tr key={idx} className={`border-b border-border transition-colors ${
                        row.approval_status === 'Approved' ? 'bg-emerald-50/30 dark:bg-emerald-950/20'
                        : row.approval_status === 'Returned' ? 'bg-rose-50/30 dark:bg-rose-950/20'
                        : 'hover:bg-muted/30'
                      }`}>
                        {/* Date cell — merged */}
                        {isFirstOfDate ? (
                          <td className="py-4 px-3 align-top" rowSpan={rowsForDate.length}>
                            <div className="font-bold text-[13px] text-foreground leading-tight">
                              {new Date(row.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{row.log_date}</div>
                            <div className="text-[11px] font-mono mt-1">
                              <span className="text-muted-foreground">{formatTime12(row.office_entrance_time)}</span>
                              <span className="text-muted-foreground mx-1">–</span>
                              <span className="text-muted-foreground">{formatTime12(row.office_leave_time)}</span>
                            </div>
                            {row.head_comments && (
                              <div className="mt-1.5 text-[10px] text-rose-600 bg-rose-50 border-l-2 border-rose-400 px-1.5 py-1 rounded leading-snug">
                                <strong>Comment:</strong> {row.head_comments}
                              </div>
                            )}
                          </td>
                        ) : null}

                        {/* Task Code */}
                        <td className="py-3 px-2 align-top">
                          {locked ? (
                            <span className="text-xs font-semibold text-foreground">{row.task_code || '—'}</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <Select onValueChange={(v: any) => handleWeeklyTaskSelect(idx, v || '')}>
                                <SelectTrigger className="h-8 text-xs font-mono font-bold"><span>Select Plan</span></SelectTrigger>
                                <SelectContent>
                                  {weeklyTasks.length > 0 ? (
                                    weeklyTasks.map((t: any) => (
                                      <SelectItem key={t.id} value={t.id.toString()}>{t.task_code || 'No Code'} - {t.task_description.substring(0, 15)}...</SelectItem>
                                    ))
                                  ) : (
                                    <div className="py-2 px-2 text-xs text-muted-foreground text-center">No plans assigned</div>
                                  )}
                                </SelectContent>
                              </Select>
                              <Input value={row.task_code} onChange={(e) => handleInputChange(idx, 'task_code', e.target.value)}
                                placeholder="Task Code..." className="h-8 text-xs font-mono font-bold" />
                            </div>
                          )}
                        </td>

                        {/* Task Description */}
                        <td className="py-3 px-2 align-top">
                          <textarea value={row.assigned_tasks} onChange={(e) => handleInputChange(idx, 'assigned_tasks', e.target.value)}
                            disabled={fieldLocked} placeholder="Task description..." rows={3}
                            className="w-full min-h-[80px] text-xs p-1.5 rounded-md border border-input bg-transparent resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed" />
                          {!fieldLocked && (
                            <button type="button" onClick={() => correctFieldText(idx, 'assigned_tasks')} disabled={correctingKey === `${idx}-assigned_tasks`}
                              className="flex items-center gap-1 text-[10px] text-primary mt-0.5 hover:underline">
                              {correctingKey === `${idx}-assigned_tasks` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}Fix with AI
                            </button>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-2 align-top">
                          {fieldLocked ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              row.priority === 'High' ? 'bg-rose-100 text-rose-800' : row.priority === 'Low' ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-800'
                            }`}>{row.priority || 'Medium'}</span>
                          ) : (
                            <Select value={row.priority || 'Medium'} onValueChange={(v) => handleInputChange(idx, 'priority', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>

                        {/* Actual Work Done */}
                        <td className="py-3 px-2 align-top">
                          <textarea value={row.actual_work_done} onChange={(e) => handleInputChange(idx, 'actual_work_done', e.target.value)}
                            disabled={locked} placeholder="Work accomplished..." rows={3}
                            className="w-full min-h-[80px] text-xs p-1.5 rounded-md border border-input bg-transparent resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed" />
                          {!locked && (
                            <button type="button" onClick={() => correctFieldText(idx, 'actual_work_done')} disabled={correctingKey === `${idx}-actual_work_done`}
                              className="flex items-center gap-1 text-[10px] text-primary mt-0.5 hover:underline">
                              {correctingKey === `${idx}-actual_work_done` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}Fix with AI
                            </button>
                          )}
                        </td>

                        {/* Starting Date */}
                        <td className="py-3 px-2 align-top">
                          <Input type="date" value={row.starting_date} onChange={(e) => handleInputChange(idx, 'starting_date', e.target.value)}
                            disabled={fieldLocked} className="h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed" />
                        </td>

                        {/* Ending Date */}
                        <td className="py-3 px-2 align-top">
                          <Input type="date" value={row.ending_date} onChange={(e) => handleInputChange(idx, 'ending_date', e.target.value)}
                            disabled={fieldLocked} className="h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed" />
                        </td>

                        {/* Status (Task Status) */}
                        <td className="py-3 px-2 align-top">
                          {locked ? (
                            <span className="text-xs font-semibold text-foreground">{row.task_status || 'In Progress'}</span>
                          ) : (
                            <Select value={row.task_status || 'In Progress'} onValueChange={(v) => handleInputChange(idx, 'task_status', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>

                        {/* % Complete */}
                        <td className="py-3 px-2 align-top">
                          <div className="flex flex-col gap-1 min-w-[80px]">
                            <input type="range" min="0" max="100" step="1" value={completionPct}
                              onChange={(e) => handleInputChange(idx, 'completion_percentage', parseFloat(e.target.value) / 100)}
                              disabled={locked} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500 disabled:opacity-50" />
                            <span className="text-[11px] font-bold text-blue-600 text-right">{completionPct}%</span>
                          </div>
                        </td>
                        {/* Remark */}
                        <td className="py-3 px-2 align-top">
                          <textarea value={row.remark} onChange={(e) => handleInputChange(idx, 'remark', e.target.value)}
                            disabled={locked} placeholder="Notes..." rows={2}
                            className="w-full text-xs p-1.5 rounded-md border border-input bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </td>

                        {/* Head's Approval */}
                        <td className="py-3 px-2 align-top">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                            row.approval_status === 'Approved' ? 'text-emerald-700 bg-emerald-100'
                            : row.approval_status === 'Returned' ? 'text-rose-700 bg-rose-100'
                            : 'text-amber-600 bg-amber-100'
                          }`}>{row.approval_status}</span>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-2 align-top text-center">
                          {!locked ? (
                            <div className="flex flex-col items-center gap-1">
                              <button onClick={() => addSplitRow(row.log_date)} title="Add task row"
                                className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                <Plus className="size-3.5" />
                              </button>
                              {typeof row.id === 'string' && row.id.startsWith('temp_') && (
                                <button onClick={() => removeRow(idx)} title="Remove row"
                                  className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-destructive hover:text-destructive transition-colors">
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            row.approval_status !== 'Approved' && <Lock className="size-3.5 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PROJECTS TAB */}
      {false && activeTab === 'projects' && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Assigned Projects</CardTitle>
              <CardDescription>Select a project to update progress.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-1">
              {projects.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6">No projects assigned yet.</div>
              ) : projects.map((p: any) => (
                <button key={p.id} onClick={() => handleSelectProject(p.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-1.5 ${
                    selectedProjectId === p.id ? 'border-blue-500 bg-blue-500/5 font-bold shadow-sm' : 'border-border bg-background hover:bg-secondary/40'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">{p.code}</span>
                    <span className="text-blue-600 font-bold">{p.progress_percentage || 0}%</span>
                  </div>
                  <div className="font-medium text-foreground truncate">{p.name}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Update Progress</CardTitle>
              <CardDescription>Update office engineering project metrics and remarks.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedProjectId ? (
                <div className="text-center text-xs text-muted-foreground py-20 bg-muted/10 rounded-lg border border-dashed">
                  Select a project from the left.
                </div>
              ) : (
                <form onSubmit={handleUpdateProject} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dep-prog">Progress: {projectProgress}%</Label>
                    <input id="dep-prog" type="range" min="0" max="100" step="5" value={projectProgress}
                      onChange={(e) => setProjectProgress(parseInt(e.target.value) || 0)}
                      className="w-full accent-blue-500 h-2 bg-secondary rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="dep-pri">Priority</Label>
                      <Select value={projectPriority} onValueChange={(v) => v && setProjectPriority(v)}>
                        <SelectTrigger id="dep-pri"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="dep-status">Status</Label>
                      <Select value={projectStatus} onValueChange={(v) => v && setProjectStatus(v)}>
                        <SelectTrigger id="dep-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dep-notes">Office Engineering Remarks &amp; Updates</Label>
                    <textarea id="dep-notes" value={projectNotes} onChange={(e) => setProjectNotes(e.target.value)}
                      placeholder="Revisions, challenges, milestones, next steps..." rows={4}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <Button type="submit" disabled={updatingProj} className="sm:self-start bg-blue-600 hover:bg-blue-700 text-white">
                    {updatingProj ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                    Save Project Updates
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* EVALUATIONS TAB */}
      {activeTab === 'evaluations' && (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="size-5 text-amber-500" />
                My Performance History
              </CardTitle>
              <CardDescription>Evaluations submitted by the Office Engineering Department manager.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {evaluations.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12">No evaluations available yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Review Period</TableHead>
                        <TableHead className="text-center">Total Score</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Technical (40%)</TableHead>
                        <TableHead>Productivity (30%)</TableHead>
                        <TableHead>Punctuality (10%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map((e: any) => {
                        const score = Number(e.total_score || 0)
                        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'NI'
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs font-semibold font-mono">
                              {e.period_label ? <span className="text-blue-600 font-bold mr-1">{e.period_label}</span> : null}
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
                            <TableCell className="text-xs font-mono">{Number(e.tech_competence_score || 0).toFixed(0)}%</TableCell>
                            <TableCell className="text-xs font-mono">{Number(e.productivity_score || 0).toFixed(0)}%</TableCell>
                            <TableCell className="text-xs font-mono">{Number(e.punctuality_score || 0).toFixed(0)}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <UserProfile userId={userId} userEmail={userEmail} userName={userName} userRole={userRole} userDepartment={userDepartment} theme="employee" />
      )}
    </div>
  )
}
