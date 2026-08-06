'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Mail,
  Download,
  AlertTriangle,
  Clock,
  Briefcase,
  FileText,
  Percent,
  RefreshCw,
  Loader2,
  TrendingUp,
  Inbox,
  AlertCircle,
  Eye,
  X,
  Search,
  BarChart3,
  PieChart,
  ShieldCheck,
  CheckCircle2,
  Building2,
  ChevronRight
} from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json
}

export default function DGMAnalyticsPage() {
  const [userRole, setUserRole] = useState<'dgm' | 'gm' | 'admin'>('dgm')
  
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('employees')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data: emp }) => {
            if (emp) {
              if (emp.role === 'gm' || emp.role === 'dgm' || emp.role === 'admin') {
                setUserRole(emp.role)
              }
            }
          })
      }
    })
  }, [])

  const { data, isLoading, mutate, error } = useSWR('/api/analytics', fetcher, {
    refreshInterval: 15000 // Real-time executive sync every 15 seconds
  })

  // Executive Active Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'eot' | 'risks'>('overview')

  // Search & Filters for Approved Master Work Logs Table
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<any>(null)

  // Export State
  const [downloading, setDownloading] = useState(false)
  const [exportingType, setExportingType] = useState<string | null>(null)

  // Email Alert Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailType, setEmailType] = useState<'bond' | 'eot' | 'correspondence' | null>(null)
  const [emailItem, setEmailItem] = useState<any>(null)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const metrics = data?.metrics ?? {
    totalLetters: 0,
    overdueLetters: 0,
    activeBonds: 0,
    expiredOrReleasedBonds: 0,
    commitmentAverage: 0,
    totalApprovedLogs: 0,
    totalEotClaims: 0,
    totalApprovedEotDays: 0
  }

  const departmentStats = data?.departmentStats ?? [
    { id: 'contract', name: 'Contract & Procurement Admin', approvedLogsCount: 0, totalHours: 0, onsiteHours: 0, avgCommitment: 0, activeEmployeesCount: 0 },
    { id: 'design', name: 'Design Department', approvedLogsCount: 0, totalHours: 0, onsiteHours: 0, avgCommitment: 0, activeEmployeesCount: 0 },
    { id: 'office-eng', name: 'Office Engineering', approvedLogsCount: 0, totalHours: 0, onsiteHours: 0, avgCommitment: 0, activeEmployeesCount: 0 },
    { id: 'supervision', name: 'Supervision Department', approvedLogsCount: 0, totalHours: 0, onsiteHours: 0, avgCommitment: 0, activeEmployeesCount: 0 }
  ]

  const eotAnalytics = data?.eotAnalytics ?? {
    totalClaims: 0,
    approvedDays: 0,
    pendingCount: 0,
    approvedCount: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
    eots: []
  }

  const approvedLogs = data?.approvedLogs ?? []
  const alerts = data?.alerts ?? {
    criticalExpiredBonds: [],
    nearlyExpiredEots: [],
    overdueLettersList: []
  }

  // Filtered Approved Logs
  const filteredApprovedLogs = approvedLogs.filter((log: any) => {
    const empName = (log.employees?.full_name ?? '').toLowerCase()
    const empDept = (log.employees?.department ?? '').toLowerCase()
    const empDeptId = (log.employees?.department_id ?? '').toLowerCase()
    const tasks = (log.assigned_tasks ?? '').toLowerCase()
    const work = (log.actual_work_done ?? '').toLowerCase()
    const proj = (log.project_code ?? '').toLowerCase()

    const matchesSearch =
      !searchQuery ||
      empName.includes(searchQuery.toLowerCase()) ||
      tasks.includes(searchQuery.toLowerCase()) ||
      work.includes(searchQuery.toLowerCase()) ||
      proj.includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (selectedDeptFilter === 'all') return true
    if (selectedDeptFilter === 'contract') {
      return empDeptId === 'contract' || empDept.includes('contract') || empDept.includes('procurement')
    }
    if (selectedDeptFilter === 'design') {
      return empDeptId === 'design' || empDept.includes('design')
    }
    if (selectedDeptFilter === 'office-eng') {
      return empDeptId === 'office-eng' || empDeptId === 'office_eng' || empDept.includes('office')
    }
    if (selectedDeptFilter === 'supervision') {
      return empDeptId === 'supervision' || empDept.includes('supervision')
    }
    return true
  })

  // Handle Export Triggers
  const handleExportMaster = async () => {
    setDownloading(true)
    try {
      window.location.href = '/api/export-master'
      toast.success('Master Log Export Initiated')
    } catch (err) {
      toast.error('Failed to trigger export')
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  const handleModuleExport = (routeUrl: string, label: string) => {
    setExportingType(label)
    try {
      window.location.href = routeUrl
      toast.success(`${label} Export Initiated`)
    } catch (err) {
      toast.error(`Failed to export ${label}`)
    } finally {
      setTimeout(() => setExportingType(null), 2000)
    }
  }

  // Open Email Alert Modal
  const openEmailModal = (type: 'bond' | 'eot' | 'correspondence', item: any) => {
    const defaultRecipient = 'team@efae.com'
    const recipient = item.assigned_manager_email || item.recipient_email || defaultRecipient

    setEmailType(type)
    setEmailItem(item)
    setEmailRecipient(recipient)

    if (type === 'bond') {
      setEmailSubject(`EXECUTIVE ALERT: Expired Guarantee Bond — "${item.project_name}"`)
      setEmailMessage(`Dear ${item.contractor_name || 'Project Manager'},\n\nThis is an urgent executive notification from the ${userRole.toUpperCase()} Office regarding an expired guarantee bond:\n\n- Project Name: ${item.project_name}\n- Contractor: ${item.contractor_name}\n- Bond Type: ${item.bond_type}\n- Expiry Date: ${item.expiry_date}\n- Overdue Duration: ${item.days_overdue || 0} Days OVERDUE\n- Amount: ${item.amount ? Number(item.amount).toLocaleString() + ' ETB' : 'N/A'}\n\nImmediate executive compliance action is required. Please verify bond extension or release status.`)
    } else if (type === 'eot') {
      setEmailSubject(`EXECUTIVE ATTENTION: EOT Timeline Deadline Warning — "${item.project_name}"`)
      setEmailMessage(`Dear ${item.contractor_name || 'Supervision Manager'},\n\nPlease be advised regarding the revised contract completion timeline:\n\n- Project Name: ${item.project_name}\n- Contractor: ${item.contractor_name}\n- Claim Number: EOT #${item.eot_number}\n- Approved Days: ${item.days_approved} days\n- Revised Completion Date: ${item.revised_completion_date}\n- Days Remaining: ${item.days_remaining} Days Left\n\nPlease audit project execution progress and ensure site milestones are met.`)
    } else {
      setEmailSubject(`EXECUTIVE NOTICE: Overdue Correspondence Action — Ref #${item.letter_ref_no}`)
      setEmailMessage(`Dear Management Team,\n\nPlease address the overdue correspondence item:\n\n- Letter Ref No: ${item.letter_ref_no}\n- Counterparty: ${item.counterparty}\n- Subject: ${item.subject}\n- Category: ${item.category}\n- Due Date: ${item.response_due_date}\n\nResponse action is overdue. Please log the reply immediately.`)
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
          item: emailItem
        })
      })

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Failed to send email notification')

      toast.success('Executive email notification sent successfully!')
      setEmailModalOpen(false)
    } catch (err: any) {
      toast.error('Failed to send email alert', { description: err.message })
    } finally {
      setSendingEmail(false)
    }
  }

  // Maximum values for visual charts
  const maxApprovedCount = Math.max(...departmentStats.map((d: any) => d.approvedLogsCount), 1)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/60 dark:bg-slate-950">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        
        {/* Executive Header Banner */}
        <div className="mb-8 flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-500/25">
              <TrendingUp className="size-7" />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900">
                <span className="size-2 rounded-full bg-white animate-pulse" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  {userRole.toUpperCase() === 'GM' ? 'GM Control Tower' : 'DGM Control Tower'}
                </h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {userRole.toUpperCase() === 'GM' ? 'General Manager View' : 'Deputy General Manager View'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Executive dashboard for live engineering trackers, department results, and EOT analytics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Refresh Analytics Data"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin text-indigo-600" /> : <RefreshCw className="size-4" />}
            </button>
            <Button
              onClick={handleExportMaster}
              disabled={downloading}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 font-bold text-white shadow-md transition-all hover:from-indigo-700 hover:to-blue-700"
            >
              {downloading ? (
                <><Loader2 className="size-4 animate-spin" /> Exporting Master...</>
              ) : (
                <><Download className="size-4" /> Export Master Excel Log</>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div>
              <span className="font-bold block">Executive Analytics Stream Error:</span>
              {error.message || 'Unable to sync executive metrics. Please check network connectivity.'}
            </div>
          </div>
        )}

        {/* ── TOP KPI CARDS ── */}
        <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Correspondence Mailbox */}
          <Card className="relative overflow-hidden border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Correspondence Mailbox</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <FileText className="size-5" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.totalLetters}</span>
                <span className="text-xs font-medium text-slate-500">Total Letters</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="size-3.5" /> {metrics.overdueLetters} Overdue Actions
                </span>
                <span className="font-medium text-slate-400">Live</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Guarantee Bonds */}
          <Card className="relative overflow-hidden border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Guarantee Bonds</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Briefcase className="size-5" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.activeBonds}</span>
                <span className="text-xs font-medium text-slate-500">Active Bonds</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {metrics.expiredOrReleasedBonds} Expired / Released
                </span>
                {alerts.criticalExpiredBonds?.length > 0 && (
                  <span className="font-extrabold text-rose-600 animate-pulse">
                    {alerts.criticalExpiredBonds.length} Risk!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Engineer Commitment */}
          <Card className="relative overflow-hidden border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Commitment Rate</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Percent className="size-5" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.commitmentAverage}%</span>
                <span className="text-xs font-medium text-slate-500">Avg Progress</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {metrics.totalApprovedLogs} Approved Work Logs
                </span>
                <span className="font-medium text-slate-400">Verified</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: EOT Extensions */}
          <Card className="relative overflow-hidden border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">EOT Claims</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Clock className="size-5" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">{eotAnalytics.totalClaims}</span>
                <span className="text-xs font-medium text-slate-500">Total Claims</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {eotAnalytics.approvedDays} Days Approved
                </span>
                {eotAnalytics.expiringSoonCount > 0 && (
                  <span className="font-bold text-amber-600">
                    {eotAnalytics.expiringSoonCount} Expiring Soon
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/60">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="size-4" /> Overview &amp; Charts
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'departments'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="size-4" /> Department Results ({departmentStats.length})
            </button>
            <button
              onClick={() => setActiveTab('eot')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'eot'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="size-4" /> EOT Analytics ({eotAnalytics.totalClaims})
            </button>
            <button
              onClick={() => setActiveTab('risks')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'risks'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="size-4 text-rose-500" /> Operational Risk Inbox (
              {(alerts.criticalExpiredBonds?.length || 0) + (alerts.nearlyExpiredEots?.length || 0) + (alerts.overdueLettersList?.length || 0)}
              )
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Quick Modules:</span>
            <button
              onClick={() => handleModuleExport('/api/registrar/export-work-logs', 'Work Logs')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Work Logs
            </button>
            <button
              onClick={() => handleModuleExport('/api/registrar/export-eot', 'EOT Register')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              EOT
            </button>
            <button
              onClick={() => handleModuleExport('/api/registrar/export-bonds', 'Bonds')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Bonds
            </button>
          </div>
        </div>

        {/* ── TAB 1: OVERVIEW & VISUAL CHARTS ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Visual Analytics Grid */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              
              {/* Chart 1: Department Workload & Performance Comparison */}
              <Card className="lg:col-span-2 border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                        <BarChart3 className="size-5 text-indigo-600" /> Department Performance Breakdown
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Comparing approved work logs &amp; average commitment rate across key engineering departments.
                      </CardDescription>
                    </div>
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      4 Main Departments
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-5">
                    {departmentStats.map((dept: any) => {
                      const logPct = Math.round((dept.approvedLogsCount / maxApprovedCount) * 100)
                      return (
                        <div key={dept.id} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-800 dark:text-slate-200">{dept.name}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-500">{dept.approvedLogsCount} Approved Logs</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{dept.avgCommitment}% Rate</span>
                            </div>
                          </div>
                          {/* Progress Bar Container */}
                          <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-500"
                              style={{ width: `${Math.max(logPct, 4)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Total Hours: {dept.totalHours} hrs</span>
                            <span>Active Staff: {dept.activeEmployeesCount} engineers</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Chart 2: EOT & Risk Distribution Chart */}
              <Card className="border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    <PieChart className="size-5 text-amber-500" /> EOT Risk Distribution
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Extension of Time status breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col justify-between p-6">
                  <div className="space-y-4">
                    
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 p-3.5 dark:bg-emerald-950/40">
                      <div className="flex items-center gap-3">
                        <span className="size-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">Approved EOT Claims</span>
                      </div>
                      <span className="font-display text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                        {eotAnalytics.approvedCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-amber-50/60 p-3.5 dark:bg-amber-950/40">
                      <div className="flex items-center gap-3">
                        <span className="size-3 rounded-full bg-amber-500" />
                        <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">Pending Review</span>
                      </div>
                      <span className="font-display text-base font-extrabold text-amber-700 dark:text-amber-300">
                        {eotAnalytics.pendingCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-orange-50/60 p-3.5 dark:bg-orange-950/40">
                      <div className="flex items-center gap-3">
                        <span className="size-3 rounded-full bg-orange-500" />
                        <span className="text-xs font-semibold text-orange-950 dark:text-orange-200">Expiring Within 30d</span>
                      </div>
                      <span className="font-display text-base font-extrabold text-orange-700 dark:text-orange-300">
                        {eotAnalytics.expiringSoonCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3.5 dark:bg-rose-950/40">
                      <div className="flex items-center gap-3">
                        <span className="size-3 rounded-full bg-rose-500" />
                        <span className="text-xs font-semibold text-rose-950 dark:text-rose-200">Expired Deadlines</span>
                      </div>
                      <span className="font-display text-base font-extrabold text-rose-700 dark:text-rose-300">
                        {eotAnalytics.expiredCount}
                      </span>
                    </div>

                  </div>

                  <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-xs font-semibold text-slate-500">Total Approved EOT Days:</span>
                    <div className="mt-1 font-display text-2xl font-black text-amber-600 dark:text-amber-400">
                      {eotAnalytics.approvedDays} Days
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* ── ALL DEPARTMENTS APPROVED MASTER WORK LOGS ── */}
            <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    <ShieldCheck className="size-5 text-emerald-600" /> Approved Master Results Across All Departments
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Daily work logs reviewed and committed by department managers.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                    <Input
                      placeholder="Search employee or task..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 w-48 rounded-lg pl-8 text-xs sm:w-64"
                    />
                  </div>

                  {/* Department Filter Select */}
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="all">All 4 Departments</option>
                    <option value="contract">Contract &amp; Procurement Admin</option>
                    <option value="design">Design Department</option>
                    <option value="office-eng">Office Engineering</option>
                    <option value="supervision">Supervision Department</option>
                  </select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredApprovedLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Inbox className="mb-2 size-8 text-slate-300" />
                    <p className="text-xs font-semibold">No approved department work logs match your criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                        <tr>
                          <th className="px-5 py-3">Log Date</th>
                          <th className="px-5 py-3">Employee</th>
                          <th className="px-5 py-3">Department</th>
                          <th className="px-5 py-3">Project Code</th>
                          <th className="px-5 py-3">Hours</th>
                          <th className="px-5 py-3">Commitment</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredApprovedLogs.map((log: any) => {
                          const emp = log.employees || {}
                          return (
                            <tr key={log.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                                {new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{emp.full_name || 'Anonymous'}</div>
                                <div className="text-[10px] text-slate-400">{emp.email || 'no-email@efae.com'}</div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {emp.department || 'Contract & Procurement Admin'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                                {log.project_code || 'General'}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{log.hours_worked || log.actual_working_hour || 8} hrs</span>
                              </td>
                              <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                                {Math.round((log.completion_percentage || 0) * 100)}%
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 className="size-3" /> Approved
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedLog(log)}
                                  className="h-7 px-2.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                                >
                                  <Eye className="mr-1 size-3.5" /> Details
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* ── TAB 2: DEPARTMENT RESULTS ── */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {departmentStats.map((dept: any) => (
                <Card key={dept.id} className="overflow-hidden border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-transparent px-6 py-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                        {dept.name}
                      </CardTitle>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-extrabold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {dept.approvedLogsCount} Logs
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Total Hours</span>
                        <div className="mt-1 font-display text-lg font-extrabold text-slate-900 dark:text-slate-100">{dept.totalHours} hrs</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Onsite Hours</span>
                        <div className="mt-1 font-display text-lg font-extrabold text-slate-900 dark:text-slate-100">{dept.onsiteHours} hrs</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Commitment</span>
                        <div className="mt-1 font-display text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{dept.avgCommitment}%</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <span>Active Engineers: <strong className="text-slate-800 dark:text-slate-200">{dept.activeEmployeesCount}</strong></span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDeptFilter(dept.id)
                          setActiveTab('overview')
                        }}
                        className="h-7 text-[11px] font-semibold"
                      >
                        View Logs <ChevronRight className="ml-1 size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: EOT ANALYTICS ── */}
        {activeTab === 'eot' && (
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800">
                <div>
                  <CardTitle className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    Extension of Time (EOT) Master Register
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Live tracker of approved and pending contract extension claims.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleModuleExport('/api/registrar/export-eot', 'EOT Register')}
                  className="flex h-8 items-center gap-1.5 text-xs font-bold"
                >
                  <Download className="size-3.5" /> Export EOT Excel
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {eotAnalytics.eots.length === 0 ? (
                  <div className="py-14 text-center text-slate-400">
                    <Clock className="mx-auto mb-2 size-8 text-slate-300" />
                    <p className="text-xs font-semibold">No EOT records found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                        <tr>
                          <th className="px-5 py-3">Claim #</th>
                          <th className="px-5 py-3">Project Name</th>
                          <th className="px-5 py-3">Contractor</th>
                          <th className="px-5 py-3">Approved Days</th>
                          <th className="px-5 py-3">Revised Completion</th>
                          <th className="px-5 py-3">Risk Status</th>
                          <th className="px-5 py-3 text-right">Email Alert</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {eotAnalytics.eots.map((eot: any) => (
                          <tr key={eot.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-5 py-3.5 font-bold text-amber-700 dark:text-amber-400">
                              Claim #{eot.eot_number}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                              {eot.project_name}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                              {eot.contractor_name}
                            </td>
                            <td className="px-5 py-3.5 font-extrabold text-slate-900 dark:text-slate-100">
                              {eot.days_approved} days
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                              {new Date(eot.revised_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                eot.alertStatus === 'Expired'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : eot.alertStatus === 'Expiring Soon'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}>
                                {eot.alertStatus} ({eot.days_remaining}d)
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => openEmailModal('eot', eot)}
                                className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-900"
                                title="Send Email Alert"
                              >
                                <Mail className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 4: OPERATIONAL RISKS INBOX ── */}
        {activeTab === 'risks' && (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            
            {/* Critical Bond Expiration Alerts */}
            <Card className="border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-rose-50/40 px-6 py-4 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-rose-900 dark:text-rose-300">
                  <AlertTriangle className="size-5 text-rose-600" /> Critical Bond Expirations ({alerts.criticalExpiredBonds?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs text-rose-700/80 dark:text-rose-400">
                  Active project bonds past expiration date.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {(!alerts?.criticalExpiredBonds || alerts.criticalExpiredBonds.length === 0) ? (
                  <div className="py-12 text-center text-slate-400">
                    <p className="text-xs font-semibold">All guarantee bonds are within compliance.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {alerts.criticalExpiredBonds.map((bond: any) => (
                      <div key={bond.id} className="flex items-center justify-between p-4 transition-colors hover:bg-rose-50/30">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                              {bond.bond_type}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{bond.project_name}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Contractor: <strong className="text-slate-700 dark:text-slate-300">{bond.contractor_name}</strong>
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-rose-600">
                            Expired on {bond.expiry_date}: {bond.days_overdue} days OVERDUE
                          </div>
                        </div>
                        <button
                          onClick={() => openEmailModal('bond', bond)}
                          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50"
                        >
                          <Mail className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overdue Correspondence Inbox */}
            <Card className="border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-blue-50/40 px-6 py-4 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-blue-900 dark:text-blue-300">
                  <FileText className="size-5 text-blue-600" /> Overdue Letters ({alerts.overdueLettersList?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs text-blue-700/80 dark:text-blue-400">
                  Correspondence requiring response past due date.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {(!alerts?.overdueLettersList || alerts.overdueLettersList.length === 0) ? (
                  <div className="py-12 text-center text-slate-400">
                    <p className="text-xs font-semibold">No overdue correspondence actions.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {alerts.overdueLettersList.map((letter: any) => (
                      <div key={letter.id} className="flex items-center justify-between p-4 transition-colors hover:bg-blue-50/30">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                              {letter.letter_ref_no}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{letter.subject}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Counterparty: <strong className="text-slate-700 dark:text-slate-300">{letter.counterparty}</strong>
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-rose-600">
                            Due Date: {letter.response_due_date} (Overdue)
                          </div>
                        </div>
                        <button
                          onClick={() => openEmailModal('correspondence', letter)}
                          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50"
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
        )}

        {/* Selected Approved Log Detail View Drawer Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-xl overflow-hidden rounded-2xl border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    Approved Work Log Entry Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedLog(null)}
                    className="size-8 rounded-full"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <div className="font-bold text-slate-900 text-sm dark:text-slate-100">{selectedLog.employees?.full_name || 'Anonymous'}</div>
                    <div className="text-slate-400">{selectedLog.employees?.email}</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Approved &amp; Committed
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                  <div><strong>Log Date:</strong> {selectedLog.log_date}</div>
                  <div><strong>Project Code:</strong> {selectedLog.project_code || 'General'}</div>
                  <div><strong>Hours Worked:</strong> {selectedLog.hours_worked || 8} hrs</div>
                  <div><strong>Commitment Rate:</strong> {Math.round((selectedLog.completion_percentage || 0) * 100)}%</div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Assigned Tasks</div>
                  <p className="rounded-lg bg-slate-50 p-3 leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {selectedLog.assigned_tasks}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Actual Work Executed</div>
                  <p className="rounded-lg bg-slate-50 p-3 leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {selectedLog.actual_work_done}
                  </p>
                </div>

                {selectedLog.head_comments && (
                  <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                    <div className="font-bold">Manager Review Comment:</div>
                    <p>{selectedLog.head_comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Alert Preview / Edit Modal */}
        {emailModalOpen && emailType && emailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl overflow-hidden rounded-2xl border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  <Mail className="size-5 text-indigo-600" /> Send Executive Alert Email Notification
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Review recipient email address and customize message body before sending.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSendEmailAlert} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="email-recipient" className="font-bold text-slate-900 dark:text-slate-100">Recipient Email *</Label>
                    <Input
                      id="email-recipient"
                      type="email"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email-subject" className="font-bold text-slate-900 dark:text-slate-100">Subject *</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email-message" className="font-bold text-slate-900 dark:text-slate-100">Email Message *</Label>
                    <textarea
                      id="email-message"
                      rows={10}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmailModalOpen(false)}
                      disabled={sendingEmail}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendingEmail}
                      className="bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                    >
                      {sendingEmail ? <><Loader2 className="mr-1.5 size-4 animate-spin" /> Sending...</> : <><Mail className="mr-1.5 size-4" /> Send Notification</>}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </div>
  )
}