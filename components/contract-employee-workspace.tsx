'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  History,
  Clock3,
  Settings,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Clock,
  Sparkles,
  Lock,
  FolderKanban,
  Save,
  FileText,
  Layers,
  Calendar,
  Award,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Edit2,
  RotateCw,
  UserCircle,
} from 'lucide-react'
import Link from 'next/link'
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
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  const sunday = days[6]
  const workDays = days.filter(d => d.getDay() !== 0) // filter out Sunday
  return { monday, sunday, days: workDays }
}

function formatDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function displayDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// Convert stored 24h "HH:MM" to display "HH:MM AM/PM"
function formatTime12(time24: string): string {
  if (!time24) return '—'
  const [hStr, mStr] = time24.split(':')
  let h = parseInt(hStr, 10)
  const m = (mStr || '00').substring(0, 2)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

// Sub-component: renders ⊙ 08:30 AM ⊙ with working time picker
function TimePickerCell({
  value,
  onChange,
  locked,
  label,
}: {
  value: string
  onChange: (v: string) => void
  locked: boolean
  label: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Clock className="size-3.5 text-muted-foreground shrink-0" />
      <span className="text-[12px] font-medium text-foreground tabular-nums tracking-tight">
        {formatTime12(value)}
      </span>
      {!locked && (
        <>
          <button
            type="button"
            title={`Edit ${label}`}
            onClick={() => ref.current?.showPicker?.()}
            className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors focus:outline-none"
          >
            <Clock className="size-3.5" />
          </button>
          <input
            ref={ref}
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
          />
        </>
      )}
    </div>
  )
}

interface TimesheetRow {
  id?: number | string
  log_date: string
  assigned_tasks: string
  actual_work_done: string
  hours_worked: number
  actual_working_hour: number
  completion_percentage: number
  done_at_home: boolean
  remark: string
  office_entrance_time: string
  office_leave_time: string
  approval_status: 'Pending' | 'Approved' | 'Returned'
  head_comments?: string | null
  reviewed_at?: string | null
  isNew?: boolean
}

function isRowLocked(row: TimesheetRow): boolean {
  if (typeof row.id !== 'number') return false
  if (row.approval_status === 'Returned') return false
  return true
}

type Tab = 'dashboard' | 'timesheet' | 'projects' | 'registrar' | 'evaluations' | 'profile'

export function ContractEmployeeWorkspace({
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

  // Draft key scoped to user + week so drafts don't cross between weeks or users
  const draftKey = `timesheet-draft-${userId}-${mondayStr}`

  // Fetch timesheets
  const { data: timesheetData, mutate: mutateTimesheet, isLoading: timesheetLoading } = useSWR<{ logs: any[] }>(
    `/api/daily-work-logs?start_date=${mondayStr}&end_date=${sundayStr}`,
    fetcher,
    { refreshInterval: 3_000 }
  )

  // Fetch Projects with real-time refresh interval
  const { data: projectsData, mutate: mutateProjects, isLoading: projectsLoading } = useSWR<{ projects: any[] }>(
    '/api/projects?mine=1',
    fetcher,
    { refreshInterval: 3_000 }
  )

  const { data: weeklyTasksData, mutate: mutateWeeklyTasks } = useSWR<{ tasks: any[] }>('/api/weekly-tasks', fetcher)

  // Real-time listener for timesheets, reviews, employee project assignments & projects changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('contract-emp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_work_logs' },
        () => {
          mutateTimesheet()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_work_log_reviews' },
        () => {
          mutateTimesheet()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_project_assignments' },
        () => {
          mutateProjects()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          mutateProjects()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_tasks' },
        () => {
          mutateWeeklyTasks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mutateTimesheet, mutateProjects, mutateWeeklyTasks])

  // Fetch Registrar records
  const { data: correspondenceData, mutate: mutateCorr } = useSWR('/api/correspondence', fetcher)
  const { data: bondsData, mutate: mutateBonds } = useSWR('/api/bonds', fetcher)
  const { data: eotsData, mutate: mutateEots } = useSWR('/api/eot', fetcher)
  
  // Fetch Performance evaluations
  const { data: evalsData } = useSWR('/api/evaluations', fetcher)

  const projects = projectsData?.projects ?? []
  const correspondence = correspondenceData?.correspondence ?? []
  const bonds = bondsData?.bonds ?? []
  const eots = eotsData?.eots ?? []
  const evaluations = evalsData?.evaluations ?? []
  const weeklyTasks = weeklyTasksData?.tasks ?? []

  const handleRefresh = async (mutateFn: () => Promise<any>, name: string) => {
    const toastId = toast.loading(`Refreshing ${name}...`)
    try {
      await mutateFn()
      toast.dismiss(toastId)
      toast.success(`${name} refreshed successfully`)
    } catch {
      toast.dismiss(toastId)
      toast.error(`Failed to refresh ${name}`)
    }
  }

  // Synchronization of database logs with timesheet rows
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
          log_date: dateStr,
          assigned_tasks: '',
          actual_work_done: '',
          hours_worked: isSaturday ? 4 : 8,
          actual_working_hour: isSaturday ? 4 : 8,
          completion_percentage: 0.80,
          done_at_home: false,
          remark: '',
          office_entrance_time: '08:30',
          office_leave_time: isSaturday ? '12:30' : '17:30',
          approval_status: 'Pending',
          isNew: true,
        })
      } else {
        const hasNonReturnedRow = dayLogs.some((l: any) => (l.approval_status ?? 'Pending') !== 'Returned')
        dayLogs.forEach((log: any) => {
          const status = log.approval_status ?? 'Pending'
          if (status === 'Returned' && hasNonReturnedRow) return // skip returned if resubmitted
          const entrance = log.office_entrance_time ? log.office_entrance_time.substring(0, 5) : '08:30'
          const leave = log.office_leave_time ? log.office_leave_time.substring(0, 5) : (isSaturday ? '12:30' : '17:30')
          const autoHours = calcHoursFromTime(entrance, leave, isSaturday)
          const dbHours = Number(log.hours_worked || 0)
          const dbOnsite = Number(log.actual_working_hour || 0)
          const finalHours = dbHours > 0 ? dbHours : (dbOnsite > 0 ? dbOnsite : autoHours)
          const finalOnsite = dbOnsite > 0 ? dbOnsite : finalHours

          mappedRows.push({
            id: log.id,
            log_date: log.log_date,
            assigned_tasks: log.assigned_tasks || '',
            actual_work_done: log.actual_work_done || '',
            hours_worked: finalHours,
            actual_working_hour: finalOnsite,
            completion_percentage: Number(log.completion_percentage || 0),
            done_at_home: !!log.done_at_home,
            remark: log.remark || '',
            office_entrance_time: entrance,
            office_leave_time: leave,
            approval_status: status,
            head_comments: log.head_comments ?? null,
            reviewed_at: log.reviewed_at ?? null,
            isNew: false,
          })
        })
      }
    })
    setLocalRows(mappedRows)

    // Restore draft: merge any saved draft text into the new unlocked rows
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
            assigned_tasks: draft.assigned_tasks || r.assigned_tasks,
            actual_work_done: draft.actual_work_done || r.actual_work_done,
            remark: draft.remark || r.remark,
            hours_worked: typeof r.id === 'number' ? r.hours_worked : (draft.hours_worked ?? r.hours_worked),
            actual_working_hour: typeof r.id === 'number' ? r.actual_working_hour : (draft.actual_working_hour ?? r.actual_working_hour),
            completion_percentage: draft.completion_percentage ?? r.completion_percentage,
            done_at_home: draft.done_at_home ?? r.done_at_home,
            office_entrance_time: draft.office_entrance_time || r.office_entrance_time,
            office_leave_time: draft.office_leave_time || r.office_leave_time,
          }
        }))
        setDraftSaved(true)
      }
    } catch (_) {}
  }, [timesheetData, days])

  const navigateWeek = (weeks: number) => {
    const newRef = new Date(referenceDate)
    newRef.setDate(newRef.getDate() + weeks * 7)
    setReferenceDate(newRef)
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
  if (diffMin > 300) {
    diffMin -= 60
  }
  return Math.round((diffMin / 60) * 10) / 10
}

  const handleWeeklyTaskSelect = (index: number, taskId: string) => {
    const row = localRows[index]
    if (isRowLocked(row)) return
    
    const task = weeklyTasks.find((t: any) => t.id?.toString() === taskId)
    if (!task) return

    setLocalRows(prev => {
      const copy = [...prev]
      copy[index] = {
        ...copy[index],
        assigned_tasks: task.task_description || '',
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
      toast.error('Submission Locked', {
        description: 'Once a daily task log is saved it cannot be modified.',
      })
      return
    }
    setLocalRows(prev => {
      const copy = [...prev]
      const updatedRow = { ...copy[index], [field]: value }
      if (field === 'office_entrance_time' || field === 'office_leave_time') {
        const isSaturday = new Date(updatedRow.log_date).getDay() === 6
        const calcH = calcHoursFromTime(updatedRow.office_entrance_time, updatedRow.office_leave_time, isSaturday)
        updatedRow.hours_worked = calcH
        updatedRow.actual_working_hour = calcH
      }
      copy[index] = updatedRow
      // Save only new/unlocked rows as draft to localStorage
      try {
        const draftRows = copy.filter(r => !isRowLocked(r))
        localStorage.setItem(draftKey, JSON.stringify(draftRows))
        setDraftSaved(true)
      } catch (_) {}
      return copy
    })
  }

  const addSplitTaskRow = (dateStr: string) => {
    setLocalRows(prev => {
      const lastIndex = prev.map(r => r.log_date).lastIndexOf(dateStr)
      const newRow: TimesheetRow = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        log_date: dateStr,
        assigned_tasks: '',
        actual_work_done: '',
        hours_worked: 4,
        actual_working_hour: 4,
        completion_percentage: 0.50,
        done_at_home: false,
        remark: '',
        office_entrance_time: '08:30',
        office_leave_time: '12:30',
        approval_status: 'Pending',
        isNew: true
      }
      const copy = [...prev]
      copy.splice(lastIndex + 1, 0, newRow)
      return copy
    })
    toast.info('Added split day row')
  }

  const removeRow = (index: number) => {
    const row = localRows[index]
    if (isRowLocked(row)) return
    const countForDate = localRows.filter(r => r.log_date === row.log_date).length
    if (countForDate <= 1) {
      toast.error('Cannot remove row', { description: 'Each day must have at least one logger row.' })
      return
    }
    setLocalRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveTimesheet = async () => {
    const newRows = localRows.filter(r => !isRowLocked(r))
    if (newRows.length === 0) {
      toast.info('Nothing to save')
      return
    }
    const invalidRows = newRows.filter(r => !r.assigned_tasks.trim() || !r.actual_work_done.trim())
    if (invalidRows.length > 0) {
      toast.error('Incomplete logs', { description: 'Fill assigned tasks and actual work done for all rows.' })
      return
    }

    setSavingTimesheet(true)
    try {
      const logsToInsert = newRows.map(row => ({
        log_date: row.log_date,
        assigned_tasks: row.assigned_tasks,
        actual_work_done: row.actual_work_done,
        hours_worked: Number(row.hours_worked),
        actual_working_hour: Number(row.actual_working_hour),
        completion_percentage: Number(row.completion_percentage),
        done_at_home: !!row.done_at_home,
        remark: row.remark || null,
        office_entrance_time: row.office_entrance_time ? `${row.office_entrance_time}:00` : null,
        office_leave_time: row.office_leave_time ? `${row.office_leave_time}:00` : null,
        ...(row.approval_status === 'Returned' && typeof row.id === 'number' ? { returned_log_id: row.id } : {}),
      }))

      const res = await fetch('/api/daily-work-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logsToInsert),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed.')

      toast.success('Timesheet saved successfully')
      // Clear draft after successful save
      try { localStorage.removeItem(draftKey) } catch (_) {}
      setDraftSaved(false)
      mutateTimesheet()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save timesheet')
    } finally {
      setSavingTimesheet(false)
    }
  }

  // AI text helper
  const correctFieldText = async (index: number, field: 'assigned_tasks' | 'actual_work_done' | 'remark') => {
    const row = localRows[index]
    const text = row[field]?.trim()
    if (!text) return
    const key = `${index}-${field}`
    setCorrectingKey(key)
    try {
      const res = await fetch('/api/text-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, field }),
      })
      const json = await res.json()
      if (res.ok) {
        handleInputChange(index, field, json.corrected)
        toast.success('Improved with AI')
      }
    } catch (err) {
      toast.error('Correction failed')
    } finally {
      setCorrectingKey(null)
    }
  }

  // Project update
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectProgress, setProjectProgress] = useState<number>(0)
  const [projectPriority, setProjectPriority] = useState<string>('Medium')
  const [projectNotes, setProjectNotes] = useState<string>('')
  const [projectStatus, setProjectStatus] = useState<string>('Active')
  const [updatingProj, setUpdatingProj] = useState(false)

  const handleSelectProject = (projId: string) => {
    const p = projects.find(x => x.id === projId)
    if (p) {
      setSelectedProjectId(projId)
      setProjectProgress(Number(p.progress_percentage || 0))
      setProjectPriority(p.priority || 'Medium')
      setProjectNotes(p.notes || '')
      setProjectStatus(p.status || 'Active')
    }
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return
    setUpdatingProj(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedProjectId,
          progress_percentage: projectProgress,
          priority: projectPriority,
          notes: projectNotes,
          status: projectStatus,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update.')
      toast.success('Project details updated')
      mutateProjects()
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    } finally {
      setUpdatingProj(false)
    }
  }

  // Registrar forms
  const [registrarSubTab, setRegistrarSubTab] = useState<'correspondence' | 'bonds' | 'eot'>('correspondence')
  const [editId, setEditId] = useState<string | number | null>(null)

  // 1. Correspondence Form State
  const [corrRef, setCorrRef] = useState('')
  const [corrDate, setCorrDate] = useState('')
  const [corrDirection, setCorrDirection] = useState<'Incoming' | 'Outgoing'>('Incoming')
  const [corrCounterparty, setCorrCounterparty] = useState('')
  const [corrSubject, setCorrSubject] = useState('')
  const [corrCategory, setCorrCategory] = useState<'NOC' | 'General' | 'RFI' | 'EOT Claim' | 'Variation' | 'Payment'>('General')
  const [corrRespRequired, setCorrRespRequired] = useState(false)
  const [corrDueDate, setCorrDueDate] = useState('')
  const [corrLinkedRef, setCorrLinkedRef] = useState('')
  const [corrSentDate, setCorrSentDate] = useState('')

  const handleCorrespondenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      letter_ref_no: corrRef,
      date_logged: corrDate,
      direction: corrDirection,
      counterparty: corrCounterparty,
      subject: corrSubject,
      category: corrCategory,
      response_required: corrRespRequired,
      response_due_date: corrRespRequired ? corrDueDate : null,
      linked_response_ref: corrLinkedRef || null,
      response_sent_date: corrSentDate || null,
    }
    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/correspondence', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.')
      toast.success(editId ? 'Letter updated' : 'Letter registered successfully')
      clearCorrespondenceForm()
      mutateCorr()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const clearCorrespondenceForm = () => {
    setEditId(null)
    setCorrRef('')
    setCorrDate('')
    setCorrDirection('Incoming')
    setCorrCounterparty('')
    setCorrSubject('')
    setCorrCategory('General')
    setCorrRespRequired(false)
    setCorrDueDate('')
    setCorrLinkedRef('')
    setCorrSentDate('')
  }

  // 2. Bonds Form State
  const [bondEmployer, setBondEmployer] = useState('')
  const [bondProject, setBondProject] = useState('')
  const [bondContractor, setBondContractor] = useState('')
  const [bondType, setBondType] = useState<'Advance Payment Bond' | 'Performance Bond'>('Performance Bond')
  const [bondIssueDate, setBondIssueDate] = useState('')
  const [bondExpiryDate, setBondExpiryDate] = useState('')
  const [bondAmount, setBondAmount] = useState('')
  const [bondStatus, setBondStatus] = useState<'Active' | 'Expired' | 'Released'>('Active')
  const [bondNotificationEmail, setBondNotificationEmail] = useState('')
  const [bondOptionalEmail, setBondOptionalEmail] = useState('')

  // Multi-contractor hierarchy & filtering states
  const [bondFilterEmployer, setBondFilterEmployer] = useState('')
  const [bondFilterProject, setBondFilterProject] = useState('')
  const [bondFilterContractor, setBondFilterContractor] = useState('')
  const [eotFilterEmployer, setEotFilterEmployer] = useState('')
  const [eotFilterProject, setEotFilterProject] = useState('')
  const [eotFilterContractor, setEotFilterContractor] = useState('')
  const [showBondFilters, setShowBondFilters] = useState(false)
  const [showEotFilters, setShowEotFilters] = useState(false)

  const handleBondSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      employer_name: bondEmployer,
      project_name: bondProject,
      contractor_name: bondContractor,
      bond_type: bondType,
      issue_date: bondIssueDate || null,
      expiry_date: bondExpiryDate,
      amount: bondAmount ? parseFloat(bondAmount) : null,
      status: bondStatus,
      assigned_manager_email: [bondNotificationEmail, bondOptionalEmail].filter(Boolean).join(',') || 'team@efae.com'
    }
    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/bonds', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.')
      toast.success(editId ? 'Bond updated' : 'Bond registered successfully')
      clearBondForm()
      mutateBonds()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const clearBondForm = () => {
    setEditId(null)
    setBondEmployer('')
    setBondProject('')
    setBondContractor('')
    setBondType('Performance Bond')
    setBondIssueDate('')
    setBondExpiryDate('')
    setBondAmount('')
    setBondStatus('Active')
    setBondNotificationEmail('')
    setBondOptionalEmail('')
  }

  // 3. EOT Form State
  const [eotClient, setEotClient] = useState('')
  const [eotProject, setEotProject] = useState('')
  const [eotContractor, setEotContractor] = useState('')
  const [eotNum, setEotNum] = useState('1')
  const [eotDays, setEotDays] = useState('0')
  const [eotRevDate, setEotRevDate] = useState('')
  const [eotStatus, setEotStatus] = useState<'Approved' | 'Rejected' | 'Pending' | 'Under Review'>('Pending')
  const [eotReason, setEotReason] = useState('')
  const [eotNotificationEmail, setEotNotificationEmail] = useState('')
  const [eotOptionalEmail, setEotOptionalEmail] = useState('')

  const handleEotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      client_name: eotClient,
      project_name: eotProject,
      contractor_name: eotContractor,
      eot_number: parseInt(eotNum) || 1,
      days_approved: parseInt(eotDays) || 0,
      revised_completion_date: eotRevDate,
      status: eotStatus,
      reason_for_eot: eotReason,
      assigned_manager_email: [eotNotificationEmail, eotOptionalEmail].filter(Boolean).join(',') || 'team@efae.com'
    }
    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/eot', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.')
      toast.success(editId ? 'EOT updated' : 'EOT claim submitted successfully')
      clearEotForm()
      mutateEots()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const clearEotForm = () => {
    setEditId(null)
    setEotClient('')
    setEotProject('')
    setEotContractor('')
    setEotNum('1')
    setEotDays('0')
    setEotRevDate('')
    setEotStatus('Pending')
    setEotReason('')
    setEotNotificationEmail('')
    setEotOptionalEmail('')
  }

  // Password reset setting
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [updatingPw, setUpdatingPw] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) {
      toast.error('Password too short')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    setUpdatingPw(true)
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    })
    if (verifyErr) {
      toast.error('Current password incorrect')
      setUpdatingPw(false)
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
    if (updateErr) {
      toast.error('Update failed')
    } else {
      toast.success('Password updated successfully')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    }
    setUpdatingPw(false)
  }

  // Report Export Download Trigger
  const handleExportDownload = async (endpoint: string, filename: string) => {
    const loadingToastId = toast.loading('Preparing export report...')
    try {
      const res = await fetch(endpoint)
      if (!res.ok) {
        const ct = res.headers.get('content-type') || ''
        const msg = ct.includes('json')
          ? ((await res.json()).error ?? `Server error ${res.status}`)
          : `Server error ${res.status}`
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss(loadingToastId)
      toast.success('Report downloaded successfully')
    } catch (err: any) {
      toast.dismiss(loadingToastId)
      toast.error(err?.message || 'Failed to generate export report')
    }
  }

  // Dashboard Stats Calculations
  const timesheetPendingCount = localRows.filter(r => r.approval_status === 'Pending' && !r.isNew).length
  const timesheetApprovedHours = localRows
    .filter(r => r.approval_status === 'Approved')
    .reduce((sum, r) => sum + r.hours_worked, 0)
  
  const expiringBonds = useMemo(() => {
    const today = new Date()
    return bonds.filter((b: any) => {
      if (b.status === 'Released') return false
      const exp = new Date(b.expiry_date)
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    })
  }, [bonds])

  const overdueCorrespondence = useMemo(() => {
    return correspondence.filter((c: any) => c.status === 'Overdue')
  }, [correspondence])

  const lastEvaluation = evaluations[0] ?? null

  const recentComments = useMemo(() => {
    const list: string[] = []
    localRows.forEach(r => {
      if (r.head_comments) list.push(`Timesheet (${r.log_date}): ${r.head_comments}`)
    })
    eots.forEach((e: any) => {
      if (e.status === 'Returned' && e.manager_comments) {
        list.push(`EOT Request: ${e.manager_comments}`)
      }
    })
    return list.slice(0, 5)
  }, [localRows, eots])

  const uniqueEmployers = useMemo(() => {
    const list = new Set<string>()
    bonds.forEach((b: any) => { if (b.employer_name) list.add(b.employer_name) })
    eots.forEach((e: any) => { if (e.client_name) list.add(e.client_name) })
    return Array.from(list).sort()
  }, [bonds, eots])

  const bondProjectsList = useMemo(() => {
    if (!bondEmployer) return []
    const list = new Set<string>()
    bonds.forEach((b: any) => { if (b.employer_name === bondEmployer && b.project_name) list.add(b.project_name) })
    eots.forEach((e: any) => { if (e.client_name === bondEmployer && e.project_name) list.add(e.project_name) })
    return Array.from(list).sort()
  }, [bonds, eots, bondEmployer])

  const bondContractorsList = useMemo(() => {
    if (!bondProject) return []
    const list = new Set<string>()
    bonds.forEach((b: any) => { if (b.project_name === bondProject && b.contractor_name) list.add(b.contractor_name) })
    eots.forEach((e: any) => { if (e.project_name === bondProject && e.contractor_name) list.add(e.contractor_name) })
    return Array.from(list).sort()
  }, [bonds, eots, bondProject])
  
  const eotProjectsList = useMemo(() => {
    if (!eotClient) return []
    const list = new Set<string>()
    bonds.forEach((b: any) => { if (b.employer_name === eotClient && b.project_name) list.add(b.project_name) })
    eots.forEach((e: any) => { if (e.client_name === eotClient && e.project_name) list.add(e.project_name) })
    return Array.from(list).sort()
  }, [bonds, eots, eotClient])

  const eotContractorsList = useMemo(() => {
    if (!eotProject) return []
    const list = new Set<string>()
    bonds.forEach((b: any) => { if (b.project_name === eotProject && b.contractor_name) list.add(b.contractor_name) })
    eots.forEach((e: any) => { if (e.project_name === eotProject && e.contractor_name) list.add(e.contractor_name) })
    return Array.from(list).sort()
  }, [bonds, eots, eotProject])

  const filteredBonds = useMemo(() => {
    return bonds.filter((b: any) => {
      const matchEmp = !bondFilterEmployer || (b.employer_name || '').toLowerCase().includes(bondFilterEmployer.toLowerCase())
      const matchProj = !bondFilterProject || (b.project_name || '').toLowerCase().includes(bondFilterProject.toLowerCase())
      const matchCont = !bondFilterContractor || (b.contractor_name || '').toLowerCase().includes(bondFilterContractor.toLowerCase())
      return matchEmp && matchProj && matchCont
    })
  }, [bonds, bondFilterEmployer, bondFilterProject, bondFilterContractor])

  const filteredEots = useMemo(() => {
    return eots.filter((e: any) => {
      const matchEmp = !eotFilterEmployer || (e.client_name || '').toLowerCase().includes(eotFilterEmployer.toLowerCase())
      const matchProj = !eotFilterProject || (e.project_name || '').toLowerCase().includes(eotFilterProject.toLowerCase())
      const matchCont = !eotFilterContractor || (e.contractor_name || '').toLowerCase().includes(eotFilterContractor.toLowerCase())
      return matchEmp && matchProj && matchCont
    })
  }, [eots, eotFilterEmployer, eotFilterProject, eotFilterContractor])

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden Datalists for Combobox behavior */}
      <datalist id="unique-employers">
        {uniqueEmployers.map(emp => <option key={emp} value={emp} />)}
      </datalist>
      <datalist id="bond-projects-list">
        {bondProjectsList.map(p => <option key={p} value={p} />)}
      </datalist>
      <datalist id="bond-contractors-list">
        {bondContractorsList.map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="eot-projects-list">
        {eotProjectsList.map(p => <option key={p} value={p} />)}
      </datalist>
      <datalist id="eot-contractors-list">
        {eotContractorsList.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* Premium Header Profile Block */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-background to-background p-4 sm:p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-36 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Briefcase className="size-5 sm:size-6 text-accent" />
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
                  {userDepartment} Workspace &middot; Contract Administration Module
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:self-auto">
              <EmployeeReportPanel label="Export My Log" mobileLabel="Export Log" />
            </div>
          </div>

          {/* Tab nav — scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
            <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border w-max sm:w-full sm:flex-wrap">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'dashboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutDashboard className="size-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('timesheet')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'timesheet' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock3 className="size-4" />
                <span>Timesheet</span>
              </button>
              {/*
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'projects' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderKanban className="size-4" />
                <span>Projects</span>
              </button>
              */}
              <button
                onClick={() => setActiveTab('registrar')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'registrar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="size-4" />
                <span>Registrar</span>
              </button>
              <button
                onClick={() => setActiveTab('evaluations')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'evaluations' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Award className="size-4" />
                <span>My Evals</span>
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'profile' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCircle className="size-4" />
                <span>Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Dashboard Dashboard Overview */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          {/* Quick Stats Summary Widgets */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Timesheet Status
                </CardTitle>
                <Clock className="size-4.5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {timesheetPendingCount > 0 ? `${timesheetPendingCount} Pending` : 'Up-to-date'}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Logs submitted for this week range
                </p>
              </CardContent>
            </Card>

            {/*
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Assigned Projects
                </CardTitle>
                <FolderKanban className="size-4.5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Active project allocations
                </p>
              </CardContent>
            </Card>
            */}

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Expiring Bonds / Overdue
                </CardTitle>
                <AlertTriangle className="size-4.5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {expiringBonds.length + overdueCorrespondence.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Require immediate attention
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Performance level
                </CardTitle>
                <Award className="size-4.5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {lastEvaluation ? lastEvaluation.performance_level : '—'}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Latest review period rating
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* Quick Actions Panel */}
            <Card className="md:col-span-1 shadow-sm border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
                <CardDescription>Common contract workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <Button onClick={() => setActiveTab('timesheet')} className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <Clock3 className="size-4" />
                  Submit Weekly Timesheet
                </Button>
                <EmployeeReportPanel
                  variant="outline"
                  label="Export Work Log Report (.xlsx)"
                  mobileLabel="Export Log"
                  className="w-full justify-start text-xs font-semibold h-10 gap-2"
                />
                <Button onClick={() => { setActiveTab('registrar'); setRegistrarSubTab('correspondence') }} variant="secondary" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <FileText className="size-4" />
                  Add Correspondence
                </Button>
                <Button onClick={() => { setActiveTab('registrar'); setRegistrarSubTab('bonds') }} variant="secondary" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <Layers className="size-4" />
                  Register Bond
                </Button>
                <Button onClick={() => { setActiveTab('registrar'); setRegistrarSubTab('eot') }} variant="secondary" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <Calendar className="size-4" />
                  Submit EOT Request
                </Button>
                {/*
                <Button onClick={() => setActiveTab('projects')} variant="outline" className="w-full justify-start text-xs font-semibold h-10 gap-2">
                  <FolderKanban className="size-4" />
                  Update Project Progress
                </Button>
                */}
              </CardContent>
            </Card>

            {/* Dashboard Widgets List */}
            <div className="md:col-span-2 flex flex-col gap-6">
              {/* Assigned Projects Widget 
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FolderKanban className="size-4 text-emerald-500" />
                    My Active Assigned Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {projectsLoading ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
                  ) : projects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">No active assignments found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Project Name</TableHead>
                            <TableHead className="w-24">Progress</TableHead>
                            <TableHead className="w-24">Priority</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projects.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs font-bold">{p.code}</TableCell>
                              <TableCell className="text-xs font-medium">{p.name}</TableCell>
                              <TableCell className="text-xs font-bold text-emerald-600">{Number(p.progress_percentage || 0)}%</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  p.priority === 'High' ? 'bg-rose-100 text-rose-800'
                                  : p.priority === 'Medium' ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {p.priority || 'Medium'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
              */}

              {/* Recent Correspondence and Manager Comments */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <AlertTriangle className="size-4 text-rose-500" />
                    Recent Manager Comments &amp; Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentComments.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6">No recent comments or returned alerts.</div>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {recentComments.map((comment, i) => (
                        <li key={i} className="flex gap-2 text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded-lg border-l-2 border-rose-400">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-500" />
                          <span>{comment}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Weekly Timesheet */}
      {activeTab === 'timesheet' && (
        <div className="flex flex-col gap-4">
          {/* Week Navigator Bar — matches screenshot top bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek(-1)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                title="Previous Week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <span className="block text-sm font-semibold leading-tight text-foreground">
                  {new Date(monday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}–{' '}
                  {new Date(sunday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[11px] text-muted-foreground">Reporting week range</span>
              </div>
              <button
                onClick={() => navigateWeek(1)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                title="Next Week"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {draftSaved && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Save className="size-3" /> Draft saved
                </span>
              )}
              <EmployeeReportPanel
                variant="outline"
                label="Export Work Log"
                mobileLabel="Export"
                className="h-9 px-3 text-xs"
              />
              <Button
                variant="outline"
                onClick={() => setReferenceDate(new Date())}
                className="h-9 px-4 text-xs"
              >
                Current Week
              </Button>
              <Button
                onClick={handleSaveTimesheet}
                disabled={savingTimesheet || timesheetLoading}
                className="h-9 px-5 font-semibold text-xs"
              >
                {savingTimesheet ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Saving...</>
                ) : (
                  'Save & Submit Timesheet'
                )}
              </Button>
            </div>
          </div>

          {/* Timesheet Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
            {timesheetLoading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading timesheet...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground whitespace-nowrap w-40">Day / Date</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground whitespace-nowrap w-36">Office Hours</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground w-52">Assigned Tasks *</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground w-52">Actual Work Done *</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-foreground whitespace-nowrap w-16">Hours</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-foreground whitespace-nowrap w-16">Onsite</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground whitespace-nowrap w-36">Completion</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-foreground whitespace-nowrap w-12">WFG</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground whitespace-nowrap w-28">Remark</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-foreground whitespace-nowrap w-20">Status</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-foreground whitespace-nowrap w-14">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localRows.map((row, idx) => {
                      const isWeeklyTask = weeklyTasks.some((t: any) => 
                        (t.task_description && t.task_description === row.assigned_tasks)
                      )
                      const locked = isRowLocked(row)
                      const fieldLocked = locked || isWeeklyTask
                      const completionPct = Math.round(row.completion_percentage * 100)
                      // Group rows by date — only show day cell for first row of each date
                      const isFirstRowOfDate = idx === 0 || localRows[idx - 1].log_date !== row.log_date
                      const rowsForDate = localRows.filter(r => r.log_date === row.log_date)
                      const isSaturday = new Date(row.log_date).getDay() === 6

                      return (
                        <tr
                          key={idx}
                          className={`border-b border-border transition-colors ${
                            row.approval_status === 'Approved'
                              ? 'bg-emerald-50/30 dark:bg-emerald-950/20'
                              : row.approval_status === 'Returned'
                              ? 'bg-rose-50/30 dark:bg-rose-950/20'
                              : 'hover:bg-muted/30'
                          }`}
                        >
                          {/* Day / Date cell — merged for multi-rows */}
                          {isFirstRowOfDate ? (
                            <td className="py-4 px-4 align-top" rowSpan={rowsForDate.length}>
                              <div className="font-bold text-[13px] text-foreground leading-tight">
                                {new Date(row.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{row.log_date}</div>
                              {row.head_comments && (
                                <div className="mt-2 text-[10px] text-rose-600 bg-rose-50 border-l-2 border-rose-400 px-1.5 py-1 rounded leading-snug">
                                  <strong>Comment:</strong> {row.head_comments}
                                </div>
                              )}
                            </td>
                          ) : null}

                          {/* Office Hours with Task Selection */}
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-col gap-2">
                              {!locked && (
                                <Select onValueChange={(v: any) => typeof v === 'string' && handleWeeklyTaskSelect(idx, v)}>
                                  <SelectTrigger className="h-7 text-xs font-semibold bg-background border border-primary/30 text-primary">
                                    <SelectValue placeholder="Select Plan..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {weeklyTasks.length > 0 ? (
                                      weeklyTasks.map((t: any) => (
                                        <SelectItem key={t.id} value={t.id.toString()}>
                                          {t.task_code ? `${t.task_code} - ` : ''}{t.task_description.substring(0, 30)}{t.task_description.length > 30 ? '...' : ''}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <div className="py-2 px-2 text-xs text-muted-foreground text-center">No assigned plans</div>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                              {isFirstRowOfDate && (
                                <div className="flex flex-col gap-1.5 pt-1">
                                  <TimePickerCell
                                    value={row.office_entrance_time}
                                    onChange={(v) => handleInputChange(idx, 'office_entrance_time', v)}
                                    locked={true}
                                    label="entrance time"
                                  />
                                  <TimePickerCell
                                    value={row.office_leave_time}
                                    onChange={(v) => handleInputChange(idx, 'office_leave_time', v)}
                                    locked={true}
                                    label="leave time"
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Assigned Tasks */}
                          <td className="py-3 px-3 align-top">
                            <textarea
                              value={row.assigned_tasks}
                              onChange={(e) => handleInputChange(idx, 'assigned_tasks', e.target.value)}
                              disabled={fieldLocked}
                              placeholder="Tasks assigned (markdown list...)"
                              rows={3}
                              className="w-full text-xs p-1.5 rounded-md border border-input bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed leading-relaxed font-medium"
                            />
                            {isWeeklyTask && (
                              <div className="text-[10px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                                <Lock className="size-3" /> Assigned Plan (Uneditable)
                              </div>
                            )}
                            {!fieldLocked && (
                              <button
                                type="button"
                                onClick={() => correctFieldText(idx, 'assigned_tasks')}
                                disabled={correctingKey === `${idx}-assigned_tasks`}
                                className="flex items-center gap-1 text-[10px] text-primary mt-0.5 hover:underline"
                              >
                                {correctingKey === `${idx}-assigned_tasks` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                Fix with AI
                              </button>
                            )}
                          </td>

                          {/* Actual Work Done */}
                          <td className="py-3 px-3 align-top">
                            <textarea
                              value={row.actual_work_done}
                              onChange={(e) => handleInputChange(idx, 'actual_work_done', e.target.value)}
                              disabled={locked}
                              placeholder="Work accomplished (markdown list...)"
                              rows={3}
                              className="w-full text-xs p-1.5 rounded-md border border-input bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
                            />
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => correctFieldText(idx, 'actual_work_done')}
                                disabled={correctingKey === `${idx}-actual_work_done`}
                                className="flex items-center gap-1 text-[10px] text-primary mt-0.5 hover:underline"
                              >
                                {correctingKey === `${idx}-actual_work_done` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                Fix with AI
                              </button>
                            )}
                          </td>

                          {/* Hours Worked */}
                          <td className="py-3 px-2 align-top text-center font-mono text-xs">
                            <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-1 text-[11px] font-semibold text-foreground border border-border/50">
                              {row.hours_worked ?? (isSaturday ? 4 : 8)}h
                            </span>
                          </td>

                          {/* Onsite (actual_working_hour) */}
                          <td className="py-3 px-2 align-top text-center font-mono text-xs">
                            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              {row.actual_working_hour ?? (isSaturday ? 4 : 8)}h
                            </span>
                          </td>

                          {/* Completion slider */}
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-col gap-1 min-w-[110px]">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={completionPct}
                                onChange={(e) => handleInputChange(idx, 'completion_percentage', parseFloat(e.target.value) / 100)}
                                disabled={locked}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
                              />
                              <span className="text-[11px] font-bold text-amber-600 text-right">{completionPct}%</span>
                            </div>
                          </td>

                          {/* WFG (Work From Home / done_at_home) */}
                          <td className="py-3 px-2 align-top text-center">
                            <input
                              type="checkbox"
                              checked={row.done_at_home}
                              onChange={(e) => handleInputChange(idx, 'done_at_home', e.target.checked)}
                              disabled={locked}
                              className="size-4 rounded border-input accent-primary cursor-pointer disabled:opacity-50"
                            />
                          </td>

                          {/* Remark */}
                          <td className="py-3 px-3 align-top">
                            <textarea
                              value={row.remark}
                              onChange={(e) => handleInputChange(idx, 'remark', e.target.value)}
                              disabled={locked}
                              placeholder="Notes..."
                              rows={2}
                              className="w-full text-xs p-1.5 rounded-md border border-input bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Status badge */}
                          <td className="py-3 px-3 align-top">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                              row.approval_status === 'Approved'
                                ? 'text-emerald-700'
                                : row.approval_status === 'Returned'
                                ? 'text-rose-700'
                                : 'text-amber-600'
                            }`}>
                              {row.approval_status}
                            </span>
                          </td>

                          {/* Action (+/remove) */}
                          <td className="py-3 px-2 align-top text-center">
                            {!locked && (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => addSplitTaskRow(row.log_date)}
                                  title="Add split row"
                                  className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                                {typeof row.id === 'string' && row.id.startsWith('temp_') && (
                                  <button
                                    onClick={() => removeRow(idx)}
                                    title="Remove row"
                                    className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            {locked && row.approval_status !== 'Approved' && (
                              <Lock className="size-3.5 text-muted-foreground mx-auto" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Update Assigned Projects 
      {activeTab === 'projects' && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Assigned Projects</CardTitle>
              <CardDescription>Select a project to update progress.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-1">
              {projects.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6">No projects assigned yet.</div>
              ) : (
                projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-1.5 ${
                      selectedProjectId === p.id ? 'border-primary bg-primary/5 font-bold shadow-sm' : 'border-border bg-background hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{p.code}</span>
                      <span className="text-emerald-600 font-bold">{p.progress_percentage || 0}%</span>
                    </div>
                    <div className="font-medium text-foreground truncate">{p.name}</div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Update Progress</CardTitle>
              <CardDescription>Update active project metrics &amp; remarks.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedProjectId ? (
                <div className="text-center text-xs text-muted-foreground py-20 bg-muted/10 rounded-lg border border-dashed">
                  Please select a project from the left sidebar.
                </div>
              ) : (
                <form onSubmit={handleUpdateProject} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="prog-val">Progress Percentage: {projectProgress}%</Label>
                    <input
                      id="prog-val"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={projectProgress}
                      onChange={(e) => setProjectProgress(parseInt(e.target.value) || 0)}
                      className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="proj-pri">Priority</Label>
                      <Select value={projectPriority} onValueChange={(val: any) => setProjectPriority(val || '')}>
                        <SelectTrigger id="proj-pri">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="proj-status">Status</Label>
                      <Select value={projectStatus} onValueChange={(val: any) => setProjectStatus(val || '')}>
                        <SelectTrigger id="proj-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="proj-notes">Project Remarks &amp; Updates</Label>
                    <textarea
                      id="proj-notes"
                      value={projectNotes}
                      onChange={(e) => setProjectNotes(e.target.value)}
                      placeholder="Add weekly remarks, challenges, or milestones..."
                      rows={4}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <Button type="submit" disabled={updatingProj} className="sm:self-start">
                    {updatingProj ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                    Save Project Updates
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      */}

      {/* Tab 4: Registrar module */}
      {activeTab === 'registrar' && (
        <div className="flex flex-col gap-6">
          {/* Registrar sub-tab nav — scrollable on mobile */}
          <div className="overflow-x-auto -mx-0 pb-0.5">
            <div className="flex border-b border-border gap-1 min-w-max">
            <button
              onClick={() => { setRegistrarSubTab('correspondence'); setEditId(null) }}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                registrarSubTab === 'correspondence' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Correspondence
            </button>
            <button
              onClick={() => { setRegistrarSubTab('bonds'); setEditId(null) }}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                registrarSubTab === 'bonds' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Guarantee Bonds
            </button>
            <button
              onClick={() => { setRegistrarSubTab('eot'); setEditId(null) }}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                registrarSubTab === 'eot' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              EOT Claims
            </button>
          </div>
          </div>

          {/* ── CORRESPONDENCE ── */}
          {registrarSubTab === 'correspondence' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Form panel */}
              <div className="lg:col-span-1 rounded-xl border border-border bg-card shadow-sm p-5 h-fit">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">
                    {editId ? 'Edit Correspondence' : 'Register Correspondence'}
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">Store incoming/outgoing letters in the database.</p>
                <form onSubmit={handleCorrespondenceSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="c-ref" className="text-xs font-semibold">Letter Reference No *</Label>
                    <Input id="c-ref" placeholder="e.g. EF/2974/2026" value={corrRef} onChange={(e) => setCorrRef(e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="c-date" className="text-xs font-semibold">Date Logged *</Label>
                      <Input id="c-date" type="date" value={corrDate} onChange={(e) => setCorrDate(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="c-dir" className="text-xs font-semibold">Direction *</Label>
                      <Select value={corrDirection} onValueChange={(val: any) => setCorrDirection(val)}>
                        <SelectTrigger id="c-dir"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Incoming">Incoming</SelectItem>
                          <SelectItem value="Outgoing">Outgoing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="c-party" className="text-xs font-semibold">Counterparty *</Label>
                    <Input id="c-party" placeholder="e.g. Mattu University or TNT Construction" value={corrCounterparty} onChange={(e) => setCorrCounterparty(e.target.value)} required />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="c-subj" className="text-xs font-semibold">Subject *</Label>
                    <Input id="c-subj" placeholder="Brief summary of topic" value={corrSubject} onChange={(e) => setCorrSubject(e.target.value)} required />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="c-cat" className="text-xs font-semibold">Category *</Label>
                    <Select value={corrCategory} onValueChange={(val: any) => setCorrCategory(val)}>
                      <SelectTrigger id="c-cat"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="NOC">NOC</SelectItem>
                        <SelectItem value="RFI">RFI</SelectItem>
                        <SelectItem value="EOT Claim">EOT Claim</SelectItem>
                        <SelectItem value="Variation">Variation</SelectItem>
                        <SelectItem value="Payment">Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Response Required checkbox — styled as a bordered row */}
                  <label htmlFor="c-resp" className="flex items-center gap-2 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      id="c-resp"
                      type="checkbox"
                      checked={corrRespRequired}
                      onChange={(e) => setCorrRespRequired(e.target.checked)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">Response Action Required</span>
                  </label>

                  {/* Conditional fields when Response Required */}
                  {corrRespRequired && (
                    <>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="c-due" className="text-xs font-semibold">Response Due Date <span className="text-muted-foreground font-normal">(Auto-generated 7d)</span></Label>
                        <Input id="c-due" type="date" value={corrDueDate} onChange={(e) => setCorrDueDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="c-linked" className="text-xs font-semibold">Linked Response Ref <span className="text-muted-foreground font-normal">(Cross-Reference)</span></Label>
                        <Input id="c-linked" placeholder="References answering letter" value={corrLinkedRef} onChange={(e) => setCorrLinkedRef(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="c-sent" className="text-xs font-semibold">Response Sent Date</Label>
                        <Input id="c-sent" type="date" value={corrSentDate} onChange={(e) => setCorrSentDate(e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* When Response NOT required, still show Linked Ref */}
                  {!corrRespRequired && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="c-linked2" className="text-xs font-semibold">Linked Response Ref <span className="text-muted-foreground font-normal">(Cross-Reference)</span></Label>
                      <Input id="c-linked2" placeholder="References answering letter" value={corrLinkedRef} onChange={(e) => setCorrLinkedRef(e.target.value)} />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button type="submit" className="flex-1 font-bold">
                      {editId ? 'Save Letter' : 'Register Letter'}
                    </Button>
                    {editId && (
                      <Button type="button" variant="outline" onClick={clearCorrespondenceForm}>Cancel</Button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right panel — Active Mailbox Registry */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
                <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Active Mailbox Registry</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Live entries streamed from Supabase</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportDownload('/api/registrar/export-correspondence', 'Correspondence_Report.xlsx')}>
                      <FileText className="size-3.5" /> Export Log
                    </Button>
                    <button onClick={() => handleRefresh(mutateCorr, 'Correspondence log')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {correspondence.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-16">No letters registered yet. Create one above.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref No</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Counterparty</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {correspondence.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs font-bold">{c.letter_ref_no}</TableCell>
                            <TableCell className="text-xs max-w-[160px] truncate">{c.subject}</TableCell>
                            <TableCell className="text-xs">{c.counterparty}</TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                c.direction === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                              }`}>{c.direction}</span>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{c.date_logged}</TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                c.status === 'Closed' ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'Overdue' ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : 'bg-blue-100 text-blue-800'
                              }`}>{c.status}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditId(c.id); setCorrRef(c.letter_ref_no); setCorrDate(c.date_logged)
                                    setCorrDirection(c.direction); setCorrCounterparty(c.counterparty)
                                    setCorrSubject(c.subject); setCorrCategory(c.category)
                                    setCorrRespRequired(!!c.response_required); setCorrDueDate(c.response_due_date || '')
                                    setCorrLinkedRef(c.linked_response_ref || ''); setCorrSentDate(c.response_sent_date || '')
                                  }}
                                  className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="size-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── GUARANTEE BONDS ── */}
          {registrarSubTab === 'bonds' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Form panel */}
              <div className="lg:col-span-1 rounded-xl border border-border bg-card shadow-sm p-5 h-fit">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">
                    {editId ? 'Edit Bond Entry' : 'Log Contractor Bond'}
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">Track Advance Payment or Performance bonds.</p>
                <form onSubmit={handleBondSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-emp" className="text-xs font-semibold">Employer Name *</Label>
                    <Input id="b-emp" list="unique-employers" placeholder="e.g. Bonga University" value={bondEmployer} onChange={(e) => setBondEmployer(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-proj" className="text-xs font-semibold">Project Name / Description *</Label>
                    <Input id="b-proj" list="bond-projects-list" placeholder="e.g. Teaching Hotel" value={bondProject} onChange={(e) => setBondProject(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-cont" className="text-xs font-semibold">Contractor *</Label>
                    <Input id="b-cont" list="bond-contractors-list" placeholder="Contractor Construction PLC" value={bondContractor} onChange={(e) => setBondContractor(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-email" className="text-xs font-semibold">Email Notification Address</Label>
                    <Input id="b-email" type="email" placeholder="Email to receive notifications (default: admin emails)" value={bondNotificationEmail} onChange={(e) => setBondNotificationEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-email-opt" className="text-xs font-semibold text-muted-foreground">Additional Email Address (Optional)</Label>
                    <Input id="b-email-opt" type="email" placeholder="Secondary email for CC" value={bondOptionalEmail} onChange={(e) => setBondOptionalEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-type" className="text-xs font-semibold">Bond Type *</Label>
                    <Select value={bondType} onValueChange={(val: any) => setBondType(val)}>
                      <SelectTrigger id="b-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Performance Bond">Performance Bond</SelectItem>
                        <SelectItem value="Advance Payment Bond">Advance Payment Bond</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="b-issue" className="text-xs font-semibold">Issue Date</Label>
                      <Input id="b-issue" type="date" value={bondIssueDate} onChange={(e) => setBondIssueDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="b-exp" className="text-xs font-semibold">Expiry Date *</Label>
                      <Input id="b-exp" type="date" value={bondExpiryDate} onChange={(e) => setBondExpiryDate(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-amount" className="text-xs font-semibold">Amount (ETB)</Label>
                    <Input id="b-amount" type="number" placeholder="e.g. 5000000.00" value={bondAmount} onChange={(e) => setBondAmount(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="b-status" className="text-xs font-semibold">Status *</Label>
                    <Select value={bondStatus} onValueChange={(val: any) => setBondStatus(val)}>
                      <SelectTrigger id="b-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Expired">Expired</SelectItem>
                        <SelectItem value="Released">Released</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" className="flex-1 font-bold">
                      {editId ? 'Save Bond' : 'Log Project Bond'}
                    </Button>
                    {editId && (
                      <Button type="button" variant="outline" onClick={clearBondForm}>Cancel</Button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right panel — Active Bonds Ledger */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
                <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Active Bonds Ledger</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Live active performance and payment guarantees</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${showBondFilters ? 'bg-secondary' : ''}`} onClick={() => setShowBondFilters(!showBondFilters)}>
                      <Filter className="size-3.5" /> Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportDownload('/api/registrar/export-bonds', 'Bonds_Report.xlsx')}>
                      <FileText className="size-3.5" /> Export Bonds Ledger
                    </Button>
                    <button onClick={() => handleRefresh(mutateBonds, 'Bonds ledger')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  {filteredBonds.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-16">No bonds found or matching filters.</div>
                  ) : (
                    <>
                      {showBondFilters && (
                        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border bg-secondary/10">
                          <Input placeholder="Filter Client..." value={bondFilterEmployer} onChange={e => setBondFilterEmployer(e.target.value)} className="h-8 text-xs w-36" />
                          <Input placeholder="Filter Project..." value={bondFilterProject} onChange={e => setBondFilterProject(e.target.value)} className="h-8 text-xs w-36" />
                          <Input placeholder="Filter Contractor..." value={bondFilterContractor} onChange={e => setBondFilterContractor(e.target.value)} className="h-8 text-xs w-36" />
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project / Contractor</TableHead>
                          <TableHead>Bond Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Expiry Date</TableHead>
                          <TableHead>Days Remaining</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBonds.map((b: any) => {
                          const today = new Date()
                          const expiry = new Date(b.expiry_date)
                          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                          const isOverdue = diff < 0
                          const isNearExpiry = diff >= 0 && diff <= 30
                          return (
                            <TableRow key={b.id}>
                              <TableCell>
                                <div className="font-bold text-xs text-foreground">{b.project_name}</div>
                                <div className="text-[11px] text-muted-foreground font-semibold">Client: {b.employer_name}</div>
                                <div className="text-[11px] text-muted-foreground">Contractor: {b.contractor_name}</div>
                              </TableCell>
                              <TableCell className="text-xs">{b.bond_type}</TableCell>
                              <TableCell className="text-xs font-semibold font-mono whitespace-nowrap">
                                {b.amount ? `${Number(b.amount).toLocaleString()} ETB` : '—'}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{b.expiry_date}</TableCell>
                              <TableCell>
                                {isOverdue ? (
                                  <span className="text-xs font-bold text-rose-600">{Math.abs(diff)} days OVERDUE</span>
                                ) : (
                                  <span className={`text-xs font-bold ${isNearExpiry ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                    {diff} days left
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  b.status === 'Active' ? 'bg-emerald-100 text-emerald-700'
                                  : b.status === 'Expired' ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                                }`}>{b.status}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditId(b.id); setBondEmployer(b.employer_name); setBondProject(b.project_name)
                                      setBondContractor(b.contractor_name); setBondType(b.bond_type)
                                      setBondIssueDate(b.issue_date || ''); setBondExpiryDate(b.expiry_date)
                                      setBondAmount(b.amount?.toString() || ''); setBondStatus(b.status)
                                      const emails = (b.assigned_manager_email || '').split(','); setBondNotificationEmail(emails[0] ? emails[0].trim() : ''); setBondOptionalEmail(emails[1] ? emails[1].trim() : '')
                                    }}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── EOT CLAIMS ── */}
          {registrarSubTab === 'eot' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Form panel */}
              <div className="lg:col-span-1 rounded-xl border border-border bg-card shadow-sm p-5 h-fit">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">
                    {editId ? 'Edit EOT Entry' : 'Log Approved EOT'}
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">Record Extension of Time approvals.</p>
                <form onSubmit={handleEotSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-client" className="text-xs font-semibold">Client / Employer *</Label>
                    <Input id="e-client" list="unique-employers" placeholder="e.g. Ministry of Education" value={eotClient} onChange={(e) => setEotClient(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-proj" className="text-xs font-semibold">Project Name *</Label>
                    <Input id="e-proj" list="eot-projects-list" placeholder="Project title" value={eotProject} onChange={(e) => setEotProject(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-cont" className="text-xs font-semibold">Contractor *</Label>
                    <Input id="e-cont" list="eot-contractors-list" placeholder="e.g. Abiy Construction" value={eotContractor} onChange={(e) => setEotContractor(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-email" className="text-xs font-semibold">Email Notification Address</Label>
                    <Input id="e-email" type="email" placeholder="Email to receive notifications (default: admin emails)" value={eotNotificationEmail} onChange={(e) => setEotNotificationEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-email-opt" className="text-xs font-semibold text-muted-foreground">Additional Email Address (Optional)</Label>
                    <Input id="e-email-opt" type="email" placeholder="Secondary email for CC" value={eotOptionalEmail} onChange={(e) => setEotOptionalEmail(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="e-num" className="text-xs font-semibold">EOT Claim No. *</Label>
                      <Input id="e-num" type="number" value={eotNum} onChange={(e) => setEotNum(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="e-days" className="text-xs font-semibold">Days Approved *</Label>
                      <Input id="e-days" type="number" value={eotDays} onChange={(e) => setEotDays(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-rev" className="text-xs font-semibold">Revised Completion Date *</Label>
                    <Input id="e-rev" type="date" value={eotRevDate} onChange={(e) => setEotRevDate(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-status" className="text-xs font-semibold">Approval Status *</Label>
                    <Select value={eotStatus} onValueChange={(val: any) => setEotStatus(val)}>
                      <SelectTrigger id="e-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-reason" className="text-xs font-semibold">Reason for EOT Extension *</Label>
                    <textarea
                      id="e-reason"
                      value={eotReason}
                      onChange={(e) => setEotReason(e.target.value)}
                      rows={3}
                      required
                      placeholder="Detail justification..."
                      className="w-full text-xs p-2 rounded-md border border-input bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" className="flex-1 font-bold">
                      {editId ? 'Save EOT' : 'Log EOT Entry'}
                    </Button>
                    {editId && (
                      <Button type="button" variant="outline" onClick={clearEotForm}>Cancel</Button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right panel — EOT Extension Logs */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
                <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">EOT Extension Logs</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Live approved Extension of Time metrics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${showEotFilters ? 'bg-secondary' : ''}`} onClick={() => setShowEotFilters(!showEotFilters)}>
                      <Filter className="size-3.5" /> Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportDownload('/api/registrar/export-eot', 'EOT_Report.xlsx')}>
                      <FileText className="size-3.5" /> Export EOT Log
                    </Button>
                    <button onClick={() => handleRefresh(mutateEots, 'EOT claims log')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  {filteredEots.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-16">No EOT entries found or matching filters.</div>
                  ) : (
                    <>
                      {showEotFilters && (
                        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border bg-secondary/10">
                          <Input placeholder="Filter Client..." value={eotFilterEmployer} onChange={e => setEotFilterEmployer(e.target.value)} className="h-8 text-xs w-36" />
                          <Input placeholder="Filter Project..." value={eotFilterProject} onChange={e => setEotFilterProject(e.target.value)} className="h-8 text-xs w-36" />
                          <Input placeholder="Filter Contractor..." value={eotFilterContractor} onChange={e => setEotFilterContractor(e.target.value)} className="h-8 text-xs w-36" />
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project / Contractor</TableHead>
                          <TableHead className="text-center">EOT No.</TableHead>
                          <TableHead className="text-center">Approved Days</TableHead>
                          <TableHead>Completion Date</TableHead>
                          <TableHead>Alert Status</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEots.map((e: any) => {
                          const today = new Date()
                          const compDate = new Date(e.revised_completion_date)
                          const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                          const alertLabel = diff < 0 ? 'Overdue' : diff <= 14 ? 'Nearly Expired' : diff <= 30 ? 'Expiring Soon' : 'On Track'
                          const alertClass = diff < 0 ? 'bg-rose-100 text-rose-700'
                            : diff <= 14 ? 'bg-amber-100 text-amber-700'
                            : diff <= 30 ? 'bg-orange-100 text-orange-700'
                            : 'bg-emerald-100 text-emerald-700'
                          return (
                            <TableRow key={e.id}>
                              <TableCell>
                                <div className="font-bold text-xs text-foreground">{e.project_name}</div>
                                <div className="text-[11px] text-muted-foreground font-semibold">Client: {e.client_name}</div>
                                <div className="text-[11px] text-muted-foreground">Contractor: {e.contractor_name}</div>
                              </TableCell>
                              <TableCell className="text-center text-xs font-bold">{e.eot_number}</TableCell>
                              <TableCell className="text-center text-xs font-semibold">{e.days_approved} days</TableCell>
                              <TableCell className="text-xs font-mono">{e.revised_completion_date}</TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${alertClass}`}>
                                  {alertLabel}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  e.status === 'Approved' ? 'bg-emerald-100 text-emerald-700'
                                  : e.status === 'Rejected' ? 'bg-rose-100 text-rose-700'
                                  : e.status === 'Under Review' ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                                }`}>{e.status}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditId(e.id); setEotClient(e.client_name); setEotProject(e.project_name)
                                      setEotContractor(e.contractor_name); setEotNum(e.eot_number?.toString() || '1')
                                      setEotDays(e.days_approved?.toString() || '0'); setEotRevDate(e.revised_completion_date)
                                      setEotStatus(e.status); setEotReason(e.reason_for_eot || '')
                                      const emails = (e.assigned_manager_email || '').split(','); setEotNotificationEmail(emails[0] ? emails[0].trim() : ''); setEotOptionalEmail(emails[1] ? emails[1].trim() : '')
                                    }}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tab 5: Evaluations */}
      {activeTab === 'evaluations' && (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="size-5 text-accent" />
                My Performance History
              </CardTitle>
              <CardDescription>Evaluations generated monthly by Contract Administration managers.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {evaluations.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12">No evaluation summaries available yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Review Period</TableHead>
                        <TableHead className="text-center">Total Score</TableHead>
                        <TableHead>Rating Level</TableHead>
                        <TableHead>Technical (40%)</TableHead>
                        <TableHead>Productivity (30%)</TableHead>
                        <TableHead>Punctuality (10%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs font-semibold font-mono">{e.evaluation_period_start} to {e.evaluation_period_end}</TableCell>
                          <TableCell className="text-xs font-bold text-center text-primary">{Number(e.total_score || 0).toFixed(1)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              e.performance_level === 'Outstanding' ? 'bg-emerald-100 text-emerald-800'
                              : e.performance_level === 'Very Good' || e.performance_level === 'Good' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {e.performance_level}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{Number(e.tech_competence_score || 0).toFixed(0)}%</TableCell>
                          <TableCell className="text-xs font-mono">{Number(e.productivity_score || 0).toFixed(0)}%</TableCell>
                          <TableCell className="text-xs font-mono">{Number(e.punctuality_score || 0).toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 6: Profile */}
      {activeTab === 'profile' && (
        <UserProfile
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          userRole={userRole}
          userDepartment={userDepartment}
          theme="employee"
        />
      )}
    </div>
  )
}
