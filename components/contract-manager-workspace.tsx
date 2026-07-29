'use client'
import React, { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Users,
  FolderKanban,
  FileStack,
  CheckCircle,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Layers,
  Calendar,
  Award,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Download,
  Search,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  LayoutDashboard,
  RotateCw,
  UserCircle,
  Mail,
  Clock,
  Inbox,
  BarChart2,
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
    console.error(`[ContractManagerWorkspace] API error ${res.status} for ${url}:`, json?.error)
    return json // return the error object — SWR won't throw, but we can inspect employeesError
  }
  return json
}

type Tab = 'dashboard' | 'timesheets' | 'projects' | 'registrar' | 'evaluations' | 'exports' | 'profile' | 'analytics'

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

export function ContractManagerWorkspace({
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

  // Core SWR data queries
  const { data: employeesData, error: employeesError, mutate: mutateEmployees } = useSWR<{ employees: any[] }>('/api/employees', fetcher)
  const { data: projectsData, mutate: mutateProjects } = useSWR<{ projects: any[] }>('/api/projects?all=1', fetcher)
  const { data: correspondenceData, mutate: mutateCorr } = useSWR('/api/correspondence', fetcher)
  const { data: bondsData, mutate: mutateBonds } = useSWR('/api/bonds', fetcher)
  const { data: eotsData, mutate: mutateEots } = useSWR('/api/eot', fetcher)
  const { data: evalsData, mutate: mutateEvals } = useSWR('/api/evaluations', fetcher)
  const { data: pendingLogsData, mutate: mutatePendingLogs } = useSWR<{ logs: any[] }>(
    '/api/daily-work-logs?pending=true',
    fetcher,
    { refreshInterval: 3_000 }
  )

  // Real-time listener for pending daily work logs & reviews changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('mgr-timesheets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_work_logs' },
        () => {
          mutatePendingLogs()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_work_log_reviews' },
        () => {
          mutatePendingLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mutatePendingLogs])

  const employees = useMemo(
    () => {
      const all = employeesData?.employees ?? []
      // Contract dept employees — exclude executive cross-dept roles
      return all.filter((e: any) =>
        e.role !== 'admin' && e.role !== 'dgm' && e.role !== 'gm'
      )
    },
    [employeesData]
  )
  const projects = projectsData?.projects ?? []
  const correspondence = correspondenceData?.correspondence ?? []
  const bonds = bondsData?.bonds ?? []
  const eots = eotsData?.eots ?? []
  const evaluations = evalsData?.evaluations ?? []
  const pendingLogs = pendingLogsData?.logs ?? []

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

  // Timesheet approval queue state
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [approvalComment, setApprovalComment] = useState('')
  const [reviewHours, setReviewHours] = useState<number>(8)
  const [reviewOnsiteHours, setReviewOnsiteHours] = useState<number>(8)
  const [submittingReview, setSubmittingReview] = useState(false)

  // Group pending daily logs by employee
  const groupedTimesheets = useMemo(() => {
    const map = new Map<string, {
      employeeId: string
      employeeName: string
      employeeEmail: string
      employeeRole: string
      logs: any[]
      totalLogs: number
      totalHours: number
      totalOnsiteHours: number
      startDate: string
      endDate: string
    }>()

    pendingLogs.forEach((log: any) => {
      const empId = log.employee_id || log.employees?.id || log.employees?.email || 'unknown'
      const empName = log.employees?.full_name || log.employees?.email?.split('@')[0] || 'Employee'
      const empEmail = log.employees?.email || ''
      const empRole = log.employees?.role || 'Employee'

      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          employeeName: empName,
          employeeEmail: empEmail,
          employeeRole: empRole,
          logs: [],
          totalLogs: 0,
          totalHours: 0,
          totalOnsiteHours: 0,
          startDate: log.log_date,
          endDate: log.log_date,
        })
      }

      const item = map.get(empId)!
      item.logs.push(log)
      item.totalLogs += 1
      item.totalHours += Number(log.hours_worked || 0)
      item.totalOnsiteHours += Number(log.actual_working_hour || 0)
      if (log.log_date < item.startDate) item.startDate = log.log_date
      if (log.log_date > item.endDate) item.endDate = log.log_date
    })

    map.forEach(group => {
      group.logs.sort((a, b) => a.log_date.localeCompare(b.log_date))
    })

    return Array.from(map.values())
  }, [pendingLogs])

  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [logEditsMap, setLogEditsMap] = useState<Record<number, {
    hours_worked: number
    actual_working_hour: number
    office_entrance_time: string
    office_leave_time: string
    head_comments: string
  }>>({})

  const handleToggleExpandEmployee = (empId: string, logs: any[]) => {
    if (expandedEmployeeId === empId) {
      setExpandedEmployeeId(null)
    } else {
      setExpandedEmployeeId(empId)
      const initialMap: Record<number, {
        hours_worked: number
        actual_working_hour: number
        office_entrance_time: string
        office_leave_time: string
        head_comments: string
      }> = {}
      logs.forEach(l => {
        const isSat = l.log_date ? new Date(l.log_date).getDay() === 6 : false
        const defaultH = isSat ? 4 : 8
        const entrance = l.office_entrance_time ? l.office_entrance_time.substring(0, 5) : '08:30'
        const leave = l.office_leave_time ? l.office_leave_time.substring(0, 5) : (isSat ? '12:30' : '17:30')
        const hw = (l.hours_worked != null && Number(l.hours_worked) > 0) ? Number(l.hours_worked) : ((l.actual_working_hour != null && Number(l.actual_working_hour) > 0) ? Number(l.actual_working_hour) : defaultH)
        const aw = (l.actual_working_hour != null && Number(l.actual_working_hour) > 0) ? Number(l.actual_working_hour) : hw
        initialMap[l.id] = {
          hours_worked: hw,
          actual_working_hour: aw,
          office_entrance_time: entrance,
          office_leave_time: leave,
          head_comments: l.head_comments || '',
        }
      })
      setLogEditsMap(initialMap)
    }
  }

  const handleLogEditChange = (logId: number, field: 'hours_worked' | 'actual_working_hour' | 'office_entrance_time' | 'office_leave_time' | 'head_comments', value: any) => {
    setLogEditsMap(prev => {
      const existing = prev[logId] ?? { hours_worked: 8, actual_working_hour: 8, office_entrance_time: '08:30', office_leave_time: '17:30', head_comments: '' }
      const updated = { ...existing, [field]: value }
      if (field === 'office_entrance_time' || field === 'office_leave_time') {
        const calcH = calcHoursFromTime(updated.office_entrance_time, updated.office_leave_time, false)
        updated.hours_worked = calcH
        updated.actual_working_hour = calcH
      }
      return { ...prev, [logId]: updated }
    })
  }

  const handleApproveSingleLog = async (logId: number) => {
    const edits = logEditsMap[logId]
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [
            {
              log_id: logId,
              approval_status: 'Approved',
              head_comments: edits?.head_comments || null,
              hours_worked: Number(edits?.hours_worked ?? 8),
              actual_working_hour: Number(edits?.actual_working_hour ?? 8),
              office_entrance_time: edits?.office_entrance_time || undefined,
              office_leave_time: edits?.office_leave_time || undefined,
            }
          ]
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Approval failed.')
      toast.success('Work log approved')
      mutatePendingLogs()
    } catch (err: any) {
      toast.error(err.message || 'Approval failed')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleReturnSingleLog = async (logId: number) => {
    const edits = logEditsMap[logId]
    if (!edits?.head_comments?.trim()) {
      toast.error('Comment required', { description: 'Please add a comment explaining why this log is being returned.' })
      return
    }
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [
            {
              log_id: logId,
              approval_status: 'Returned',
              head_comments: edits.head_comments,
              hours_worked: Number(edits?.hours_worked ?? 8),
              actual_working_hour: Number(edits?.actual_working_hour ?? 8),
              office_entrance_time: edits?.office_entrance_time || undefined,
              office_leave_time: edits?.office_leave_time || undefined,
            }
          ]
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Return failed.')
      toast.success('Work log returned to engineer')
      mutatePendingLogs()
    } catch (err: any) {
      toast.error(err.message || 'Return failed')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleApproveAllForEmployeeGroup = async (group: any) => {
    setSubmittingReview(true)
    try {
      const reviews = group.logs.map((log: any) => {
        const edits = logEditsMap[log.id]
        return {
          log_id: log.id,
          approval_status: 'Approved',
          head_comments: edits?.head_comments || null,
          hours_worked: Number(edits?.hours_worked ?? log.hours_worked ?? 8),
          actual_working_hour: Number(edits?.actual_working_hour ?? log.actual_working_hour ?? 8),
          office_entrance_time: edits?.office_entrance_time || undefined,
          office_leave_time: edits?.office_leave_time || undefined,
        }
      })
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Bulk approval failed.')
      toast.success(`Approved all ${group.totalLogs} daily logs for ${group.employeeName}`)
      setExpandedEmployeeId(null)
      mutatePendingLogs()
    } catch (err: any) {
      toast.error(err.message || 'Bulk approval failed')
    } finally {
      setSubmittingReview(false)
    }
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

  // Project assignments state
  const [selectedAssignEmployeeId, setSelectedAssignEmployeeId] = useState('')
  const [selectedAssignProjectCode, setSelectedAssignProjectCode] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Registrar subtab management
  const [registrarSubTab, setRegistrarSubTab] = useState<'correspondence' | 'bonds' | 'eot'>('correspondence')
  const [editId, setEditId] = useState<string | number | null>(null)

  // Correspondence form state
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

  // Bonds form state
  const [bondEmployer, setBondEmployer] = useState('')
  const [bondProject, setBondProject] = useState('')
  const [bondContractor, setBondContractor] = useState('')
  const [bondType, setBondType] = useState<'Advance Payment Bond' | 'Performance Bond'>('Performance Bond')
  const [bondIssueDate, setBondIssueDate] = useState('')
  const [bondExpiryDate, setBondExpiryDate] = useState('')
  const [bondAmount, setBondAmount] = useState('')
  const [bondStatus, setBondStatus] = useState<'Active' | 'Expired' | 'Released'>('Active')
  const [bondNotificationEmail, setBondNotificationEmail] = useState('')

  // EOT form state
  const [eotClient, setEotClient] = useState('')
  const [eotProject, setEotProject] = useState('')
  const [eotContractor, setEotContractor] = useState('')
  const [eotNum, setEotNum] = useState('1')
  const [eotDays, setEotDays] = useState('0')
  const [eotRevDate, setEotRevDate] = useState('')
  const [eotStatus, setEotStatus] = useState<'Approved' | 'Rejected' | 'Pending' | 'Under Review'>('Pending')
  const [eotReason, setEotReason] = useState('')
  const [eotNotificationEmail, setEotNotificationEmail] = useState('')

  // Evaluations form state
  const [evalEmployeeId, setEvalEmployeeId] = useState('')
  const [evalStart, setEvalStart] = useState('')
  const [evalEnd, setEvalEnd] = useState('')
  const [techScore, setTechScore] = useState('80')
  const [prodScore, setProdScore] = useState('80')
  const [puncScore, setPuncScore] = useState('80')
  const [commScore, setCommScore] = useState('80')
  const [repScore, setRepScore] = useState('80')
  const [adaptScore, setAdaptScore] = useState('80')
  const [submittingEval, setSubmittingEval] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number | string; tab: string } | null>(null)

  // ── Email alert modal states (mirrors DGM dashboard) ──────────────────────
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailType, setEmailType] = useState<'bond' | 'eot' | null>(null)
  const [emailItem, setEmailItem] = useState<any>(null)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const openEmailModal = (type: 'bond' | 'eot', item: any) => {
    const defaultRecipient = 'team@efae.com'
    const recipient = item.assigned_manager_email || defaultRecipient
    setEmailType(type)
    setEmailItem(item)
    setEmailRecipient(recipient)
    if (type === 'bond') {
      setEmailSubject(`ALERT: Expired Bond on Project "${item.project_name}"`)
      setEmailMessage(`Dear ${item.contractor_name},\n\nThis is a formal notification regarding the following expired contract bond:\n- Project Description: ${item.project_name}\n- Contractor Name: ${item.contractor_name}\n- Bond Type: ${item.bond_type}\n- Expiry Date: ${item.expiry_date}\n- Amount: ${item.amount ? Number(item.amount).toLocaleString() + ' ETB' : 'Not specified'}\n\nStatus Calculation:\nDue Date of ${item.expiry_date} has passed. This bond is currently ${item.days_overdue || 0} days OVERDUE.\n\nImmediate action is required to ensure contract security or process bond release.`)
    } else {
      setEmailSubject(`ATTENTION: Nearly Expired Timeline on Project "${item.project_name}"`)
      setEmailMessage(`Dear ${item.contractor_name},\n\nPlease review the revised contract timeline details:\n- Project Description: ${item.project_name}\n- Contractor Name: ${item.contractor_name}\n- Revised Completion Date: ${item.revised_completion_date} (EOT Approved)\n- Days Approved: ${item.days_approved} days\n- EOT Number: Claim #${item.eot_number}\n\nStatus Calculation:\nOnly ${item.days_remaining || 0} days remaining until deadline.\n\nPlease verify the contractor's on-site execution speed and execute necessary supervision actions.`)
    }
    setEmailModalOpen(true)
  }

  const handleSendEmailAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailRecipient.trim() || !emailSubject.trim() || !emailMessage.trim()) {
      toast.error('All fields are required.')
      return
    }
    setSendingEmail(true)
    try {
      const res = await fetch('/api/alerts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
          recipient: emailRecipient,
          subject: emailSubject,
          message: emailMessage,
          item: emailItem,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email alert')
      toast.success('Email alert sent successfully')
      setEmailModalOpen(false)
    } catch (err: any) {
      toast.error('Failed to send email alert', { description: err.message || 'Please try again.' })
    } finally {
      setSendingEmail(false)
    }
  }

  // Derive overdue bonds and nearly-expired EOTs for the dashboard alert panels
  const criticalExpiredBonds = useMemo(() => {
    const today = new Date()
    return bonds
      .filter((b: any) => b.status !== 'Released')
      .map((b: any) => {
        const diff = Math.ceil((today.getTime() - new Date(b.expiry_date).getTime()) / (1000 * 60 * 60 * 24))
        return { ...b, days_overdue: diff }
      })
      .filter((b: any) => b.days_overdue > 0)
  }, [bonds])

  const nearlyExpiredEots = useMemo(() => {
    const today = new Date()
    return eots
      .filter((e: any) => e.status === 'Approved')
      .map((e: any) => {
        const diff = Math.ceil((new Date(e.revised_completion_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { ...e, days_remaining: diff }
      })
      .filter((e: any) => e.days_remaining >= 0 && e.days_remaining <= 30)
  }, [eots])

  // ── Analytics derivations ─────────────────────────────────────────────────
  const bondStats = useMemo(() => {
    const today = new Date()
    const active = bonds.filter((b: any) => b.status === 'Active').length
    const expired = bonds.filter((b: any) => b.status === 'Expired').length
    const released = bonds.filter((b: any) => b.status === 'Released').length
    const total = bonds.length || 1

    // Expiry bands (active bonds only)
    const band0_30 = bonds.filter((b: any) => {
      if (b.status !== 'Active') return false
      const d = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
      return d >= 0 && d <= 30
    }).length
    const band31_60 = bonds.filter((b: any) => {
      if (b.status !== 'Active') return false
      const d = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
      return d > 30 && d <= 60
    }).length
    const band61_90 = bonds.filter((b: any) => {
      if (b.status !== 'Active') return false
      const d = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
      return d > 60 && d <= 90
    }).length
    const bandSafe = bonds.filter((b: any) => {
      if (b.status !== 'Active') return false
      const d = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
      return d > 90
    }).length

    // Bond type split
    const performanceBonds = bonds.filter((b: any) => b.bond_type === 'Performance Bond').length
    const advanceBonds = bonds.filter((b: any) => b.bond_type === 'Advance Payment Bond').length

    return { active, expired, released, total, band0_30, band31_60, band61_90, bandSafe, performanceBonds, advanceBonds }
  }, [bonds])

  const eotStats = useMemo(() => {
    const today = new Date()
    const approved = eots.filter((e: any) => e.status === 'Approved').length
    const pending = eots.filter((e: any) => e.status === 'Pending').length
    const underReview = eots.filter((e: any) => e.status === 'Under Review').length
    const rejected = eots.filter((e: any) => e.status === 'Rejected').length
    const total = eots.length || 1

    const avgDaysApproved = eots.length
      ? Math.round(eots.reduce((s: number, e: any) => s + Number(e.days_approved || 0), 0) / eots.length)
      : 0

    // Expiry urgency (approved EOTs only)
    const critical = eots.filter((e: any) => {
      if (e.status !== 'Approved') return false
      const d = Math.ceil((new Date(e.revised_completion_date).getTime() - today.getTime()) / 86400000)
      return d >= 0 && d <= 7
    }).length
    const high = eots.filter((e: any) => {
      if (e.status !== 'Approved') return false
      const d = Math.ceil((new Date(e.revised_completion_date).getTime() - today.getTime()) / 86400000)
      return d > 7 && d <= 30
    }).length
    const onTrack = eots.filter((e: any) => {
      if (e.status !== 'Approved') return false
      const d = Math.ceil((new Date(e.revised_completion_date).getTime() - today.getTime()) / 86400000)
      return d > 30
    }).length

    return { approved, pending, underReview, rejected, total, avgDaysApproved, critical, high, onTrack }
  }, [eots])

  const corrStats = useMemo(() => {
    const total = correspondence.length || 1
    const incoming = correspondence.filter((c: any) => c.direction === 'Incoming').length
    const outgoing = correspondence.filter((c: any) => c.direction === 'Outgoing').length
    const open = correspondence.filter((c: any) => c.status === 'Open').length
    const closed = correspondence.filter((c: any) => c.status === 'Closed').length
    const overdue = correspondence.filter((c: any) => c.status === 'Overdue').length

    // By category
    const categories = ['General', 'NOC', 'RFI', 'EOT Claim', 'Variation', 'Payment']
    const byCategory = categories.map(cat => ({
      label: cat,
      count: correspondence.filter((c: any) => c.category === cat).length,
    }))
    const maxCatCount = Math.max(...byCategory.map(c => c.count), 1)

    return { total, incoming, outgoing, open, closed, overdue, byCategory, maxCatCount }
  }, [correspondence])

  const evalStats = useMemo(() => {
    if (evaluations.length === 0) return {
      avg: 0, outstanding: 0, veryGood: 0, good: 0, needsImprovement: 0,
      byEmployee: [], dimensions: []
    }
    const avg = evaluations.reduce((s: number, e: any) => s + Number(e.total_score || 0), 0) / evaluations.length
    const outstanding = evaluations.filter((e: any) => e.performance_level === 'Outstanding').length
    const veryGood = evaluations.filter((e: any) => e.performance_level === 'Very Good').length
    const good = evaluations.filter((e: any) => e.performance_level === 'Good').length
    const needsImprovement = evaluations.filter((e: any) =>
      e.performance_level !== 'Outstanding' && e.performance_level !== 'Very Good' && e.performance_level !== 'Good'
    ).length

    // Latest eval per employee
    const latestByEmp = new Map<string, any>()
    evaluations.forEach((e: any) => {
      const key = e.employee_id || e.employees?.id
      if (!latestByEmp.has(key) || e.evaluation_period_end > latestByEmp.get(key).evaluation_period_end) {
        latestByEmp.set(key, e)
      }
    })
    const byEmployee = Array.from(latestByEmp.values()).map((e: any) => ({
      name: e.employees?.full_name || 'Unknown',
      score: Number(e.total_score || 0),
      level: e.performance_level || '—',
    }))

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

    return { avg, outstanding, veryGood, good, needsImprovement, byEmployee, dimensions }
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

  const timesheetStats = useMemo(() => {
    const queueSize = pendingLogs.length
    const totalEmployeesWithLogs = new Set(pendingLogs.map((l: any) => l.employee_id || l.employees?.id)).size
    const totalHoursPending = Math.round(pendingLogs.reduce((s: number, l: any) => s + Number(l.hours_worked || 0), 0))
    // Total staff count comes from the employees array — not just those with pending logs
    const totalStaff = employees.length
    return { queueSize, totalEmployeesWithLogs, totalHoursPending, totalStaff }
  }, [pendingLogs, employees])

  const handleOpenReview = (log: any) => {
    if (selectedLogId === log.id) {
      setSelectedLogId(null)
    } else {
      setSelectedLogId(log.id)
      setApprovalComment('')
      setReviewHours(Number(log.hours_worked ?? 8))
      setReviewOnsiteHours(Number(log.actual_working_hour ?? 8))
    }
  }

  // 1. Submit Timesheet Review
  const handleSubmitReview = async (logId: number, status: 'Approved' | 'Returned') => {
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [
            {
              log_id: logId,
              approval_status: status,
              head_comments: approvalComment,
              hours_worked: Number(reviewHours),
              actual_working_hour: Number(reviewOnsiteHours),
            }
          ]
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit review.')
      toast.success(`Timesheet log ${status.toLowerCase()} successfully`)
      setApprovalComment('')
      setSelectedLogId(null)
      mutatePendingLogs()
    } catch (err: any) {
      toast.error(err.message || 'Submit failed')
    } finally {
      setSubmittingReview(false)
    }
  }

  // 2. Project submission
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProject(true)
    const method = editingProjectId ? 'PATCH' : 'POST'
    const payload: any = {
      code: projectCode,
      name: projectName,
      client: projectClient,
      contractor: projectContractor,
      start_date: projectStart || null,
      estimated_completion: projectEnd || null,
      priority: projectPriority,
      status: projectStatus,
    }
    if (editingProjectId) payload.id = editingProjectId

    try {
      const res = await fetch('/api/projects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save project.')
      toast.success(editingProjectId ? 'Project updated' : 'Project registered successfully')
      clearProjectForm()
      mutateProjects()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setSavingProject(false)
    }
  }

  const clearProjectForm = () => {
    setEditingProjectId(null)
    setProjectCode('')
    setProjectName('')
    setProjectClient('')
    setProjectContractor('')
    setProjectStart('')
    setProjectEnd('')
    setProjectPriority('Medium')
    setProjectStatus('Active')
  }

  const handleEditProject = (p: any) => {
    setEditingProjectId(p.id)
    setProjectCode(p.code)
    setProjectName(p.name)
    setProjectClient(p.client || '')
    setProjectContractor(p.contractor || '')
    setProjectStart(p.start_date || '')
    setProjectEnd(p.estimated_completion || '')
    setProjectPriority(p.priority || 'Medium')
    setProjectStatus(p.status || 'Active')
  }

  // 3. Project Assignment Submission
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignEmployeeId || !selectedAssignProjectCode) return
    setAssigning(true)
    try {
      const res = await fetch('/api/employees/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedAssignEmployeeId,
          project_code: selectedAssignProjectCode,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign.')
      toast.success('Employee assigned to project successfully')
      setSelectedAssignEmployeeId('')
      setSelectedAssignProjectCode('')
      mutateEmployees()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setAssigning(false)
    }
  }

  // 4. Registrar Form Submissions
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
      assigned_manager_email: bondNotificationEmail || 'team@efae.com'
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
  }

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
      assigned_manager_email: eotNotificationEmail || 'team@efae.com'
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
  }

  // 5. Submit Evaluation
  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evalEmployeeId || !evalStart || !evalEnd) {
      toast.error('Employee and dates are required')
      return
    }
    setSubmittingEval(true)
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      employee_id: evalEmployeeId,
      evaluation_period_start: evalStart,
      evaluation_period_end: evalEnd,
      tech_competence_score: parseFloat(techScore) || 0,
      productivity_score: parseFloat(prodScore) || 0,
      punctuality_score: parseFloat(puncScore) || 0,
      communication_score: parseFloat(commScore) || 0,
      reporting_score: parseFloat(repScore) || 0,
      adaptability_score: parseFloat(adaptScore) || 0
    }
    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/evaluations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.')
      toast.success(editId ? 'Review updated' : 'Performance review logged successfully')
      clearEvaluationForm()
      mutateEvals()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setSubmittingEval(false)
    }
  }

  const clearEvaluationForm = () => {
    setEditId(null)
    setEvalEmployeeId('')
    setEvalStart('')
    setEvalEnd('')
    setTechScore('80')
    setProdScore('80')
    setPuncScore('80')
    setCommScore('80')
    setRepScore('80')
    setAdaptScore('80')
  }

  // 6. Delete helper
  const executeDeleteRecord = async (id: number | string, tab: string) => {
    const endpoints: any = {
      projects: '/api/projects',
      correspondence: '/api/correspondence',
      bonds: '/api/bonds',
      eot: '/api/eot',
      evaluations: '/api/evaluations',
    }
    const mutators: any = {
      projects: mutateProjects,
      correspondence: mutateCorr,
      bonds: mutateBonds,
      eot: mutateEots,
      evaluations: mutateEvals,
    }
    const loadingToastId = toast.loading('Deleting record...')
    try {
      const res = await fetch(endpoints[tab], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete.')
      toast.dismiss(loadingToastId)
      toast.success('Record deleted successfully')
      mutators[tab]()
    } catch (err: any) {
      toast.dismiss(loadingToastId)
      toast.error(err.message || 'Delete failed')
    }
  }

  const handleDeleteRecord = (id: number | string, tab: string) => {
    setDeleteConfirm({ id, tab })
  }

  // 7. Report Export Download Trigger
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
      toast.error(err?.message || 'Failed to export report')
    }
  }

  // Dashboard Stats Calculations
  const expiringBonds = useMemo(() => {
    const today = new Date()
    return bonds.filter((b: any) => {
      if (b.status === 'Released') return false
      const exp = new Date(b.expiry_date)
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    })
  }, [bonds])

  const pendingEOTCount = eots.filter((e: any) => e.status === 'Pending' || e.status === 'Under Review').length
  const overdueCorrCount = correspondence.filter((c: any) => c.status === 'Overdue').length

  const avgPerfScore = useMemo(() => {
    if (evaluations.length === 0) return 0
    return evaluations.reduce((sum: number, e: any) => sum + Number(e.total_score || 0), 0) / evaluations.length
  }, [evaluations])

  return (
    <div className="flex flex-col gap-6">
      {/* Premium Header Profile Block */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-amber-500/10 via-background to-background p-4 sm:p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-36 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Users className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg sm:text-2xl font-extrabold text-foreground leading-tight">
                  Manager control tower
                </h1>
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  {userRole}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Contract Administration &middot; Control Center Mode
              </p>
            </div>
          </div>

          {/* Tab nav — scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
            <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border w-max sm:w-full sm:flex-wrap min-w-0">
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
                onClick={() => setActiveTab('timesheets')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'timesheets' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileStack className="size-4" />
                <span>Sheets ({pendingLogs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'projects' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderKanban className="size-4" />
                <span>Projects</span>
              </button>
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
                <span>Evals</span>
              </button>
              <button
                onClick={() => setActiveTab('exports')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'exports' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Download className="size-4" />
                <span>Export</span>
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
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'analytics' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart2 className="size-4" />
                <span>Analytics</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Dashboard Dashboard Metrics */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Pending Timesheets
                </CardTitle>
                <FileStack className="size-4.5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">{pendingLogs.length}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Logs awaiting manager review
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Pending EOTs
                </CardTitle>
                <Calendar className="size-4.5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-500">{pendingEOTCount}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  EOT claim requests under review
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Expiring Bonds / Overdue
                </CardTitle>
                <AlertTriangle className="size-4.5 text-rose-500 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-500">
                  {expiringBonds.length + overdueCorrCount}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Bonds expiring soon / overdue letters
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                  Avg Performance Score
                </CardTitle>
                <Award className="size-4.5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {avgPerfScore > 0 ? avgPerfScore.toFixed(1) : '—'}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Average monthly rating
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Project Progress Summary Widget */}
            <Card className="md:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FolderKanban className="size-4.5 text-amber-500" />
                  Active Project Workload &amp; Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">No active projects logged.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Project Name</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Completion Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs font-bold">{p.code}</TableCell>
                            <TableCell className="text-xs font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs">{p.client || '—'}</TableCell>
                            <TableCell className="w-48 align-middle">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                                  <div className="bg-primary h-full" style={{ width: `${p.progress_percentage || 0}%` }} />
                                </div>
                                <span className="text-xs font-bold font-mono">{Number(p.progress_percentage || 0)}%</span>
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

            {/* Department Workload widget */}
            <Card className="md:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4.5 text-primary" />
                  Department Workload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3.5">
                  {employees.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6">No staff profiles found.</div>
                  ) : (
                    employees.map((emp: any) => (
                      <div key={emp.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-foreground">{emp.full_name}</span>
                          <span className="text-muted-foreground text-[10px]">{emp.email}</span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                          {/* Workload score indicator */}
                          <div className="bg-amber-500 h-full" style={{ width: emp.active ? '100%' : '15%' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── HIGH-PRIORITY ALERT INBOX (Contract Admin Manager Email Alerts) ── */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            
            {/* Critical Bond Expiry (Red Alerts) */}
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 border-b border-border bg-gradient-to-r from-rose-500/5 to-transparent px-6 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-base font-bold text-rose-800 dark:text-rose-300">
                    Critical Bond Expired Alerts
                  </CardTitle>
                  <CardDescription className="text-xs text-rose-600/80 dark:text-rose-400/70">
                    Active current date exceeds bond expiry limits
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="max-h-[380px] overflow-y-auto p-0">
                {(!criticalExpiredBonds || criticalExpiredBonds.length === 0) ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                    <span className="flex size-12 items-center justify-center rounded-full bg-secondary/60">
                      <Inbox className="size-6" />
                    </span>
                    <p className="text-xs font-semibold">All logged bonds are safe.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {criticalExpiredBonds.map((bond: any) => (
                      <div key={bond.id} className="flex items-start justify-between gap-4 p-4 transition-all hover:bg-rose-500/5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-rose-800">
                              {bond.bond_type}
                            </span>
                            <span className="max-w-[200px] truncate text-xs font-bold text-foreground">
                              {bond.project_name}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Contractor: <strong className="text-foreground">{bond.contractor_name}</strong> &middot; Employer: {bond.employer_name}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <Clock className="size-3" />
                            Due {new Date(bond.expiry_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {bond.days_overdue} days OVERDUE
                          </div>
                        </div>
                        <button
                          onClick={() => openEmailModal('bond', bond)}
                          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-rose-500 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-600"
                          title="Send Overdue Notification Email"
                        >
                          <Mail className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nearly Expired Contract Time (Yellow Alerts) */}
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 border-b border-border bg-gradient-to-r from-amber-500/5 to-transparent px-6 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Clock className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-base font-bold text-amber-800 dark:text-amber-300">
                    Nearly Expired Contract Timeline
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-600/80 dark:text-amber-400/70">
                    Approved EOT extensions expiring within 30 days
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="max-h-[380px] overflow-y-auto p-0">
                {(!nearlyExpiredEots || nearlyExpiredEots.length === 0) ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                    <span className="flex size-12 items-center justify-center rounded-full bg-secondary/60">
                      <Inbox className="size-6" />
                    </span>
                    <p className="text-xs font-semibold">No critical timelines expiring soon.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {nearlyExpiredEots.map((eot: any) => (
                      <div key={eot.id} className="flex items-start justify-between gap-4 p-4 transition-all hover:bg-amber-500/5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                              Claim #{eot.eot_number}
                            </span>
                            <span className="max-w-[200px] truncate text-xs font-bold text-foreground">
                              {eot.project_name}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Contractor: <strong className="text-foreground">{eot.contractor_name}</strong> &middot; Approved: {eot.days_approved} days
                          </div>
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <AlertTriangle className="size-3" />
                            Expiring on {new Date(eot.revised_completion_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {eot.days_remaining} days left
                          </div>
                        </div>
                        <button
                          onClick={() => openEmailModal('eot', eot)}
                          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-amber-600 shadow-sm transition-all hover:bg-amber-50 hover:text-amber-700"
                          title="Send Expiry Alert Email"
                        >
                          <Mail className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Tab 2: Pending Timesheet Reviews */}
      {activeTab === 'timesheets' && (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">
                    Pending Employee Timesheets ({groupedTimesheets.length} Staff)
                  </CardTitle>
                  <CardDescription>
                    Review employee weekly timesheets grouped by staff member. Click an employee to inspect daily entries and set working hours.
                  </CardDescription>
                </div>
                {pendingLogs.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/20 w-max">
                    {pendingLogs.length} Total Pending Daily Logs
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {groupedTimesheets.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-20 bg-muted/10 rounded-b-lg">
                  No timesheets are currently pending review.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {groupedTimesheets.map(group => {
                    const isExpanded = expandedEmployeeId === group.employeeId
                    return (
                      <div key={group.employeeId} className="flex flex-col">
                        {/* Employee Group Header Row */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                              {group.employeeName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-foreground">{group.employeeName}</h3>
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                                  {group.employeeRole}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{group.employeeEmail}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex flex-col text-right">
                                <span className="font-semibold text-foreground">{group.totalLogs} Daily Logs</span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {group.startDate === group.endDate ? group.startDate : `${group.startDate} – ${group.endDate}`}
                                </span>
                              </div>
                              <div className="flex flex-col text-right border-l border-border pl-3">
                                <span className="font-bold text-emerald-600">{group.totalHours} hrs</span>
                                <span className="text-[10px] text-muted-foreground">({group.totalOnsiteHours} hrs onsite)</span>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant={isExpanded ? 'default' : 'outline'}
                              onClick={() => handleToggleExpandEmployee(group.employeeId, group.logs)}
                              className="text-xs font-semibold h-9 gap-1.5"
                            >
                              {isExpanded ? (
                                <>Collapse Sheet <ChevronUp className="size-4" /></>
                              ) : (
                                <>Review Sheet ({group.totalLogs}) <ChevronDown className="size-4" /></>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Daily Work Logs Detail Drawer */}
                        {isExpanded && (
                          <div className="bg-secondary/15 border-t border-b border-border p-4 sm:p-6 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Drawer Action Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                              <div>
                                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                                  Weekly Work Log Details for {group.employeeName}
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Review individual day logs, adjust working hours if necessary, and approve or return.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveAllForEmployeeGroup(group)}
                                  disabled={submittingReview}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                                >
                                  {submittingReview ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                  Approve All ({group.totalLogs} Logs)
                                </Button>
                              </div>
                            </div>

                            {/* Detailed Daily Work Logs Table */}
                            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                              <table className="w-full text-xs text-left min-w-[800px]">
                                <thead>
                                  <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
                                    <th className="py-2.5 px-3 w-28">Date</th>
                                    <th className="py-2.5 px-3 w-48">Assigned Tasks</th>
                                    <th className="py-2.5 px-3 w-48">Actual Work Done</th>
                                    <th className="py-2.5 px-3 text-center w-36">Office Hours (In / Out)</th>
                                    <th className="py-2.5 px-3 text-center w-44">Manager Set Hours</th>
                                    <th className="py-2.5 px-3 w-44">Review Remark</th>
                                    <th className="py-2.5 px-3 text-right w-36">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {group.logs.map((log: any) => {
                                    const isSat = log.log_date ? new Date(log.log_date).getDay() === 6 : false
                                    const defaultH = isSat ? 4 : 8
                                    const hw = (log.hours_worked != null && Number(log.hours_worked) > 0) ? Number(log.hours_worked) : ((log.actual_working_hour != null && Number(log.actual_working_hour) > 0) ? Number(log.actual_working_hour) : defaultH)
                                    const aw = (log.actual_working_hour != null && Number(log.actual_working_hour) > 0) ? Number(log.actual_working_hour) : hw
                                    const entrance = log.office_entrance_time ? log.office_entrance_time.substring(0, 5) : '08:30'
                                    const leave = log.office_leave_time ? log.office_leave_time.substring(0, 5) : (isSat ? '12:30' : '17:30')
                                    const edit = logEditsMap[log.id] || {
                                      hours_worked: hw,
                                      actual_working_hour: aw,
                                      office_entrance_time: entrance,
                                      office_leave_time: leave,
                                      head_comments: log.head_comments || '',
                                    }

                                    return (
                                      <tr key={log.id} className="hover:bg-muted/20 align-top">
                                        <td className="py-3 px-3 font-mono font-semibold whitespace-nowrap">
                                          <div>{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5">{log.log_date}</div>
                                        </td>
                                        <td className="py-3 px-3 leading-relaxed whitespace-pre-wrap max-w-xs">{log.assigned_tasks}</td>
                                        <td className="py-3 px-3 leading-relaxed whitespace-pre-wrap max-w-xs">{log.actual_work_done}</td>
                                        <td className="py-3 px-3 text-center font-mono text-[11px] whitespace-nowrap">
                                          <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-muted-foreground font-semibold">In:</span>
                                              <input
                                                type="time"
                                                value={edit.office_entrance_time}
                                                onChange={(e) => handleLogEditChange(log.id, 'office_entrance_time', e.target.value)}
                                                className="h-6 w-20 text-center text-[11px] font-mono rounded border border-border bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                              />
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-muted-foreground font-semibold">Out:</span>
                                              <input
                                                type="time"
                                                value={edit.office_leave_time}
                                                onChange={(e) => handleLogEditChange(log.id, 'office_leave_time', e.target.value)}
                                                className="h-6 w-20 text-center text-[11px] font-mono rounded border border-border bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex flex-col gap-1.5 min-w-[140px]">
                                            <div className="flex items-center justify-between gap-1 text-[10px]">
                                              <span className="text-muted-foreground font-semibold">Total Hrs:</span>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="24"
                                                step="0.5"
                                                value={edit.hours_worked}
                                                onChange={(e) => handleLogEditChange(log.id, 'hours_worked', parseFloat(e.target.value) || 0)}
                                                className="h-7 w-16 text-center text-xs font-mono font-bold px-1"
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-1 text-[10px]">
                                              <span className="text-muted-foreground font-semibold">Onsite Hrs:</span>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="24"
                                                step="0.5"
                                                value={edit.actual_working_hour}
                                                onChange={(e) => handleLogEditChange(log.id, 'actual_working_hour', parseFloat(e.target.value) || 0)}
                                                className="h-7 w-16 text-center text-xs font-mono font-bold text-emerald-600 px-1"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <Input
                                            value={edit.head_comments}
                                            onChange={(e) => handleLogEditChange(log.id, 'head_comments', e.target.value)}
                                            placeholder="Comments / Remarks..."
                                            className="h-8 text-xs"
                                          />
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <Button
                                              size="sm"
                                              onClick={() => handleApproveSingleLog(log.id)}
                                              disabled={submittingReview}
                                              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5"
                                              title="Approve single log"
                                            >
                                              Approve
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => handleReturnSingleLog(log.id)}
                                              disabled={submittingReview}
                                              className="h-7 font-bold text-[11px] px-2.5"
                                              title="Return single log with comments"
                                            >
                                              Return
                                            </Button>
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

      {/* Tab 3: Projects & Assignments Manager */}
      {activeTab === 'projects' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Create Project Form */}
            <Card className="lg:col-span-1 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {editingProjectId ? 'Edit Project' : 'Register Project'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProjectSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="p-code">Project Code *</Label>
                    <Input id="p-code" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} required placeholder="e.g. EF-2402" disabled={!!editingProjectId} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="p-name">Project Name *</Label>
                    <Input id="p-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required placeholder="e.g. Civic Center" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="p-client">Client Name</Label>
                    <Input id="p-client" value={projectClient} onChange={(e) => setProjectClient(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="p-contr">Contractor Name</Label>
                    <Input id="p-contr" value={projectContractor} onChange={(e) => setProjectContractor(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="p-start">Start Date</Label>
                      <Input id="p-start" type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="p-end">End Date</Label>
                      <Input id="p-end" type="date" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="p-pri">Priority</Label>
                      <Select value={projectPriority} onValueChange={(val: any) => setProjectPriority(val || '')}>
                        <SelectTrigger id="p-pri"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="p-status">Status</Label>
                      <Select value={projectStatus} onValueChange={(val: any) => setProjectStatus(val || '')}>
                        <SelectTrigger id="p-status"><SelectValue /></SelectTrigger>
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
                    {editingProjectId && (
                      <Button type="button" variant="outline" onClick={clearProjectForm}>Cancel</Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Assign Project to Employee */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="size-4.5 text-primary" />
                    Assign Project to Employee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAssignSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Label htmlFor="assign-emp">Select Employee</Label>
                      <Select value={selectedAssignEmployeeId} onValueChange={(val: any) => setSelectedAssignEmployeeId(val || '')}>
                        <SelectTrigger id="assign-emp">
                          <SelectValue placeholder="Choose employee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp: any) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <Label htmlFor="assign-proj">Select Project</Label>
                      <Select value={selectedAssignProjectCode} onValueChange={(val: any) => setSelectedAssignProjectCode(val || '')}>
                        <SelectTrigger id="assign-proj">
                          <SelectValue placeholder="Choose project..." />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.filter(p => p.active).map((proj: any) => (
                            <SelectItem key={proj.code} value={proj.code}>{proj.code} — {proj.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" disabled={assigning} className="h-10 font-bold shrink-0">
                      {assigning ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                      Assign Team Member
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Projects List */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Projects Directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile card view */}
                  <div className="flex flex-col divide-y divide-border md:hidden">
                    {projects.map((proj: any) => (
                      <div key={proj.id} className={`p-4 flex items-start justify-between gap-3 ${!proj.active ? 'opacity-50' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">{proj.code}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              proj.priority === 'High' ? 'bg-rose-100 text-rose-800'
                              : proj.priority === 'Medium' ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                            }`}>{proj.priority || 'Medium'}</span>
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-0.5">{proj.name}</div>
                          <div className="text-xs font-bold text-emerald-600 mt-0.5">{Number(proj.progress_percentage || 0)}% complete</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleEditProject(proj)} className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary"><Edit2 className="size-3.5" /></button>
                          <button onClick={() => handleDeleteRecord(proj.id, 'projects')} className="inline-flex size-8 items-center justify-center rounded-md border text-destructive hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Project Name</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((proj: any) => (
                          <TableRow key={proj.id} className={!proj.active ? 'opacity-50' : ''}>
                            <TableCell className="font-mono text-xs font-bold">{proj.code}</TableCell>
                            <TableCell className="text-xs font-semibold">{proj.name}</TableCell>
                            <TableCell className="text-xs font-bold text-emerald-600">{Number(proj.progress_percentage || 0)}%</TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                proj.priority === 'High' ? 'bg-rose-100 text-rose-800'
                                : proj.priority === 'Medium' ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                              }`}>
                                {proj.priority || 'Medium'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleEditProject(proj)} className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary"><Edit2 className="size-3.5" /></button>
                                <button onClick={() => handleDeleteRecord(proj.id, 'projects')} className="inline-flex size-8 items-center justify-center rounded-md border text-destructive hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
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

      {/* Tab 4: Registrar Administration */}
      {activeTab === 'registrar' && (
        <div className="flex flex-col gap-6">
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
                    <Label htmlFor="mc-ref" className="text-xs font-semibold">Letter Reference No *</Label>
                    <Input id="mc-ref" placeholder="e.g. EF/2974/2026" value={corrRef} onChange={(e) => setCorrRef(e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mc-date" className="text-xs font-semibold">Date Logged *</Label>
                      <Input id="mc-date" type="date" value={corrDate} onChange={(e) => setCorrDate(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mc-dir" className="text-xs font-semibold">Direction *</Label>
                      <Select value={corrDirection} onValueChange={(val: any) => setCorrDirection(val)}>
                        <SelectTrigger id="mc-dir"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Incoming">Incoming</SelectItem>
                          <SelectItem value="Outgoing">Outgoing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mc-party" className="text-xs font-semibold">Counterparty *</Label>
                    <Input id="mc-party" placeholder="e.g. Mattu University or TNT Construction" value={corrCounterparty} onChange={(e) => setCorrCounterparty(e.target.value)} required />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mc-subj" className="text-xs font-semibold">Subject *</Label>
                    <Input id="mc-subj" placeholder="Brief summary of topic" value={corrSubject} onChange={(e) => setCorrSubject(e.target.value)} required />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mc-cat" className="text-xs font-semibold">Category *</Label>
                    <Select value={corrCategory} onValueChange={(val: any) => setCorrCategory(val)}>
                      <SelectTrigger id="mc-cat"><SelectValue /></SelectTrigger>
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
                  <label htmlFor="mc-resp" className="flex items-center gap-2 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      id="mc-resp"
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
                        <Label htmlFor="mc-due" className="text-xs font-semibold">Response Due Date <span className="text-muted-foreground font-normal">(Auto-generated 7d)</span></Label>
                        <Input id="mc-due" type="date" value={corrDueDate} onChange={(e) => setCorrDueDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="mc-linked" className="text-xs font-semibold">Linked Response Ref <span className="text-muted-foreground font-normal">(Cross-Reference)</span></Label>
                        <Input id="mc-linked" placeholder="References answering letter" value={corrLinkedRef} onChange={(e) => setCorrLinkedRef(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="mc-sent" className="text-xs font-semibold">Response Sent Date</Label>
                        <Input id="mc-sent" type="date" value={corrSentDate} onChange={(e) => setCorrSentDate(e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* When Response NOT required, still show Linked Ref */}
                  {!corrRespRequired && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mc-linked2" className="text-xs font-semibold">Linked Response Ref <span className="text-muted-foreground font-normal">(Cross-Reference)</span></Label>
                      <Input id="mc-linked2" placeholder="References answering letter" value={corrLinkedRef} onChange={(e) => setCorrLinkedRef(e.target.value)} />
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
                    <>
                      {/* Mobile card view */}
                      <div className="flex flex-col divide-y divide-border md:hidden">
                        {correspondence.map((c: any) => (
                          <div key={c.id} className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold">{c.letter_ref_no}</span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.direction === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{c.direction}</span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' : c.status === 'Overdue' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>{c.status}</span>
                                </div>
                                <div className="text-sm font-medium text-foreground mt-0.5 line-clamp-1">{c.subject}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{c.counterparty} · {c.date_logged}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => { setEditId(c.id); setCorrRef(c.letter_ref_no); setCorrDate(c.date_logged); setCorrDirection(c.direction); setCorrCounterparty(c.counterparty); setCorrSubject(c.subject); setCorrCategory(c.category); setCorrRespRequired(!!c.response_required); setCorrDueDate(c.response_due_date || ''); setCorrLinkedRef(c.linked_response_ref || ''); setCorrSentDate(c.response_sent_date || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                <button onClick={() => handleDeleteRecord(c.id, 'correspondence')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden md:block">
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
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.direction === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{c.direction}</span>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{c.date_logged}</TableCell>
                                <TableCell>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' : c.status === 'Overdue' ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-blue-100 text-blue-800'}`}>{c.status}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button onClick={() => { setEditId(c.id); setCorrRef(c.letter_ref_no); setCorrDate(c.date_logged); setCorrDirection(c.direction); setCorrCounterparty(c.counterparty); setCorrSubject(c.subject); setCorrCategory(c.category); setCorrRespRequired(!!c.response_required); setCorrDueDate(c.response_due_date || ''); setCorrLinkedRef(c.linked_response_ref || ''); setCorrSentDate(c.response_sent_date || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                    <button onClick={() => handleDeleteRecord(c.id, 'correspondence')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
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
                    <Label htmlFor="mb-emp" className="text-xs font-semibold">Employer Name *</Label>
                    <Input id="mb-emp" placeholder="e.g. Bonga University" value={bondEmployer} onChange={(e) => setBondEmployer(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-proj" className="text-xs font-semibold">Project Name / Description *</Label>
                    <Input id="mb-proj" placeholder="e.g. Teaching Hotel" value={bondProject} onChange={(e) => setBondProject(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-cont" className="text-xs font-semibold">Contractor *</Label>
                    <Input id="mb-cont" placeholder="Contractor Construction PLC" value={bondContractor} onChange={(e) => setBondContractor(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-email" className="text-xs font-semibold">Email Notification Address</Label>
                    <Input id="mb-email" type="email" placeholder="Email to receive notifications (default: admin emails)" value={bondNotificationEmail} onChange={(e) => setBondNotificationEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-type" className="text-xs font-semibold">Bond Type *</Label>
                    <Select value={bondType} onValueChange={(val: any) => setBondType(val)}>
                      <SelectTrigger id="mb-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Performance Bond">Performance Bond</SelectItem>
                        <SelectItem value="Advance Payment Bond">Advance Payment Bond</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mb-issue" className="text-xs font-semibold">Issue Date</Label>
                      <Input id="mb-issue" type="date" value={bondIssueDate} onChange={(e) => setBondIssueDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mb-exp" className="text-xs font-semibold">Expiry Date *</Label>
                      <Input id="mb-exp" type="date" value={bondExpiryDate} onChange={(e) => setBondExpiryDate(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-amount" className="text-xs font-semibold">Amount (ETB)</Label>
                    <Input id="mb-amount" type="number" placeholder="e.g. 5000000.00" value={bondAmount} onChange={(e) => setBondAmount(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mb-status" className="text-xs font-semibold">Status *</Label>
                    <Select value={bondStatus} onValueChange={(val: any) => setBondStatus(val)}>
                      <SelectTrigger id="mb-status"><SelectValue /></SelectTrigger>
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
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportDownload('/api/registrar/export-bonds', 'Bonds_Report.xlsx')}>
                      <FileText className="size-3.5" /> Export Bonds Ledger
                    </Button>
                    <button onClick={() => handleRefresh(mutateBonds, 'Bonds ledger')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  {bonds.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-16">No bonds registered yet.</div>
                  ) : (
                    <>
                      {/* Mobile card view */}
                      <div className="flex flex-col divide-y divide-border md:hidden">
                        {bonds.map((b: any) => {
                          const today = new Date()
                          const expiry = new Date(b.expiry_date)
                          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                          const isOverdue = diff < 0
                          const isNearExpiry = diff >= 0 && diff <= 30
                          return (
                            <div key={b.id} className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-bold text-foreground">{b.project_name}</span>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${b.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : b.status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{b.contractor_name} · {b.bond_type}</div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                    <span className="font-mono font-semibold">{b.amount ? `${Number(b.amount).toLocaleString()} ETB` : '—'}</span>
                                    <span className="text-muted-foreground">Exp: {b.expiry_date}</span>
                                    {isOverdue ? (
                                      <span className="font-bold text-rose-600">{Math.abs(diff)}d OVERDUE</span>
                                    ) : (
                                      <span className={`font-bold ${isNearExpiry ? 'text-amber-600' : 'text-emerald-600'}`}>{diff}d left</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditId(b.id); setBondEmployer(b.employer_name); setBondProject(b.project_name); setBondContractor(b.contractor_name); setBondType(b.bond_type); setBondIssueDate(b.issue_date || ''); setBondExpiryDate(b.expiry_date); setBondAmount(b.amount?.toString() || ''); setBondStatus(b.status); setBondNotificationEmail(b.assigned_manager_email || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                  <button onClick={() => handleDeleteRecord(b.id, 'bonds')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden overflow-x-auto md:block">
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
                            {bonds.map((b: any) => {
                              const today = new Date()
                              const expiry = new Date(b.expiry_date)
                              const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                              const isOverdue = diff < 0
                              const isNearExpiry = diff >= 0 && diff <= 30
                              return (
                                <TableRow key={b.id}>
                                  <TableCell>
                                    <div className="font-bold text-xs text-foreground">{b.project_name}</div>
                                    <div className="text-[11px] text-muted-foreground">Contractor: {b.contractor_name}</div>
                                  </TableCell>
                                  <TableCell className="text-xs">{b.bond_type}</TableCell>
                                  <TableCell className="text-xs font-semibold font-mono whitespace-nowrap">{b.amount ? `${Number(b.amount).toLocaleString()} ETB` : '—'}</TableCell>
                                  <TableCell className="text-xs font-mono">{b.expiry_date}</TableCell>
                                  <TableCell>
                                    {isOverdue ? (
                                      <span className="text-xs font-bold text-rose-600">{Math.abs(diff)} days OVERDUE</span>
                                    ) : (
                                      <span className={`text-xs font-bold ${isNearExpiry ? 'text-amber-600' : 'text-muted-foreground'}`}>{diff} days left</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${b.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : b.status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button onClick={() => { setEditId(b.id); setBondEmployer(b.employer_name); setBondProject(b.project_name); setBondContractor(b.contractor_name); setBondType(b.bond_type); setBondIssueDate(b.issue_date || ''); setBondExpiryDate(b.expiry_date); setBondAmount(b.amount?.toString() || ''); setBondStatus(b.status); setBondNotificationEmail(b.assigned_manager_email || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                      <button onClick={() => handleDeleteRecord(b.id, 'bonds')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
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
                    <Label htmlFor="me-client" className="text-xs font-semibold">Client / Employer *</Label>
                    <Input id="me-client" placeholder="e.g. Ministry of Education" value={eotClient} onChange={(e) => setEotClient(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-proj" className="text-xs font-semibold">Project Name *</Label>
                    <Input id="me-proj" placeholder="Project title" value={eotProject} onChange={(e) => setEotProject(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-cont" className="text-xs font-semibold">Contractor *</Label>
                    <Input id="me-cont" placeholder="e.g. Abiy Construction" value={eotContractor} onChange={(e) => setEotContractor(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-email" className="text-xs font-semibold">Email Notification Address</Label>
                    <Input id="me-email" type="email" placeholder="Email to receive notifications (default: admin emails)" value={eotNotificationEmail} onChange={(e) => setEotNotificationEmail(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="me-num" className="text-xs font-semibold">EOT Claim No. *</Label>
                      <Input id="me-num" type="number" value={eotNum} onChange={(e) => setEotNum(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="me-days" className="text-xs font-semibold">Days Approved *</Label>
                      <Input id="me-days" type="number" value={eotDays} onChange={(e) => setEotDays(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-rev" className="text-xs font-semibold">Revised Completion Date *</Label>
                    <Input id="me-rev" type="date" value={eotRevDate} onChange={(e) => setEotRevDate(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-status" className="text-xs font-semibold">Approval Status *</Label>
                    <Select value={eotStatus} onValueChange={(val: any) => setEotStatus(val)}>
                      <SelectTrigger id="me-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="me-reason" className="text-xs font-semibold">Reason for EOT Extension *</Label>
                    <textarea
                      id="me-reason"
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
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportDownload('/api/registrar/export-eot', 'EOT_Report.xlsx')}>
                      <FileText className="size-3.5" /> Export EOT Log
                    </Button>
                    <button onClick={() => handleRefresh(mutateEots, 'EOT claims log')} className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
                      <RotateCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  {eots.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-16">No EOT entries yet.</div>
                  ) : (
                    <>
                      {/* Mobile card view */}
                      <div className="flex flex-col divide-y divide-border md:hidden">
                        {eots.map((e: any) => {
                          const today = new Date()
                          const compDate = new Date(e.revised_completion_date)
                          const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                          const alertLabel = diff < 0 ? 'Overdue' : diff <= 14 ? 'Nearly Expired' : diff <= 30 ? 'Expiring Soon' : 'On Track'
                          const alertClass = diff < 0 ? 'bg-rose-100 text-rose-700' : diff <= 14 ? 'bg-amber-100 text-amber-700' : diff <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                          const statusClass = e.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : e.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : e.status === 'Under Review' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          return (
                            <div key={e.id} className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-bold text-foreground">{e.project_name}</span>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>{e.status}</span>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${alertClass}`}>{alertLabel}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{e.contractor_name}</div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                    <span className="text-muted-foreground">EOT #{e.eot_number}</span>
                                    <span className="font-semibold text-foreground">{e.days_approved} days approved</span>
                                    <span className="text-muted-foreground">Due: {e.revised_completion_date}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditId(e.id); setEotClient(e.client_name); setEotProject(e.project_name); setEotContractor(e.contractor_name); setEotNum(e.eot_number?.toString() || '1'); setEotDays(e.days_approved?.toString() || '0'); setEotRevDate(e.revised_completion_date); setEotStatus(e.status); setEotReason(e.reason_for_eot || ''); setEotNotificationEmail(e.assigned_manager_email || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                  <button onClick={() => handleDeleteRecord(e.id, 'eot')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden overflow-x-auto md:block">
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
                            {eots.map((e: any) => {
                              const today = new Date()
                              const compDate = new Date(e.revised_completion_date)
                              const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                              const alertLabel = diff < 0 ? 'Overdue' : diff <= 14 ? 'Nearly Expired' : diff <= 30 ? 'Expiring Soon' : 'On Track'
                              const alertClass = diff < 0 ? 'bg-rose-100 text-rose-700' : diff <= 14 ? 'bg-amber-100 text-amber-700' : diff <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                              return (
                                <TableRow key={e.id}>
                                  <TableCell>
                                    <div className="font-bold text-xs text-foreground">{e.project_name}</div>
                                    <div className="text-[11px] text-muted-foreground">Contractor: {e.contractor_name}</div>
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-bold">{e.eot_number}</TableCell>
                                  <TableCell className="text-center text-xs font-semibold">{e.days_approved} days</TableCell>
                                  <TableCell className="text-xs font-mono">{e.revised_completion_date}</TableCell>
                                  <TableCell><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${alertClass}`}>{alertLabel}</span></TableCell>
                                  <TableCell>
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${e.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : e.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : e.status === 'Under Review' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button onClick={() => { setEditId(e.id); setEotClient(e.client_name); setEotProject(e.project_name); setEotContractor(e.contractor_name); setEotNum(e.eot_number?.toString() || '1'); setEotDays(e.days_approved?.toString() || '0'); setEotRevDate(e.revised_completion_date); setEotStatus(e.status); setEotReason(e.reason_for_eot || ''); setEotNotificationEmail(e.assigned_manager_email || '') }} className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:text-primary hover:bg-primary/5" title="Edit"><Edit2 className="size-3.5" /></button>
                                      <button onClick={() => handleDeleteRecord(e.id, 'eot')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50" title="Delete"><Trash2 className="size-3.5" /></button>
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
      {/* Tab 5: Evaluations Administration */}
      {activeTab === 'evaluations' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-base font-bold">Log Performance Review</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEvaluationSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-emp">Select Employee *</Label>
                  <Select value={evalEmployeeId} onValueChange={(val: any) => setEvalEmployeeId(val || '')}>
                    <SelectTrigger id="ev-emp">
                      <SelectValue placeholder="Choose staff..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-start">Start Date *</Label>
                    <Input id="ev-start" type="date" value={evalStart} onChange={(e) => setEvalStart(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-end">End Date *</Label>
                    <Input id="ev-end" type="date" value={evalEnd} onChange={(e) => setEvalEnd(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-tech" className="text-xs">Technical (40%)</Label>
                    <Input id="ev-tech" type="number" min="0" max="100" value={techScore} onChange={(e) => setTechScore(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-prod" className="text-xs">Productivity (30%)</Label>
                    <Input id="ev-prod" type="number" min="0" max="100" value={prodScore} onChange={(e) => setProdScore(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-punc" className="text-xs">Punctuality (10%)</Label>
                    <Input id="ev-punc" type="number" min="0" max="100" value={puncScore} onChange={(e) => setPuncScore(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-comm" className="text-xs">Communication (5%)</Label>
                    <Input id="ev-comm" type="number" min="0" max="100" value={commScore} onChange={(e) => setCommScore(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-rep" className="text-xs">Reporting (5%)</Label>
                    <Input id="ev-rep" type="number" min="0" max="100" value={repScore} onChange={(e) => setRepScore(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ev-adapt" className="text-xs">Adaptability (10%)</Label>
                    <Input id="ev-adapt" type="number" min="0" max="100" value={adaptScore} onChange={(e) => setAdaptScore(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" disabled={submittingEval} className="mt-2">
                  {submittingEval ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                  Log Evaluation
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Performance History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile card view */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="p-4 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{(e.employees ?? {}).full_name || '—'}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${e.performance_level === 'Outstanding' ? 'bg-emerald-100 text-emerald-800' : e.performance_level === 'Very Good' || e.performance_level === 'Good' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{e.performance_level}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.evaluation_period_start} to {e.evaluation_period_end}</div>
                      <div className="text-xs font-bold text-primary mt-0.5">Score: {Number(e.total_score || 0).toFixed(1)}</div>
                    </div>
                    <button onClick={() => handleDeleteRecord(e.id, 'evaluations')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50 shrink-0"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Review Period</TableHead>
                      <TableHead className="text-center">Total Score</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs font-semibold">{(e.employees ?? {}).full_name || '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{e.evaluation_period_start} to {e.evaluation_period_end}</TableCell>
                        <TableCell className="text-xs font-bold text-center text-primary">{Number(e.total_score || 0).toFixed(1)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${e.performance_level === 'Outstanding' ? 'bg-emerald-100 text-emerald-800' : e.performance_level === 'Very Good' || e.performance_level === 'Good' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {e.performance_level}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => handleDeleteRecord(e.id, 'evaluations')} className="inline-flex size-7 items-center justify-center rounded-md border text-destructive hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 6: Reports & Exports */}
      {activeTab === 'exports' && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          <Card className="sm:col-span-2 md:col-span-3 hover:shadow-md transition-shadow border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                <FileSpreadsheet className="size-5" />
                Master Consolidated Executive Excel Ledger
              </CardTitle>
              <CardDescription>
                Export all employee profiles, work logs, attendance hours, registrar letters, guarantee bonds, EOT claims, and performance scorecards in one comprehensive multi-sheet Excel workbook.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                Includes full multi-tab analysis: Staff Roster, Timesheet Logs, Bonds Ledger, EOT Claims, Correspondence Register &amp; Performance Scorecards.
              </div>
              <Button onClick={() => handleExportDownload('/api/export-master', 'EF_Master_Consolidated_Report.xlsx')} className="w-full sm:w-auto font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow">
                <Download className="size-4" />
                Export Master Excel (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Guarantee Bonds Ledger</CardTitle>
              <CardDescription>Export active and expired contractor guarantee bonds.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-bonds', 'Bonds_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />
                Download Bonds (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">EOT status Report</CardTitle>
              <CardDescription>Export Extension of Time (EOT) claim logs and alerts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-eot', 'EOT_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />
                Download EOTs (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Correspondence register</CardTitle>
              <CardDescription>Export incoming and outgoing corporate letters logs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-correspondence', 'Correspondence_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />
                Download Letters (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Performance summaries</CardTitle>
              <CardDescription>Export all employee monthly ratings and scorecard dimensions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-performance', 'Performance_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />
                Download Evals (.xlsx)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-bold">Daily Work Logs Ledger</CardTitle>
              <CardDescription>Export all employee daily work logs, attendance hours, and total calculated work time.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExportDownload('/api/registrar/export-work-logs', 'Daily_Work_Logs_Report.xlsx')} className="w-full font-bold gap-2">
                <Download className="size-4" />
                Download Work Logs (.xlsx)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 7: Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <div className="flex flex-col gap-6">
          {/* Header Stats Banner */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Bonds</span>
                  <span className="mt-0.5 font-display text-3xl font-extrabold text-foreground">{bondStats.active}</span>
                  <span className="text-[11px] text-muted-foreground">{bondStats.total} total</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10">
                  <Layers className="size-5" />
                </span>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved EOTs</span>
                  <span className="mt-0.5 font-display text-3xl font-extrabold text-foreground">{eotStats.approved}</span>
                  <span className="text-[11px] text-muted-foreground">{eotStats.total} total claims</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-sm ring-1 ring-blue-500/10">
                  <Calendar className="size-5" />
                </span>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-violet-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Open Letters</span>
                  <span className="mt-0.5 font-display text-3xl font-extrabold text-foreground">{corrStats.open}</span>
                  <span className="text-[11px] text-muted-foreground">{corrStats.total} correspondence</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 shadow-sm ring-1 ring-violet-500/10">
                  <FileText className="size-5" />
                </span>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Performance</span>
                  <span className="mt-0.5 font-display text-3xl font-extrabold text-foreground">{evalStats.avg.toFixed(1)}</span>
                  <span className="text-[11px] text-muted-foreground">out of 100</span>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm ring-1 ring-amber-500/10">
                  <Award className="size-5" />
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Row 1: Bonds Analysis */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bond Status Breakdown */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="size-4.5 text-emerald-500" />
                  Bond Status Distribution
                </CardTitle>
                <CardDescription>Current breakdown of all guarantee bonds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Active</span>
                    <span className="font-bold text-emerald-600">{bondStats.active} ({Math.round((bondStats.active / bondStats.total) * 100)}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${(bondStats.active / bondStats.total) * 100}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Expired</span>
                    <span className="font-bold text-rose-600">{bondStats.expired} ({Math.round((bondStats.expired / bondStats.total) * 100)}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all" style={{ width: `${(bondStats.expired / bondStats.total) * 100}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Released</span>
                    <span className="font-bold text-slate-600">{bondStats.released} ({Math.round((bondStats.released / bondStats.total) * 100)}%)</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-slate-500 to-slate-400 transition-all" style={{ width: `${(bondStats.released / bondStats.total) * 100}%` }} />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-3 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Performance: <strong className="text-foreground">{bondStats.performanceBonds}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-3 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground">Advance Payment: <strong className="text-foreground">{bondStats.advanceBonds}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bond Expiry Timeline */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="size-4.5 text-amber-500" />
                  Active Bond Expiry Timeline
                </CardTitle>
                <CardDescription>Days remaining until expiry (active bonds only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">0-30 days (Critical)</span>
                    <span className="font-bold text-rose-600">{bondStats.band0_30}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${bondStats.active > 0 ? (bondStats.band0_30 / bondStats.active) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">31-60 days</span>
                    <span className="font-bold text-orange-600">{bondStats.band31_60}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400" style={{ width: `${bondStats.active > 0 ? (bondStats.band31_60 / bondStats.active) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">61-90 days</span>
                    <span className="font-bold text-amber-600">{bondStats.band61_90}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${bondStats.active > 0 ? (bondStats.band61_90 / bondStats.active) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">90+ days (Safe)</span>
                    <span className="font-bold text-emerald-600">{bondStats.bandSafe}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${bondStats.active > 0 ? (bondStats.bandSafe / bondStats.active) * 100 : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: EOT & Correspondence */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* EOT Status & Urgency */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="size-4.5 text-blue-500" />
                  EOT Claims Analysis
                </CardTitle>
                <CardDescription>Extension of Time status and urgency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 pb-4 border-b border-border">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Approved</span>
                    <span className="text-2xl font-bold text-emerald-600">{eotStats.approved}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Pending</span>
                    <span className="text-2xl font-bold text-amber-600">{eotStats.pending}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Under Review</span>
                    <span className="text-2xl font-bold text-blue-600">{eotStats.underReview}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Rejected</span>
                    <span className="text-2xl font-bold text-rose-600">{eotStats.rejected}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Urgency Distribution (Approved EOTs)</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Critical (≤7 days)</span>
                      <span className="font-bold text-rose-600">{eotStats.critical}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">High (8-30 days)</span>
                      <span className="font-bold text-amber-600">{eotStats.high}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">On Track (30+ days)</span>
                      <span className="font-bold text-emerald-600">{eotStats.onTrack}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border text-center">
                  <span className="text-xs text-muted-foreground">Avg Days Approved: </span>
                  <span className="text-base font-bold text-foreground">{eotStats.avgDaysApproved}</span>
                </div>
              </CardContent>
            </Card>

            {/* Correspondence Overview */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="size-4.5 text-violet-500" />
                  Correspondence Analytics
                </CardTitle>
                <CardDescription>Letters by direction, status, and category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border">
                  <div className="rounded-lg border border-border bg-secondary/20 p-2.5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Incoming</span>
                    <span className="text-xl font-bold text-blue-600">{corrStats.incoming}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-2.5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Outgoing</span>
                    <span className="text-xl font-bold text-violet-600">{corrStats.outgoing}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-rose-50 dark:bg-rose-950/20 p-2.5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Overdue</span>
                    <span className="text-xl font-bold text-rose-600">{corrStats.overdue}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">By Category</h4>
                  <div className="space-y-2">
                    {corrStats.byCategory.map((cat: any) => (
                      <div key={cat.label} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground w-20 shrink-0">{cat.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: `${(cat.count / corrStats.maxCatCount) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground w-6 text-right">{cat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Performance & Projects */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Employee Performance */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="size-4.5 text-amber-500" />
                  Employee Performance Scores
                </CardTitle>
                <CardDescription>Latest evaluation scores by dimension</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evalStats.dimensions.map((dim: any) => (
                  <div key={dim.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{dim.label} ({dim.weight}%)</span>
                      <span className="font-bold text-amber-600">{dim.avg}/100</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${dim.avg}%` }} />
                    </div>
                  </div>
                ))}

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex size-2.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">Outstanding: <strong className="text-foreground">{evalStats.outstanding}</strong></span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex size-2.5 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">Very Good: <strong className="text-foreground">{evalStats.veryGood}</strong></span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex size-2.5 rounded-full bg-amber-500" />
                      <span className="text-muted-foreground">Good: <strong className="text-foreground">{evalStats.good}</strong></span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Progress */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FolderKanban className="size-4.5 text-primary" />
                  Project Portfolio Status
                </CardTitle>
                <CardDescription>Active projects and completion metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg border border-border bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Active</span>
                    <span className="text-2xl font-bold text-emerald-600">{projectStats.active}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">On Hold</span>
                    <span className="text-2xl font-bold text-amber-600">{projectStats.onHold}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Completed</span>
                    <span className="text-2xl font-bold text-blue-600">{projectStats.completed}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">Average Project Progress</span>
                    <span className="text-lg font-bold text-primary">{projectStats.avgProgress}%</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/80" style={{ width: `${projectStats.avgProgress}%` }} />
                  </div>
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">Total Projects</span>
                    <span className="font-bold text-foreground">{projectStats.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-rose-500" />
                      High Priority
                    </span>
                    <span className="font-bold text-rose-600">{projectStats.highPriority}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 4: Timesheets */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileStack className="size-4.5 text-indigo-500" />
                Timesheet Approval Queue
              </CardTitle>
              <CardDescription>Current pending work logs requiring review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-gradient-to-br from-indigo-50 to-indigo-50/50 dark:from-indigo-950/30 dark:to-indigo-950/10 p-5 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Queue Size</span>
                  <span className="text-4xl font-extrabold text-indigo-600">{timesheetStats.queueSize}</span>
                  <span className="text-[11px] text-muted-foreground block mt-1">logs pending</span>
                </div>
                <div className="rounded-xl border border-border bg-gradient-to-br from-purple-50 to-purple-50/50 dark:from-purple-950/30 dark:to-purple-950/10 p-5 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Dept Employees</span>
                  <span className="text-4xl font-extrabold text-purple-600">{timesheetStats.totalStaff}</span>
                  <span className="text-[11px] text-muted-foreground block mt-1">staff members</span>
                </div>
                <div className="rounded-xl border border-border bg-gradient-to-br from-pink-50 to-pink-50/50 dark:from-pink-950/30 dark:to-pink-950/10 p-5 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Total Hours</span>
                  <span className="text-4xl font-extrabold text-pink-600">{timesheetStats.totalHoursPending}</span>
                  <span className="text-[11px] text-muted-foreground block mt-1">hours to verify</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 8: Profile */}
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

      {/* Email Alert Preview/Edit Modal */}
      {emailModalOpen && emailType && emailItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
          <Card className="w-full max-w-2xl overflow-hidden rounded-t-2xl border-border/60 shadow-xl sm:rounded-2xl">
            <CardHeader className={`border-b border-border ${emailType === 'bond' ? 'bg-gradient-to-r from-rose-500/5 to-transparent' : 'bg-gradient-to-r from-amber-500/5 to-transparent'}`}>
              <CardTitle className={`flex items-center gap-2 font-display text-base font-bold ${emailType === 'bond' ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                <span className={`flex size-8 items-center justify-center rounded-full ${emailType === 'bond' ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-amber-100 dark:bg-amber-950/50'}`}>
                  <Mail className={`size-4 ${emailType === 'bond' ? 'text-rose-600' : 'text-amber-600'}`} />
                </span>
                Review &amp; Edit Notification Email
              </CardTitle>
              <CardDescription className="text-xs">
                Review the recipient and add custom comments or modify the email body below.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSendEmailAlert} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cm-email-recipient" className="text-xs font-bold text-foreground">Recipient Email *</Label>
                  <Input
                    id="cm-email-recipient"
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="manager@efae.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cm-email-subject" className="text-xs font-bold text-foreground">Subject *</Label>
                  <Input
                    id="cm-email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="ALERT: Expired Bond"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cm-email-message" className="text-xs font-bold text-foreground">Email Message Body *</Label>
                  <textarea
                    id="cm-email-message"
                    rows={12}
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEmailModalOpen(false)}
                    disabled={sendingEmail}
                    className="h-9 px-4 text-xs font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={sendingEmail}
                    className={`flex h-9 items-center gap-1.5 px-4 text-xs font-bold shadow-sm ${
                      emailType === 'bond'
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    {sendingEmail ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Sending...</>
                    ) : (
                      <><Mail className="size-3.5" /> Send Notification</>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-border bg-card p-6 rounded-xl shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <AlertTriangle className="size-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to permanently delete this {deleteConfirm.tab === 'correspondence' ? 'letter log' : deleteConfirm.tab === 'projects' ? 'project record' : deleteConfirm.tab === 'bonds' ? 'bond record' : deleteConfirm.tab === 'eot' ? 'EOT claim' : 'evaluation rating'}? This action is irreversible and will remove all details from the database.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                className="h-8 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  executeDeleteRecord(deleteConfirm.id, deleteConfirm.tab)
                  setDeleteConfirm(null)
                }}
                className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
