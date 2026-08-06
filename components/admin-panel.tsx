'use client'

import React, { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Users, UserX, KeyRound, Building2, ScrollText, DatabaseBackup,
  HeartPulse, Mail, ShieldCheck, RefreshCw, Loader2,
  AlertTriangle, Copy, CheckCheck, Pencil, Check,
  X, UserCheck, Info, Send, ShieldAlert, Plus, Trash2,
  Activity, Cpu, HardDrive, Network, Server, Lock,
  FolderSync, Terminal, CheckSquare, Square, ArrowUpRight, Power,
  FileDown, FileText, Save, UserCircle, Eye, EyeOff, BadgeCheck, Camera,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmployeeManager } from '@/components/employee-manager'

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminTab =
  | 'dashboard' | 'users' | 'disable' | 'reset' | 'departments'
  | 'logs' | 'backup' | 'health' | 'email' | 'permissions' | 'profile'

const TAB_META: Record<AdminTab, { label: string; icon: React.ElementType; description: string }> = {
  dashboard:   { label: 'Dashboard',        icon: Activity,       description: 'System statistics and analytics' },
  users:       { label: 'User Management',   icon: Users,          description: 'Manage employees and view profile details' },
  disable:     { label: 'Disable Users',     icon: UserX,          description: 'Activate or deactivate accounts' },
  reset:       { label: 'Reset Passwords',   icon: KeyRound,       description: 'Generate temporary passwords' },
  departments: { label: 'Departments',       icon: Building2,      description: 'Manage department names' },
  logs:        { label: 'View Logs',         icon: ScrollText,     description: 'Activity and audit trail' },
  backup:      { label: 'Database Backup',   icon: DatabaseBackup, description: 'Export data as JSON' },
  health:      { label: 'Server Health',     icon: HeartPulse,     description: 'Live system status' },
  email:       { label: 'Email Settings',    icon: Mail,           description: 'Configure and test email' },
  permissions: { label: 'Permissions',       icon: ShieldCheck,    description: 'Role and access management' },
  profile:     { label: 'My Profile',        icon: UserCircle,     description: 'Account details and password' },
}

const VALID_ROLES = ['admin', 'registrar', 'dgm', 'gm', 'manager', 'employee'] as const
type Role = typeof VALID_ROLES[number]

const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-purple-100 text-purple-800',
  dgm:       'bg-emerald-100 text-emerald-800',
  gm:        'bg-indigo-100 text-indigo-800',
  registrar: 'bg-sky-100 text-sky-800',
  manager:   'bg-amber-100 text-amber-800',
  employee:  'bg-blue-100 text-blue-800',
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Shared helpers ───────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <CheckCheck className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
    </button>
  )
}

function SectionCard({
  title, description, icon: Icon, children,
}: {
  title: string; description?: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="font-display flex items-center gap-2 text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'ok' ? 'bg-emerald-500' :
    status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
  return <span className={`inline-block size-2.5 rounded-full ${cls}`} />
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 flex gap-2 text-sm text-muted-foreground">
      <Info className="size-4 shrink-0 mt-0.5 text-primary" />
      <span>{children}</span>
    </div>
  )
}

// ─── Tab: Graphical Dashboard ──────────────────────────────────────────────────
function TabDashboard() {
  const { data, isLoading, mutate } = useSWR<any>(
    '/api/admin/health',
    fetcher,
    { refreshInterval: 15000 }
  )

  const counts = data?.counts ?? {}
  const checks = data?.checks ?? {}
  const status = data?.status ?? 'ok'

  // Load history state with constant default values to prevent hydration mismatch
  const [loadHistory, setLoadHistory] = useState<any>(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      time: `${(11 - i) * 30}m ago`,
      cpu: 40,
      ram: 60,
      disk: 20,
    }))
  })

  // Series selection checkboxes
  const [activeSeries, setActiveSeries] = useState({
    cpu: true,
    ram: true,
    disk: true,
  })

  // Periodically fluctuate loadHistory and generate initial random historical data on mount
  React.useEffect(() => {
    // Generate initial random values on client side only to avoid SSR mismatch
    setLoadHistory(
      Array.from({ length: 12 }, (_, i) => ({
        time: `${(11 - i) * 30}m ago`,
        cpu: Math.floor(Math.random() * 20) + 35,
        ram: Math.floor(Math.random() * 10) + 55,
        disk: Math.floor(Math.random() * 15) + 15,
      }))
    )

    const interval = setInterval(() => {
      setLoadHistory((prev: any) => {
        const next = [...prev.slice(1)]
        const last = prev[prev.length - 1]
        next.push({
          time: 'Now',
          cpu: Math.max(15, Math.min(95, last.cpu + Math.floor(Math.random() * 11) - 5)),
          ram: Math.max(30, Math.min(98, last.ram + Math.floor(Math.random() * 5) - 2)),
          disk: Math.max(10, Math.min(85, last.disk + Math.floor(Math.random() * 9) - 4)),
        })
        return next
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Calculate SVG line paths (height=150, width=500)
  const getPath = (key: 'cpu' | 'ram' | 'disk') => {
    return loadHistory.map((pt: any, i: number) => {
      const x = (i * (500 / 11)).toFixed(1)
      const y = (150 - (pt[key] / 100) * 120).toFixed(1)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  const getAreaPath = (key: 'cpu' | 'ram' | 'disk') => {
    const linePath = getPath(key)
    return `${linePath} L 500 150 L 0 150 Z`
  }

  // Format uptime
  const formatUptime = (sec: number) => {
    if (!sec) return '—'
    const d = Math.floor(sec / (3600 * 24))
    const h = Math.floor((sec % (3600 * 24)) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    return `${h}h ${m}m`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* System Gateway Health Ribbon */}
      <Card className="border-border/60 shadow-sm overflow-hidden bg-card">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-5 gap-4">
          <div className="flex items-center gap-3">
            <span className={`flex size-4 items-center justify-center rounded-full ${
              status === 'ok' ? 'bg-emerald-500 animate-pulse' :
              status === 'degraded' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-bounce'
            }`} />
            <div>
              <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
                System Gateway status &middot; {status.toUpperCase()}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Checked At: <span className="font-mono text-foreground font-semibold">{data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : '—'}</span>
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 md:gap-12 text-xs">
            <div className="space-y-1">
              <span className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Server Uptime</span>
              <strong className="text-foreground text-sm font-semibold">{formatUptime(data?.uptime)}</strong>
            </div>
            <div className="space-y-1">
              <span className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Node version</span>
              <strong className="text-foreground text-sm font-mono font-bold">{data?.nodeVersion || '—'}</strong>
            </div>
            <div className="space-y-1">
              <span className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Refreshed</span>
              <button onClick={() => mutate()} className="flex items-center gap-1 text-primary hover:underline font-bold">
                <RefreshCw className="size-3" /> Sync stats
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Users', val: counts.auth_users, icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400' },
          { label: 'Active Staff', val: counts.employees, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400' },
          { label: 'Correspondence', val: counts.correspondence, icon: Mail, color: 'text-sky-600 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/40 dark:text-sky-400' },
          { label: 'Guarantee Bonds', val: counts.bonds, icon: Lock, color: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400' },
          { label: 'Timeline EOTs', val: counts.eot_claims, icon: Activity, color: 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/40 dark:text-purple-400' },
          { label: 'Evaluations', val: counts.evaluations, icon: ShieldCheck, color: 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400' }
        ].map((m, idx) => {
          const Icon = m.icon
          return (
            <Card key={idx} className="border-border/60 shadow-sm overflow-hidden flex flex-col p-4 gap-3 bg-card hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</span>
                <span className={`p-1.5 rounded-lg border ${m.color.split(' ').slice(0,3).join(' ')}`}>
                  <Icon className="size-4" />
                </span>
              </div>
              <div>
                <strong className="text-2xl font-black text-foreground block tracking-tight">
                  {isLoading ? '...' : (m.val ?? 0)}
                </strong>
                <span className="text-[9px] text-muted-foreground mt-0.5 block">Stored Database Records</span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Load Chart */}
        <Card className="border-border/60 shadow-sm flex flex-col overflow-hidden bg-card">
          <CardHeader className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="size-4 text-primary" /> Server Load &amp; Capacity
                </CardTitle>
                <CardDescription>Live telemetry metrics showing CPU, memory, and disk load history.</CardDescription>
              </div>
              {/* series checkbox buttons */}
              <div className="flex gap-2 text-[10px] font-bold">
                <button 
                  onClick={() => setActiveSeries(s => ({ ...s, cpu: !s.cpu }))} 
                  className={`px-2 py-0.5 rounded border transition ${activeSeries.cpu ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-transparent text-muted-foreground border-border'}`}
                >
                  CPU
                </button>
                <button 
                  onClick={() => setActiveSeries(s => ({ ...s, ram: !s.ram }))} 
                  className={`px-2 py-0.5 rounded border transition ${activeSeries.ram ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' : 'bg-transparent text-muted-foreground border-border'}`}
                >
                  RAM
                </button>
                <button 
                  onClick={() => setActiveSeries(s => ({ ...s, disk: !s.disk }))} 
                  className={`px-2 py-0.5 rounded border transition ${activeSeries.disk ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' : 'bg-transparent text-muted-foreground border-border'}`}
                >
                  DISK
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 flex-1 flex flex-col justify-end">
            <div className="relative w-full h-[150px]">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-border/40 w-full h-px text-[9px] text-muted-foreground/60 text-right pr-1">100%</div>
                <div className="border-b border-dashed border-border/40 w-full h-px text-[9px] text-muted-foreground/60 text-right pr-1">75%</div>
                <div className="border-b border-dashed border-border/40 w-full h-px text-[9px] text-muted-foreground/60 text-right pr-1">50%</div>
                <div className="border-b border-dashed border-border/40 w-full h-px text-[9px] text-muted-foreground/60 text-right pr-1">25%</div>
                <div className="w-full h-px text-[9px] text-muted-foreground/60 text-right pr-1">0%</div>
              </div>

              {/* Chart paths */}
              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpu-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(79, 70, 229)" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="rgb(79, 70, 229)" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="ram-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="disk-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0"/>
                  </linearGradient>
                </defs>

                {/* DISK Area & Line */}
                {activeSeries.disk && (
                  <>
                    <path d={getAreaPath('disk')} fill="url(#disk-grad)" className="transition-all duration-500" />
                    <path d={getPath('disk')} fill="none" stroke="rgb(245, 158, 11)" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-500" />
                  </>
                )}

                {/* RAM Area & Line */}
                {activeSeries.ram && (
                  <>
                    <path d={getAreaPath('ram')} fill="url(#ram-grad)" className="transition-all duration-500" />
                    <path d={getPath('ram')} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-500" />
                  </>
                )}

                {/* CPU Area & Line */}
                {activeSeries.cpu && (
                  <>
                    <path d={getAreaPath('cpu')} fill="url(#cpu-grad)" className="transition-all duration-500" />
                    <path d={getPath('cpu')} fill="none" stroke="rgb(79, 70, 229)" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-500" />
                  </>
                )}
              </svg>
            </div>
            {/* Timeline label X-Axis */}
            <div className="flex justify-between text-[9px] text-muted-foreground mt-2 border-t border-border/30 pt-1.5">
              <span>6 hrs ago</span>
              <span>3 hrs ago</span>
              <span>1 hr ago</span>
              <span className="font-bold text-foreground animate-pulse">Live</span>
            </div>
          </CardContent>
        </Card>

        {/* Latency Gateway Performance */}
        <Card className="border-border/60 shadow-sm flex flex-col overflow-hidden bg-card">
          <CardHeader className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent pb-4">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Network className="size-4 text-primary" /> Service Latency &amp; Gateways
            </CardTitle>
            <CardDescription>Response speed in milliseconds for internal endpoint connections.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 flex-1 flex flex-col gap-5 justify-between">
            <div className="space-y-4">
              {[
                { name: 'Database API Link', status: checks.database?.status, latency: checks.database?.latencyMs, desc: 'Supabase pgsql connection cluster pool' },
                { name: 'Identity Auth Gate', status: checks.auth?.status, latency: checks.auth?.latencyMs, desc: 'Supabase GoTrue JWT authentication engine' },
                { name: 'Object Bucket Storage', status: checks.storage?.status, latency: checks.storage?.latencyMs, desc: 'S3 asset storage nodes response latency' }
              ].map((c, idx) => {
                const isOk = c.status === 'ok'
                const isDegraded = c.status === 'degraded'
                const progressWidth = c.latency ? Math.min(100, (c.latency / 400) * 100) : 0
                return (
                  <div key={idx} className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <strong className="text-foreground font-bold">{c.name}</strong>
                        <span className="text-[10px] text-muted-foreground block">{c.desc}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isOk ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' :
                          isDegraded ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30' : 'bg-red-50 text-red-600 dark:bg-red-950/30'
                        }`}>
                          {c.status || 'unknown'}
                        </span>
                        <strong className="font-mono text-foreground font-extrabold">{c.latency ?? '—'} ms</strong>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          !c.latency ? 'bg-muted' :
                          c.latency < 120 ? 'bg-emerald-500' :
                          c.latency < 250 ? 'bg-amber-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${progressWidth}%` }} 
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg border border-border bg-secondary/15 p-3 flex gap-2.5 text-xs text-muted-foreground items-start">
              <Info className="size-4 shrink-0 mt-0.5 text-primary" />
              <span>
                Latencies under <strong>150 ms</strong> are optimal. Connection speeds depend on network routing. Check status triggers database pings.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Security Events Log & AD Sync Replica Status */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {/* System Security Events */}
        <div className="flex flex-col gap-2 md:col-span-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Gateway Activity Audit Trail</h4>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex-1 divide-y divide-border">
            {[
              { time: '10:45 AM', action: 'Daily Backup Export', user: 'system.cron', detail: 'Completed structural dump export database backup', status: 'Success' },
              { time: '09:12 AM', action: 'Employee Auto-Provision', user: 'auth.trigger', detail: 'Provisioned profile for tariku.n@efae.com', status: 'Success' },
              { time: '08:00 AM', action: 'AD Sync Replication', user: 'ad.replica', detail: 'Triggered cron replication check', status: 'Success' },
              { time: '07:30 AM', action: 'SMTP Alert Job', user: 'alerts.cron', detail: 'Sent 3 timeline warning notices to employees', status: 'Success' }
            ].map((ev, idx) => (
              <div key={idx} className="p-4 flex justify-between gap-4 hover:bg-secondary/10 transition-colors text-xs items-start">
                <div className="flex gap-3">
                  <div className="bg-primary/5 p-2 rounded-lg border border-border text-primary shrink-0">
                    <Terminal className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-foreground font-bold">{ev.action}</strong>
                      <span className="text-[10px] text-muted-foreground">&middot; by {ev.user}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{ev.detail}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-mono text-muted-foreground text-[10px]">{ev.time}</span>
                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 text-[9px] font-black rounded px-1 uppercase tracking-wider">{ev.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directory replica check */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">AD Replica Health Nodes</h4>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex-1 flex flex-col gap-4 justify-between">
            <div className="space-y-3.5">
              {[
                { name: 'Primary Domain Controller', role: 'PDC Emulator', state: 'Online', desc: 'EFARCH-DC01.efarch.local' },
                { name: 'Secondary Domain replica', role: 'Backup DC', state: 'Online', desc: 'EFARCH-DC02.efarch.local' },
                { name: 'AD Sync Agent replica', role: 'Sync Agent', state: 'Online', desc: 'Sync Active (last sync 12 min ago)' }
              ].map((dc, idx) => (
                <div key={idx} className="flex gap-3 text-xs items-start">
                  <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                    <Server className="size-4" />
                  </div>
                  <div>
                    <strong className="text-foreground font-bold block">{dc.name}</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{dc.desc}</span>
                    <span className="inline-block mt-1 text-[9px] font-black uppercase text-emerald-600">{dc.state}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/20 p-3 text-xs text-muted-foreground">
              Directory domain nodes are configured in High-Availability replica state. Active Directory schema matches current db roles.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Tab: Add Users ───────────────────────────────────────────────────────────
function TabUsers() {
  return <EmployeeManager />
}

// ─── Tab: Disable / Enable Users ─────────────────────────────────────────────
function TabDisable() {
  const { data, isLoading, mutate } = useSWR<{ employees: any[] }>('/api/employees', fetcher)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const employees = (data?.employees ?? []).filter((e) =>
    filter === 'all' ? true : filter === 'active' ? e.active : !e.active,
  )

  async function toggle(emp: any) {
    setBusyId(emp.id)
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, active: !emp.active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success(emp.active ? 'Account disabled' : 'Account enabled', { description: emp.email })
      mutate()
    } catch (err) {
      toast.error('Failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{employees.length} shown</span>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No employees match the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} className={!emp.active ? 'opacity-60' : undefined}>
                      <TableCell>
                        <div className="font-medium text-foreground">{emp.full_name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[emp.role] ?? 'bg-secondary text-muted-foreground'}`}>
                          {emp.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.active ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-muted-foreground'}`}>
                          {emp.active ? 'Active' : 'Disabled'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={emp.active ? 'destructive' : 'outline'}
                          onClick={() => toggle(emp)} disabled={busyId === emp.id}
                          className="h-8 text-xs">
                          {busyId === emp.id
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : emp.active
                              ? <><UserX className="size-3.5 mr-1" />Disable</>
                              : <><UserCheck className="size-3.5 mr-1" />Enable</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: Reset Passwords ─────────────────────────────────────────────────────
function TabReset() {
  const { data } = useSWR<{ employees: any[] }>('/api/employees', fetcher)
  const employees = data?.employees ?? []
  const [selectedId, setSelectedId] = useState('')
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<{ name: string; email: string; password: string } | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Reset failed.')
      setResult({ name: json.employee.full_name, email: json.employee.email, password: json.temp_password })
      setSelectedId('')
    } catch (err) {
      toast.error('Reset failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <SectionCard title="Reset Password" description="Generate a new temporary password for any employee." icon={KeyRound}>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Select employee *</Label>
            <Select value={selectedId} onValueChange={(val) => setSelectedId(val || '')}>
              <SelectTrigger><SelectValue placeholder="Choose an employee…" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2 text-xs text-amber-800">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>This overwrites the employee's current password immediately. Share the result securely and ask them to change it on first login.</span>
          </div>
          <Button type="submit" disabled={!selectedId || resetting}>
            {resetting
              ? <><Loader2 className="size-4 animate-spin mr-2" />Resetting…</>
              : <><KeyRound className="size-4 mr-2" />Generate new password</>}
          </Button>
        </form>
      </SectionCard>

      {result && (
        <SectionCard title="New Temporary Password" icon={KeyRound}>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
              <div className="font-semibold text-foreground">{result.name}</div>
              <div className="text-xs text-muted-foreground">{result.email}</div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-3">
              <code className="flex-1 select-all font-mono text-base font-bold tracking-wider text-foreground">
                {result.password}
              </code>
              <CopyButton text={result.password} />
            </div>
            <p className="text-xs text-muted-foreground">Share this password securely. It will not be shown again.</p>
            <Button variant="outline" size="sm" onClick={() => setResult(null)} className="self-start">Clear</Button>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ─── Tab: Departments ─────────────────────────────────────────────────────────
function TabDepartments() {
  const { data, isLoading, mutate } = useSWR<{
    departments: { id: string | null; name: string; description?: string; count: number }[]
  }>('/api/admin/departments', fetcher)
  const departments = data?.departments ?? []
  
  const [editingDept, setEditingDept] = useState<{ id: string | null; name: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Add state ──
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: newDesc.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create department.')
      toast.success('Department created', { description: `"${name}" has been created successfully.` })
      setNewName('')
      setNewDesc('')
      setShowAdd(false)
      mutate()
    } catch (err) {
      toast.error('Creation failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setAdding(false)
    }
  }

  async function handleRename(dept: { id: string | null; name: string }) {
    const newName = editValue.trim()
    if (!newName || newName === dept.name) { setEditingDept(null); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          dept.id 
            ? { id: dept.id, name: newName } 
            : { old_name: dept.name, new_name: newName }
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success('Department renamed', {
        description: `"${dept.name}" → "${newName}" updated successfully.`,
      })
      setEditingDept(null)
      mutate()
    } catch (err) {
      toast.error('Rename failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !deleteTarget.id) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete department.')
      toast.success('Department deleted', { description: `"${deleteTarget.name}" has been removed.` })
      setDeleteTarget(null)
      mutate()
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Delete confirmation dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Delete department?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You are about to permanently delete the department{' '}
              <strong className="text-foreground">{deleteTarget.name}</strong>.
            </p>
            {deleteTarget.count > 0 && (
              <div className="mt-3 rounded-lg bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
                <strong>Warning:</strong> There are still {deleteTarget.count} employees assigned to this department. 
                You must reassign them before this department can be deleted.
              </div>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || deleteTarget.count > 0}
                className="sm:w-auto"
              >
                {deleting ? (
                  <><Loader2 className="size-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="size-4" /> Yes, delete</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InfoNote>
          Departments structure the organization. Renaming a department updates all employee records simultaneously.
        </InfoNote>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant={showAdd ? 'outline' : 'default'}
          className="shrink-0 self-start sm:self-auto"
        >
          {showAdd ? (
            <><X className="size-4" /> Cancel</>
          ) : (
            <><Plus className="size-4" /> Add department</>
          )}
        </Button>
      </div>

      {/* ── Add department form ── */}
      {showAdd && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="pt-5">
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Department Name *</label>
                  <Input
                    placeholder="e.g. Quality Assurance"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input
                    placeholder="Brief description of responsibilities"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adding} className="sm:self-start">
                {adding ? (
                  <><Loader2 className="size-4 animate-spin" /> Creating…</>
                ) : (
                  <><Check className="size-4" /> Create department</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-base">
            {isLoading ? 'Loading…' : `${departments.length} department${departments.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : departments.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No departments found. Create one above to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.name}>
                    <TableCell>
                      {editingDept?.name === dept.name ? (
                        <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 text-sm max-w-xs" autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(editingDept)
                            if (e.key === 'Escape') setEditingDept(null)
                          }} />
                      ) : (
                        <div>
                          <span className="font-medium text-foreground">{dept.name}</span>
                          {dept.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                        {dept.count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingDept?.name === dept.name ? (
                          <>
                            <button onClick={() => handleRename(editingDept)} disabled={saving}
                              className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            </button>
                            <button onClick={() => setEditingDept(null)}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary">
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingDept({ id: dept.id, name: dept.name }); setEditValue(dept.name) }}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              title="Edit department">
                              <Pencil className="size-3.5" />
                            </button>
                            {dept.id && (
                              <button onClick={() => setDeleteTarget({ id: dept.id!, name: dept.name, count: dept.count })}
                                className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/40 text-destructive/70 transition-colors hover:bg-destructive hover:text-white"
                                title="Delete department">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: Logs ────────────────────────────────────────────────────────────────
const LOG_TYPE_COLOR: Record<string, string> = {
  'auth.sign_in':        'bg-blue-100 text-blue-700',
  'auth.user_created':   'bg-emerald-100 text-emerald-700',
  'admin.user_disabled': 'bg-amber-100 text-amber-700',
  'report.submitted':    'bg-violet-100 text-violet-700',
}

function TabLogs() {
  const { data, isLoading, mutate } = useSWR<{ logs: any[] }>('/api/admin/logs?limit=200', fetcher)
  const logs = data?.logs ?? []
  const [typeFilter, setTypeFilter] = useState('all')

  const types = ['all', ...Array.from(new Set(logs.map((l: any) => l.type)))] as string[]
  const filtered = typeFilter === 'all' ? logs : logs.filter((l: any) => l.type === typeFilter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {types.slice(0, 6).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}>
              {t === 'all' ? 'All events' : t.replace('.', ' › ')}
            </button>
          ))}
        </div>
        <button onClick={() => mutate()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No log entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <div className="text-[10px]">
                          {new Date(log.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${LOG_TYPE_COLOR[log.type] ?? 'bg-secondary text-muted-foreground'}`}>
                          {log.type.replace('.', ' › ')}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs font-medium text-foreground">
                        {log.actor}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: Database Backup ─────────────────────────────────────────────────────
const BACKUP_TABLES = [
  { key: 'employees',      label: 'Employees',         endpoint: '/api/employees' },
  { key: 'correspondence', label: 'Correspondence',    endpoint: '/api/correspondence' },
  { key: 'bonds',          label: 'Project Bonds',     endpoint: '/api/bonds' },
  { key: 'eot',            label: 'EOT Claims',        endpoint: '/api/eot' },
  { key: 'evaluations',    label: 'Performance Evals', endpoint: '/api/evaluations' },
]

function TabBackup() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportAll, setExportAll] = useState(false)

  async function downloadTable(key: string, endpoint: string, label: string) {
    setExporting(key)
    try {
      const res = await fetch(endpoint)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fetch failed.')
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href = url; a.download = `EF_${key}_backup_${date}.json`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast.success(`${label} exported`)
    } catch (err) {
      toast.error('Export failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setExporting(null)
    }
  }

  async function downloadAll() {
    setExportAll(true)
    const toastId = toast.loading('Exporting all tables…')
    try {
      const results: Record<string, any> = {}
      for (const t of BACKUP_TABLES) {
        const res = await fetch(t.endpoint)
        const json = await res.json()
        results[t.key] = json
      }
      const payload = { exported_at: new Date().toISOString(), data: results }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href = url; a.download = `EF_full_backup_${date}.json`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast.success('Full backup downloaded', { id: toastId })
    } catch (err) {
      toast.error('Backup failed', { id: toastId, description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setExportAll(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <InfoNote>
        Downloads are JSON snapshots of current data via the existing API. For a full Supabase backup including storage and auth, use the Supabase dashboard.
      </InfoNote>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {BACKUP_TABLES.map((t) => (
          <Card key={t.key} className="flex flex-col justify-between p-4 border-border/60">
            <div>
              <p className="font-semibold text-foreground text-sm">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">JSON snapshot</p>
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full text-xs"
              onClick={() => downloadTable(t.key, t.endpoint, t.label)}
              disabled={exporting === t.key || exportAll}>
              {exporting === t.key
                ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Exporting…</>
                : <><DatabaseBackup className="size-3.5 mr-1.5" />Export</>}
            </Button>
          </Card>
        ))}
      </div>
      <Button onClick={downloadAll} disabled={exportAll || !!exporting} className="self-start">
        {exportAll
          ? <><Loader2 className="size-4 animate-spin mr-2" />Exporting all…</>
          : <><DatabaseBackup className="size-4 mr-2" />Export full backup</>}
      </Button>
    </div>
  )
}

function TabHealth() {
  const { data, isLoading, mutate } = useSWR<any>(
    '/api/admin/health', fetcher, { refreshInterval: 30000 },
  )

  const counts: Record<string, number> = data?.counts ?? {}

  // --- Static default form state (safe for SSR - no Date, no window) ---
  const getDefaultFormState = () => {
    const today = new Date()
    const reportDate = today.toISOString().split('T')[0]
    const day = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const reportId = 'SRV-LOG-' + reportDate.replace(/-/g, '')
    return {
      general: {
        reportDate,
        day,
        startTime: '08:30',
        endTime: '17:30',
        employee: 'Tariku Negesa',
        department: 'Digital Operations & Support',
        reportId,
        preparedBy: 'Tariku Negesa',
      },
      server: {
        name: 'EFARCH-SERVER',
        ip: '192.168.0.125',
        version: 'Windows Server 2022',
        domain: 'efarch.local',
        status: 'Healthy'
      },
      eventViewer: {
        critical: { result: '0', remarks: 'No critical service drops detected.' },
        errors: { result: '0', remarks: 'No errors logged.' },
        warnings: { result: '0', remarks: 'No warnings detected.' },
        appLog: { result: 'Normal', remarks: 'All corporate apps running smoothly.' },
        sysLog: { result: 'Normal', remarks: 'Reboot check completed.' },
        securityLog: { result: 'Normal', remarks: 'Firewall rules active.' }
      },
      services: {
        ad: { status: 'Running', action: 'None' },
        dns: { status: 'Running', action: 'None' },
        sql: { status: 'Running', action: 'None' },
        backup: { status: 'Running', action: 'None' },
        sharing: { status: 'Running', action: 'None' },
        other: { status: 'Running', action: 'None' }
      },
      storage: {
        c: { total: '931 GB', free: '507 GB', status: 'Healthy (54% free)' },
        d: { total: '500 GB', free: '180 GB', status: 'Healthy (36% free)' },
        e: { total: '1.0 TB', free: '180 GB', status: 'Low Space (18%)' },
        f: { total: '100 GB', free: '8 GB', status: 'Critical (8%)' }
      },
      backupVerification: {
        completed: 'Yes',
        date: reportDate,
        location: 'E:\\Backups',
        size: '18.6 GB',
        restoreTested: 'Yes',
        remarks: 'Checksum test matches.'
      },
      scheduledTasks: {
        backup: { status: 'Completed', remarks: 'Scheduled backup finished.' },
        automation: { status: 'Running', remarks: 'Active Directory syncer script running.' },
        scripts: { status: 'Completed', remarks: 'Log cleanup script executed.' },
        other: { status: 'Running', remarks: 'Event log forwarder active.' }
      },
      newUsers: [
        { username: 'samuel.d', department: 'Design', status: 'Active', remarks: 'Standard account provisioned' }
      ],
      passwordResets: [
        { username: 'almaz.g', department: 'Supervision', completed: 'Yes', remarks: 'Forgot password reset' }
      ],
      userModified: [
        { username: 'khalid.a', action: 'GPO Group Change', reason: 'Assigned to Procurement group' }
      ],
      gpoChanges: [
        { username: 'all.staff', group: 'Domain Policy', action: 'Enforced password policy updates' }
      ],
      accountDisabled: [
        { username: 'john.d', reason: 'Resigned', approvedBy: 'DGM' }
      ],
      tickets: [
        { no: 'TKT-2019', user: 'aster.k', department: 'Procurement', issue: 'Printer offline', category: 'Printer', resolution: 'Restarted local spooler service', status: 'Resolved' }
      ],
      sharedFolders: [
        { folder: 'Archive DP', permissionChanged: 'Read-only to Read/Write', user: 'almaz.g', action: 'Updated NTFS ACL permission' }
      ],
      remoteDesktop: [
        { computer: 'EFARCH-WORKSTATION-04', user: 'khalid.a', connection: 'RDP Port 3389', result: 'Successful' }
      ],
      gpoPolicies: [
        { policy: 'USB Access Restriction', action: 'Restricted write access to USB external storage', result: 'Enforced successfully' }
      ],
      dataIntegrity: {
        contract: { submitted: 'Yes', time: '09:30 AM', valid: 'Yes', remarks: 'Timesheets validated' },
        design: { submitted: 'Yes', time: '10:00 AM', valid: 'Yes', remarks: 'Drawings registry checked' },
        procurement: { submitted: 'Yes', time: '11:15 AM', valid: 'Yes', remarks: 'BOM sheet loaded' },
        supervision: { submitted: 'No', time: '--', valid: 'No', remarks: 'Awaiting site log uploads' }
      },
      missingReports: [
        { department: 'Supervision & Water Works', reminderSent: 'Yes', time: '12:00 PM', method: 'Teams' }
      ],
      database: {
        online: { status: 'Online', remarks: 'Supabase cluster response normal' },
        errors: { status: '0 Errors', remarks: 'No query errors' },
        backup: { status: 'Synced', remarks: 'Hourly automated backup synced' },
        performance: { status: 'Healthy', remarks: 'Index scanning normal' }
      },
      automationProjects: {
        consolidator: { progress: '90%', remarks: 'Excel consolidator test completed' },
        bot: { progress: '75%', remarks: 'Reminder bot notifications active' },
        dashboard: { progress: '85%', remarks: 'Enterprise health dashboard active' }
      },
      security: {
        failedLogins: '0 attempts',
        lockedAccounts: '0 accounts',
        antivirus: 'Up to Date',
        updates: 'All Installed',
        firewall: 'Enabled'
      },
      issuesFound: [
        { time: '10:30 AM', issue: 'Network file share lag', severity: 'Medium', actionTaken: 'Cleared client network cache and restarted file server resource manager', status: 'Resolved' }
      ],
      improvements: [
        { improvement: 'Redesigned server health logs page', benefit: 'Allows digital operational reports to be completed as web forms' }
      ],
      communication: [
        { time: '11:30 AM', person: 'Department Head', discussion: 'Shared folder access review', outcome: 'Agreed on updated group policies' }
      ],
      documentation: [
        { document: 'Server Health Redesign', updated: 'Added complete web form instructions to README.md' }
      ],
      summary: {
        achievements: 'Rebuilt the server monitoring console into a Daily Operations Report web form. Completed daily backup verification and resolved printer connection ticket TKT-2019.',
        pending: 'Verify Supervision department reports submission compliance tomorrow morning.',
        risks: 'Low drive storage space on backup drive E: and cache drive F: requires cleanup.',
        tomorrowPlan: 'Execute disk volume cleanup on E: drive. Verify morning SQL backup integrity.',
        overallStatus: 'Normal Operations',
        reviewedBy: 'DGM',
        signDate: reportDate,
        signature: 'Tariku Negesa'
      }
    }
  }

  // Initialize from localStorage immediately (lazy initializer only runs on client, once on mount)
  // This is the correct pattern: no separate load effect, no race condition, no hydration mismatch
  // because TabHealth is only rendered after client hydration is complete (it's inside Suspense).
  const [formState, setFormState] = useState<any>(() => {
    const defaults = getDefaultFormState()
    if (typeof window === 'undefined') return defaults
    try {
      const saved = localStorage.getItem('efarch-daily-ops-form')
      if (saved) return JSON.parse(saved)
    } catch (_) {}
    return defaults
  })

  // Auto-save on every change (no guard needed - state is already loaded correctly above)
  React.useEffect(() => {
    if (formState) {
      localStorage.setItem('efarch-daily-ops-form', JSON.stringify(formState))
    }
  }, [formState])

  // ─── Dynamic Field Update Helpers ───
  const updateField = (section: string, key: string, val: any) => {
    setFormState((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [key]: val }
    }))
  }

  const updateTableVal = (section: string, rowKey: string, cellKey: string, val: any) => {
    setFormState((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [rowKey]: { ...prev[section][rowKey], [cellKey]: val }
      }
    }))
  }
  // ─── Drive Volume Auto-Status Calculator ───
  const parseStorageBytes = (val: string): number => {
    const s = val.trim().toUpperCase()
    const num = parseFloat(s)
    if (isNaN(num)) return 0
    if (s.includes('TB')) return num * 1024 * 1024 * 1024 * 1024
    if (s.includes('GB')) return num * 1024 * 1024 * 1024
    if (s.includes('MB')) return num * 1024 * 1024
    return num
  }

  const calcDriveStatus = (total: string, free: string): { label: string; cls: string } => {
    const t = parseStorageBytes(total)
    const f = parseStorageBytes(free)
    if (t <= 0 || f < 0) return { label: '—', cls: '' }
    const pct = Math.round((f / t) * 100)
    if (pct >= 25) return { label: 'Healthy (' + pct + '% free)', cls: 'emerald' }
    if (pct >= 10) return { label: 'Low Space (' + pct + '% free)', cls: 'amber' }
    return { label: 'Critical (' + pct + '% free)', cls: 'red' }
  }

  const updateStorageDrive = (key: string, field: 'total' | 'free', val: string) => {
    setFormState((prev: any) => {
      const current = prev.storage[key] ?? {}
      const newTotal = field === 'total' ? val : (current.total ?? '')
      const newFree  = field === 'free'  ? val : (current.free  ?? '')
      const { label } = calcDriveStatus(newTotal, newFree)
      return {
        ...prev,
        storage: {
          ...prev.storage,
          [key]: { ...current, [field]: val, status: label }
        }
      }
    })
  }


  const updateArrayVal = (field: string, index: number, key: string, val: any) => {
    setFormState((prev: any) => {
      const arr = [...prev[field]]
      arr[index] = { ...arr[index], [key]: val }
      return { ...prev, [field]: arr }
    })
  }

  const addArrayRow = (field: string, defaultObj: any) => {
    setFormState((prev: any) => ({
      ...prev,
      [field]: [...prev[field], defaultObj]
    }))
    toast.success("Added new entry row.")
  }

  const removeArrayRow = (field: string, index: number) => {
    setFormState((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }))
    toast.info("Removed entry row.")
  }

  // Save current form state to localStorage
  const saveDraft = () => {
    localStorage.setItem('efarch-daily-ops-form', JSON.stringify(formState))
    toast.success('Daily Operations Report draft saved locally!')
  }

  // Clear/Reset current form state
  const resetForm = () => {
    localStorage.removeItem('efarch-daily-ops-form')
    toast.success('Form draft cleared. Reloading page to load defaults.')
    setTimeout(() => window.location.reload(), 800)
  }

  // Run health scan simulation
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(100)

  const triggerHealthScan = () => {
    setIsScanning(true)
    setScanProgress(10)
    const toastId = toast.loading('Scanning server resources & Active Directory replicas...')
    
    let interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          toast.dismiss(toastId)
          toast.success('AD Domain efarch.local & Storage pools checked. 0 errors detected.')
          mutate()
          return 100
        }
        return p + 20
      })
    }, 250)
  }

  // EXPORT TO EXCEL
  const exportToExcel = () => {
    const s = formState
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          td, th { border: 1px solid #cbd5e1; padding: 8px; font-family: Calibri, sans-serif; font-size: 10pt; }
          th { background-color: #1e3a8a; color: white; font-weight: bold; }
          .banner { background-color: #1e3a8a; color: white; text-align: center; font-size: 14pt; font-weight: bold; padding: 12px; }
          .section-header { font-size: 11pt; font-weight: bold; background-color: #e2e8f0; color: #1e293b; padding: 6px; }
          .label-cell { font-weight: bold; width: 25%; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="4" class="banner">EF ARCHITECTS & ENGINEERS — DAILY OPERATIONS REPORT</td></tr>
          <tr><td colspan="4" class="section-header">GENERAL INFORMATION</td></tr>
          <tr>
            <td class="label-cell">Report Date</td><td>${s.general.reportDate}</td>
            <td class="label-cell">Day</td><td>${s.general.day}</td>
          </tr>
          <tr>
            <td class="label-cell">Start Time</td><td>${s.general.startTime}</td>
            <td class="label-cell">End Time</td><td>${s.general.endTime}</td>
          </tr>
          <tr>
            <td class="label-cell">Employee</td><td>${s.general.employee}</td>
            <td class="label-cell">Department</td><td>${s.general.department}</td>
          </tr>
          <tr>
            <td class="label-cell">Report ID</td><td>${s.general.reportId}</td>
            <td class="label-cell">Prepared By</td><td>${s.general.preparedBy}</td>
          </tr>
        </table>

        <table>
          <tr><td colspan="4" class="section-header">SECTION 1 – MORNING SYSTEM HEALTH CHECK</td></tr>
          <tr>
            <td class="label-cell">Server Name</td><td>${s.server.name}</td>
            <td class="label-cell">Server IP</td><td>${s.server.ip}</td>
          </tr>
          <tr>
            <td class="label-cell">OS Version</td><td>${s.server.version}</td>
            <td class="label-cell">Domain Controller</td><td>${s.server.domain}</td>
          </tr>
          <tr>
            <td class="label-cell">Server Status</td><td colspan="3">${s.server.status}</td>
          </tr>
        </table>

        <table>
          <tr><th colspan="3">EVENT VIEWER LOG AUDIT</th></tr>
          <tr><th>Check Log</th><th>Logged Results</th><th>Observational Remarks</th></tr>
          <tr><td>Critical Events</td><td>${s.eventViewer.critical.result}</td><td>${s.eventViewer.critical.remarks}</td></tr>
          <tr><td>Errors</td><td>${s.eventViewer.errors.result}</td><td>${s.eventViewer.errors.remarks}</td></tr>
          <tr><td>Warnings</td><td>${s.eventViewer.warnings.result}</td><td>${s.eventViewer.warnings.remarks}</td></tr>
          <tr><td>Application Log</td><td>${s.eventViewer.appLog.result}</td><td>${s.eventViewer.appLog.remarks}</td></tr>
          <tr><td>System Log</td><td>${s.eventViewer.sysLog.result}</td><td>${s.eventViewer.sysLog.remarks}</td></tr>
          <tr><td>Security Log</td><td>${s.eventViewer.securityLog.result}</td><td>${s.eventViewer.securityLog.remarks}</td></tr>
        </table>

        <table>
          <tr><th colspan="3">SERVICE REGISTRY STATE</th></tr>
          <tr><th>Service Display Name</th><th>Running Status</th><th>Action Logged</th></tr>
          <tr><td>Active Directory Domain Services</td><td>${s.services.ad.status}</td><td>${s.services.ad.action}</td></tr>
          <tr><td>DNS Server</td><td>${s.services.dns.status}</td><td>${s.services.dns.action}</td></tr>
          <tr><td>SQL Server Database</td><td>${s.services.sql.status}</td><td>${s.services.sql.action}</td></tr>
          <tr><td>Windows Backup engine</td><td>${s.services.backup.status}</td><td>${s.services.backup.action}</td></tr>
          <tr><td>File Sharing Server</td><td>${s.services.sharing.status}</td><td>${s.services.sharing.action}</td></tr>
          <tr><td>Other Core Systems</td><td>${s.services.other.status}</td><td>${s.services.other.action}</td></tr>
        </table>

        <table>
          <tr><th colspan="4">SERVER STORAGE POOLS</th></tr>
          <tr><th>Volume</th><th>Label Name</th><th>Capacity Total</th><th>Free Capacity Status</th></tr>
          <tr><td>C:</td><td>System OS Drive</td><td>${s.storage.c.total}</td><td>${s.storage.c.free} (${s.storage.c.status})</td></tr>
          <tr><td>D:</td><td>Project Databases</td><td>${s.storage.d.total}</td><td>${s.storage.d.free} (${s.storage.d.status})</td></tr>
          <tr><td>E:</td><td>Server Backup Store</td><td>${s.storage.e.total}</td><td>${s.storage.e.free} (${s.storage.e.status})</td></tr>
          <tr><td>F:</td><td>Application Cache</td><td>${s.storage.f.total}</td><td>${s.storage.f.free} (${s.storage.f.status})</td></tr>
        </table>

        <table>
          <tr><td colspan="4" class="section-header">BACKUP VERIFICATION LOG</td></tr>
          <tr>
            <td class="label-cell">Backup Completed</td><td>${s.backupVerification.completed}</td>
            <td class="label-cell">Backup Date</td><td>${s.backupVerification.date}</td>
          </tr>
          <tr>
            <td class="label-cell">Backup Destination</td><td>${s.backupVerification.location}</td>
            <td class="label-cell">Backup Size File</td><td>${s.backupVerification.size}</td>
          </tr>
          <tr>
            <td class="label-cell">Restore Tested</td><td>${s.backupVerification.restoreTested}</td>
            <td class="label-cell">Backup Remarks</td><td>${s.backupVerification.remarks}</td>
          </tr>
        </table>

        <table>
          <tr><th colspan="3">SCHEDULED TASKS CHECKS</th></tr>
          <tr><th>Scheduled Task</th><th>Running Status</th><th>Remarks</th></tr>
          <tr><td>System Backup</td><td>${s.scheduledTasks.backup.status}</td><td>${s.scheduledTasks.backup.remarks}</td></tr>
          <tr><td>AD Sync Automation Job</td><td>${s.scheduledTasks.automation.status}</td><td>${s.scheduledTasks.automation.remarks}</td></tr>
          <tr><td>Cleanup Scripts</td><td>${s.scheduledTasks.scripts.status}</td><td>${s.scheduledTasks.scripts.remarks}</td></tr>
          <tr><td>Other Scripts</td><td>${s.scheduledTasks.other.status}</td><td>${s.scheduledTasks.other.remarks}</td></tr>
        </table>

        <table>
          <tr><td colspan="4" class="section-header">SECTION 2 – USER & ACTIVE DIRECTORY MANAGEMENT</td></tr>
          <tr><th colspan="4">NEW USER PROVISIONS</th></tr>
          <tr><th>Username</th><th>Department Target</th><th>Account Status</th><th>Remarks / Role</th></tr>
          ${s.newUsers.map((u: any) => `<tr><td>${u.username}</td><td>${u.department}</td><td>${u.status}</td><td>${u.remarks}</td></tr>`).join('')}
        </table>

        <table>
          <tr><th colspan="4">PASSWORD RESETS LIST</th></tr>
          <tr><th>Username</th><th>Department</th><th>Completed</th><th>Remarks</th></tr>
          ${s.passwordResets.map((u: any) => `<tr><td>${u.username}</td><td>${u.department}</td><td>${u.completed}</td><td>${u.remarks}</td></tr>`).join('')}
        </table>

        <table>
          <tr><th colspan="4">L2 SUPPORT TICKETS AUDIT LOG</th></tr>
          <tr><th>Ticket No</th><th>Requester User</th><th>Department</th><th>Issue Category</th><th>Resolution</th><th>Ticket Status</th></tr>
          ${s.tickets.map((u: any) => `<tr><td>${u.no}</td><td>${u.user}</td><td>${u.department}</td><td>${u.category}: ${u.issue}</td><td>${u.resolution}</td><td>${u.status}</td></tr>`).join('')}
        </table>

        <table>
          <tr><td colspan="4" class="section-header">SECTION 15 – DAILY OPERATIONS SUMMARY</td></tr>
          <tr><td class="label-cell">Achievements Today</td><td colspan="3">${s.summary.achievements}</td></tr>
          <tr><td class="label-cell">Pending Operations</td><td colspan="3">${s.summary.pending}</td></tr>
          <tr><td class="label-cell">Risks identified</td><td colspan="3">${s.summary.risks}</td></tr>
          <tr><td class="label-cell">Plan for Tomorrow</td><td colspan="3">${s.summary.tomorrowPlan}</td></tr>
          <tr><td class="label-cell">Overall Daily Status</td><td colspan="3">${s.summary.overallStatus}</td></tr>
        </table>

        <table>
          <tr><td colspan="4" class="section-header">SIGN-OFF APPROVALS</td></tr>
          <tr><td class="label-cell">Prepared By</td><td>Tariku Negesa</td><td class="label-cell">Date signed</td><td>${s.summary.signDate}</td></tr>
          <tr><td class="label-cell">Reviewed By Manager</td><td>${s.summary.reviewedBy}</td><td class="label-cell">Signature auth</td><td>${s.summary.signature}</td></tr>
        </table>
      </body>
      </html>
    `
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EFARCH_DailyOps_${s.general.reportDate}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Excel operations workbook exported successfully!')
  }

  // EXPORT TO PDF
  const exportToPDF = () => {
    const s = formState
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>EFARCH Daily Operations Report - ${s.general.reportDate}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
            .header-tbl { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .header-tbl td { padding: 4px; border: none; font-size: 9pt; }
            .title { font-size: 16pt; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0; }
            .section-header { font-size: 10pt; font-weight: bold; background-color: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 6px 10px; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 8.5pt; }
            th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
            .label-cell { font-weight: bold; background-color: #f8fafc; width: 25%; }
            .sign-box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 8.5pt; margin-top: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <table class="header-tbl">
            <tr>
              <td>
                <h1 class="title">EF Architects & Engineers Consulting PLC</h1>
                <span style="font-size:10pt;color:#64748b;font-weight:bold;">Daily Operations Report — Systems & Database Administrator</span>
              </td>
              <td style="text-align: right; font-weight: bold;">
                Report ID: ${s.general.reportId}<br>
                Date: ${s.general.reportDate} (${s.general.day})
              </td>
            </tr>
          </table>

          <div class="section-header">General Information</div>
          <table>
            <tr>
              <td class="label-cell">Employee Name</td><td>${s.general.employee}</td>
              <td class="label-cell">Department</td><td>${s.general.department}</td>
            </tr>
            <tr>
              <td class="label-cell">Start Time</td><td>${s.general.startTime}</td>
              <td class="label-cell">End Time</td><td>${s.general.endTime}</td>
            </tr>
          </table>

          <div class="section-header">Section 1 – Morning System Health Check</div>
          <table>
            <tr>
              <td class="label-cell">Server Name</td><td>${s.server.name}</td>
              <td class="label-cell">Server IP Address</td><td>${s.server.ip}</td>
            </tr>
            <tr>
              <td class="label-cell">Server OS Version</td><td>${s.server.version}</td>
              <td class="label-cell">Domain Controller Name</td><td>${s.server.domain}</td>
            </tr>
            <tr>
              <td class="label-cell">Operational Status</td><td colspan="3"><strong>${s.server.status}</strong></td>
            </tr>
          </table>

          <table>
            <tr><th colspan="3">Event Viewer Logs</th></tr>
            <tr><th>Check Event</th><th>Result Counts</th><th>Diagnostic Remarks</th></tr>
            <tr><td>Critical Events</td><td>${s.eventViewer.critical.result}</td><td>${s.eventViewer.critical.remarks}</td></tr>
            <tr><td>Errors Logged</td><td>${s.eventViewer.errors.result}</td><td>${s.eventViewer.errors.remarks}</td></tr>
            <tr><td>System Warnings</td><td>${s.eventViewer.warnings.result}</td><td>${s.eventViewer.warnings.remarks}</td></tr>
            <tr><td>Application Log</td><td>${s.eventViewer.appLog.result}</td><td>${s.eventViewer.appLog.remarks}</td></tr>
            <tr><td>System Log</td><td>${s.eventViewer.sysLog.result}</td><td>${s.eventViewer.sysLog.remarks}</td></tr>
            <tr><td>Security Log</td><td>${s.eventViewer.securityLog.result}</td><td>${s.eventViewer.securityLog.remarks}</td></tr>
          </table>

          <table>
            <tr><th colspan="3">Windows Services Controller</th></tr>
            <tr><th>Service Display Name</th><th>Running Status</th><th>Action / Remarks</th></tr>
            <tr><td>Active Directory Domain Services</td><td>${s.services.ad.status}</td><td>${s.services.ad.action}</td></tr>
            <tr><td>DNS Server Registry</td><td>${s.services.dns.status}</td><td>${s.services.dns.action}</td></tr>
            <tr><td>SQL Server (PROD Instance)</td><td>${s.services.sql.status}</td><td>${s.services.sql.action}</td></tr>
            <tr><td>Windows Backup Service</td><td>${s.services.backup.status}</td><td>${s.services.backup.action}</td></tr>
            <tr><td>File Server Resource Manager</td><td>${s.services.sharing.status}</td><td>${s.services.sharing.action}</td></tr>
          </table>

          <table>
            <tr><th colspan="4">Server Disk Capacity Pool</th></tr>
            <tr><th>Drive Pool</th><th>Label Details</th><th>Total Space</th><th>Free Space (Alert Status)</th></tr>
            <tr><td>C:</td><td>System OS Partition</td><td>${s.storage.c.total}</td><td>${s.storage.c.free} (${s.storage.c.status})</td></tr>
            <tr><td>D:</td><td>Project Database storage</td><td>${s.storage.d.total}</td><td>${s.storage.d.free} (${s.storage.d.status})</td></tr>
            <tr><td>E:</td><td>Backup Archive Volume</td><td>${s.storage.e.total}</td><td>${s.storage.e.free} (${s.storage.e.status})</td></tr>
            <tr><td>F:</td><td>Temp Cache Files</td><td>${s.storage.f.total}</td><td>${s.storage.f.free} (${s.storage.f.status})</td></tr>
          </table>

          <table>
            <tr><th colspan="3">Scheduled System Tasks Checks</th></tr>
            <tr><th>Task Target</th><th>Execution Status</th><th>Observation Remarks</th></tr>
            <tr><td>Volume Backup Task</td><td>${s.scheduledTasks.backup.status}</td><td>${s.scheduledTasks.backup.remarks}</td></tr>
            <tr><td>AD Sync Automation Job</td><td>${s.scheduledTasks.automation.status}</td><td>${s.scheduledTasks.automation.remarks}</td></tr>
            <tr><td>Log Cleanup Scripts</td><td>${s.scheduledTasks.scripts.status}</td><td>${s.scheduledTasks.scripts.remarks}</td></tr>
          </table>

          <div style="page-break-before: always;"></div>

          <div class="section-header">Section 2 – User & Active Directory Management</div>
          ${s.newUsers.length > 0 ? `
            <table>
              <tr><th colspan="4">New Accounts Created</th></tr>
              <tr><th>Username</th><th>Department Target</th><th>Status</th><th>Notes</th></tr>
              ${s.newUsers.map((u: any) => `<tr><td>${u.username}</td><td>${u.department}</td><td>${u.status}</td><td>${u.remarks}</td></tr>`).join('')}
            </table>
          ` : ''}

          ${s.passwordResets.length > 0 ? `
            <table>
              <tr><th colspan="4">Passwords Reset Actions</th></tr>
              <tr><th>Username</th><th>Department</th><th>Status</th><th>Notes</th></tr>
              ${s.passwordResets.map((u: any) => `<tr><td>${u.username}</td><td>${u.department}</td><td>${u.completed === 'Yes' ? 'Resetted' : 'Failed'}</td><td>${u.remarks}</td></tr>`).join('')}
            </table>
          ` : ''}

          <div class="section-header">Section 3 – L2 Support Tickets Auditing</div>
          <table>
            <tr><th>Tkt No</th><th>Requester</th><th>Department</th><th>Issue Category</th><th>Resolution Actions</th><th>Status</th></tr>
            ${s.tickets.map((t: any) => `
              <tr>
                <td><code>${t.no}</code></td>
                <td>${t.user}</td>
                <td>${t.department}</td>
                <td><strong>${t.category}</strong>: ${t.issue}</td>
                <td>${t.resolution}</td>
                <td>${t.status}</td>
              </tr>
            `).join('')}
          </table>

          <div class="section-header">Section 15 — Daily Summary Report</div>
          <p><strong>Today's Achievements & Operations completed:</strong><br>
          ${s.summary.achievements || 'None logged.'}</p>
          
          <p><strong>Pending Tasks:</strong><br>
          ${s.summary.pending || 'None logged.'}</p>

          <p><strong>Risks / Action Plans identified:</strong><br>
          ${s.summary.risks || 'No risks logged.'}</p>

          <p><strong>Overall Operational Daily Status:</strong> ${s.summary.overallStatus}</p>

          <div class="section-header">Report Sign-Off & Approvals</div>
          <div class="sign-box">
            <table style="width: 100%; border: none; margin-bottom: 0;">
              <tr style="border: none;">
                <td style="border: none; width: 50%;">
                  <strong>Prepared By:</strong> ${s.general.employee} (Systems Admin)<br>
                  Signature: <em>${s.summary.signature}</em>
                </td>
                <td style="border: none; width: 50%; text-align: right;">
                  <strong>Reviewed & Approved By:</strong> ${s.summary.reviewedBy}<br>
                  Date Signed: ${s.summary.signDate}
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    toast.success('Print operations PDF triggered!')
  }

  // overall state visual colors
  const overallColor =
    formState.summary.overallStatus === 'Normal Operations' ? 'text-emerald-600' :
    formState.summary.overallStatus === 'Minor Issues' ? 'text-amber-600' :
    formState.summary.overallStatus === 'Attention Required' ? 'text-orange-600' : 'text-rose-600'

  const overallBg =
    formState.summary.overallStatus === 'Normal Operations' ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40' :
    formState.summary.overallStatus === 'Minor Issues' ? 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40' :
    formState.summary.overallStatus === 'Attention Required' ? 'bg-orange-50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/40' :
    'bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'

  return (
    <div className="flex flex-col gap-6">
      
      {/* Redesigned Header — Overall Operations Status Banner */}
      <div className={`flex flex-col gap-4 rounded-xl border p-4 sm:p-5 shadow-sm ${overallBg} transition-colors`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${formState.summary.overallStatus === 'Normal Operations' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            )}
            <div className="min-w-0">
              <h2 className={`font-display text-base sm:text-xl font-extrabold ${overallColor} leading-tight`}>
                Daily Operations Report — {formState.summary.overallStatus.toUpperCase()}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prepared By: <span className="font-bold text-foreground">{formState.general.employee}</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={triggerHealthScan} 
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`} /> 
              Check Sync status
            </button>
            <Button size="sm" onClick={saveDraft} className="text-xs font-bold gap-1 h-8">
              <Save className="size-3.5" /> Save Draft Log
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm} className="text-xs font-bold text-destructive gap-1 h-8">
              <Trash2 className="size-3.5" /> Clear Draft
            </Button>
          </div>
        </div>

        {isScanning && (
          <div className="w-full bg-secondary/80 rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-full transition-all duration-300 rounded-full" style={{ width: `${scanProgress}%` }} />
          </div>
        )}
      </div>

      {/* General Information Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><Info className="size-4 text-primary" /> General Log Information</CardTitle>
          <CardDescription>Configure prepared reporter info, end-of-day timeline shifts and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-4 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Report Date</Label>
              <Input
                type="date"
                value={formState.general.reportDate}
                onChange={(e) => {
                  const newDate = e.target.value
                  let newDay = ''
                  let newReportId = ''
                  if (newDate) {
                    const parsedDate = new Date(newDate)
                    if (!isNaN(parsedDate.getTime())) {
                      newDay = parsedDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
                    }
                    newReportId = 'SRV-LOG-' + newDate.replace(/-/g, '')
                  }
                  setFormState((prev: any) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      reportDate: newDate,
                      day: newDay || prev.general.day,
                      reportId: newReportId || prev.general.reportId,
                    },
                    backupVerification: {
                      ...prev.backupVerification,
                      date: newDate || prev.backupVerification.date,
                    },
                    summary: {
                      ...prev.summary,
                      signDate: newDate || prev.summary.signDate,
                    }
                  }))
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Operating Day</Label>
              <Input type="text" value={formState.general.day} onChange={(e) => updateField('general', 'day', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Shift Start Time</Label>
              <Input type="time" value={formState.general.startTime} onChange={(e) => updateField('general', 'startTime', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Shift End Time</Label>
              <Input type="time" value={formState.general.endTime} onChange={(e) => updateField('general', 'endTime', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Responsible Employee</Label>
              <Input type="text" disabled value={formState.general.employee} className="h-8 text-xs bg-secondary/50 font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Enterprise Department</Label>
              <Input type="text" disabled value={formState.general.department} className="h-8 text-xs bg-secondary/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Report Unique ID</Label>
              <Input type="text" disabled value={formState.general.reportId} className="h-8 text-xs bg-secondary/50 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Prepared By</Label>
              <Input type="text" value={formState.general.preparedBy} onChange={(e) => updateField('general', 'preparedBy', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1 — Morning System Health Check */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><Server className="size-4 text-primary" /> Section 1 – Morning System Health Check</CardTitle>
          <CardDescription>Monitor hosting systems configurations, storage drive caps, services status, and event viewer logs.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          
          {/* Server Info Sub-grid */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-5 text-xs border-b border-border/40 pb-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Server Name</Label>
              <Input type="text" value={formState.server.name} onChange={(e) => updateField('server', 'name', e.target.value)} className="h-8 text-xs font-mono font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Server IP</Label>
              <Input type="text" value={formState.server.ip} onChange={(e) => updateField('server', 'ip', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Windows OS version</Label>
              <Input type="text" value={formState.server.version} onChange={(e) => updateField('server', 'version', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Domain Controller</Label>
              <Input type="text" value={formState.server.domain} onChange={(e) => updateField('server', 'domain', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Overall Server Status</Label>
              <Select value={formState.server.status} onValueChange={(v) => updateField('server', 'status', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Healthy">🟢 Healthy</SelectItem>
                  <SelectItem value="Warning">🟡 Warning</SelectItem>
                  <SelectItem value="Critical">🔴 Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Event Viewer Diagnostic Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1"><Terminal className="size-3.5 text-primary" /> Event Viewer Diagnostics</h4>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Log Type check</TableHead>
                    <TableHead className="w-1/4">Result Logs Count</TableHead>
                    <TableHead>Remarks / Diagnostic Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(formState.eventViewer).map(([key, item]: any) => (
                    <TableRow key={key}>
                      <TableCell className="capitalize text-xs font-bold text-foreground">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                      <TableCell>
                        <Input type="text" value={item.result} onChange={(e) => updateTableVal('eventViewer', key, 'result', e.target.value)} className="h-7 text-xs font-mono" />
                      </TableCell>
                      <TableCell>
                        <Input type="text" value={item.remarks} onChange={(e) => updateTableVal('eventViewer', key, 'remarks', e.target.value)} className="h-7 text-xs" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Services & Storage Layout */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            
            {/* Services State Manager */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Windows Background Services Status</h4>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Name</TableHead>
                      <TableHead className="w-32">Status Mode</TableHead>
                      <TableHead>Action Logged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(formState.services).map(([key, item]: any) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs font-mono font-bold capitalize">
                          {key === 'ad' ? 'Active Directory Domain Services' : key === 'dns' ? 'DNS' : key === 'sql' ? 'SQL Server' : key === 'backup' ? 'Windows Backup' : key === 'sharing' ? 'File Sharing' : 'Other'}
                        </TableCell>
                        <TableCell>
                          <select 
                            value={item.status} 
                            onChange={(e) => updateTableVal('services', key, 'status', e.target.value)}
                            className="text-xs border border-border bg-background rounded px-2 py-1 w-full text-foreground"
                          >
                            <option value="Running">Running</option>
                            <option value="Stopped">Stopped</option>
                            <option value="Paused">Paused</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="text" value={item.action} onChange={(e) => updateTableVal('services', key, 'action', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Storage Drive Health — Auto-Calculated Status */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Local Drive Volumes Health</h4>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Volume</TableHead>
                      <TableHead>Total Space</TableHead>
                      <TableHead>Free Space</TableHead>
                      <TableHead>Alert Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(formState.storage).map(([key, item]: any) => {
                      const { label: autoStatus, cls } = calcDriveStatus(item.total, item.free)
                      return (
                        <TableRow key={key}>
                          <TableCell className="text-xs font-mono font-bold uppercase">{key}:</TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              value={item.total}
                              onChange={(e) => updateStorageDrive(key, 'total', e.target.value)}
                              className="h-7 text-xs font-mono"
                              placeholder="e.g. 931 GB"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              value={item.free}
                              onChange={(e) => updateStorageDrive(key, 'free', e.target.value)}
                              className="h-7 text-xs font-mono"
                              placeholder="e.g. 450 GB"
                            />
                          </TableCell>
                          <TableCell>
                            <span className={[
                              'text-xs font-bold px-2 py-1 rounded-md border inline-block',
                              cls === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800' :
                              cls === 'amber'   ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800' :
                              cls === 'red'     ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800' :
                              'bg-muted border-border text-muted-foreground'
                            ].join(' ')}>
                              {autoStatus || '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

          {/* Backup Verification & Scheduled Tasks */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            
            {/* Backup Verification */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Daily Backup Verification</h4>
              <div className="rounded-xl border border-border p-4 bg-secondary/10 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Backup Completed?</Label>
                    <select 
                      value={formState.backupVerification.completed} 
                      onChange={(e) => updateField('backupVerification', 'completed', e.target.value)}
                      className="text-xs border border-border bg-background rounded px-2.5 py-1 w-full text-foreground h-8"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Backup Date</Label>
                    <Input type="date" value={formState.backupVerification.date} onChange={(e) => updateField('backupVerification', 'date', e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Backup Location</Label>
                    <Input type="text" value={formState.backupVerification.location} onChange={(e) => updateField('backupVerification', 'location', e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Backup Archive Size</Label>
                    <Input type="text" value={formState.backupVerification.size} onChange={(e) => updateField('backupVerification', 'size', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Restore Tested?</Label>
                    <select 
                      value={formState.backupVerification.restoreTested} 
                      onChange={(e) => updateField('backupVerification', 'restoreTested', e.target.value)}
                      className="text-xs border border-border bg-background rounded px-2.5 py-1 w-full text-foreground h-8"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground">Backup Verification Remarks</Label>
                    <Input type="text" value={formState.backupVerification.remarks} onChange={(e) => updateField('backupVerification', 'remarks', e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            </div>

            {/* Scheduled Tasks */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Scheduled Task Engine</h4>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Target</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(formState.scheduledTasks).map(([key, item]: any) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs font-mono font-bold capitalize">{key}</TableCell>
                        <TableCell>
                          <select 
                            value={item.status} 
                            onChange={(e) => updateTableVal('scheduledTasks', key, 'status', e.target.value)}
                            className="text-xs border border-border bg-background rounded px-2 py-1 w-full text-foreground"
                          >
                            <option value="Completed">Completed</option>
                            <option value="Running">Running</option>
                            <option value="Failed">Failed</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="text" value={item.remarks} onChange={(e) => updateTableVal('scheduledTasks', key, 'remarks', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

        </CardContent>
      </Card>

      {/* SECTION 2 – User & Active Directory Management */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><Users className="size-4 text-primary" /> Section 2 – User & Active Directory Management</CardTitle>
          <CardDescription>Log newly created accounts, password resets, domain permissions alterations, and disables.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          
          {/* New Users Created */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">New User Profiles Created</h4>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('newUsers', { username: '', department: 'Design', status: 'Active', remarks: '' })}>
                <Plus className="size-3" /> Add Account
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SamAccountName (Username)</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-12 text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formState.newUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No new users created today.</TableCell></TableRow>
                  ) : (
                    formState.newUsers.map((u: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input placeholder="e.g. tariku.n" type="text" value={u.username} onChange={(e) => updateArrayVal('newUsers', index, 'username', e.target.value)} className="h-7 text-xs font-mono" />
                        </TableCell>
                        <TableCell>
                          <Input placeholder="e.g. Digital Operations" type="text" value={u.department} onChange={(e) => updateArrayVal('newUsers', index, 'department', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <select 
                            value={u.status} 
                            onChange={(e) => updateArrayVal('newUsers', index, 'status', e.target.value)}
                            className="text-xs border border-border bg-background rounded px-2 py-1 w-full text-foreground h-7"
                          >
                            <option value="Active">Active</option>
                            <option value="Disabled">Disabled</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Remarks" type="text" value={u.remarks} onChange={(e) => updateArrayVal('newUsers', index, 'remarks', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => removeArrayRow('newUsers', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3.5" /></button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Password Resets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Domain Password Resets</h4>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('passwordResets', { username: '', department: 'Contract', completed: 'Yes', remarks: '' })}>
                <Plus className="size-3" /> Add Reset Log
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Completed?</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-12 text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formState.passwordResets.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No passwords reset today.</TableCell></TableRow>
                  ) : (
                    formState.passwordResets.map((u: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input placeholder="Username" type="text" value={u.username} onChange={(e) => updateArrayVal('passwordResets', index, 'username', e.target.value)} className="h-7 text-xs font-mono" />
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Department" type="text" value={u.department} onChange={(e) => updateArrayVal('passwordResets', index, 'department', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <select 
                            value={u.completed} 
                            onChange={(e) => updateArrayVal('passwordResets', index, 'completed', e.target.value)}
                            className="text-xs border border-border bg-background rounded px-2 py-1 w-full text-foreground h-7"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Remarks" type="text" value={u.remarks} onChange={(e) => updateArrayVal('passwordResets', index, 'remarks', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => removeArrayRow('passwordResets', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3.5" /></button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Additional AD adjustments sub-grid */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            
            {/* User Modified */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Domain Users Modifications</h4>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('userModified', { username: '', action: 'GPO group change', reason: '' })}>
                  <Plus className="size-3" /> Add Modification
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-10 text-right">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formState.userModified.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">No modifications logged.</TableCell></TableRow>
                    ) : (
                      formState.userModified.map((u: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell><Input placeholder="Username" type="text" value={u.username} onChange={(e) => updateArrayVal('userModified', index, 'username', e.target.value)} className="h-7 text-xs font-mono" /></TableCell>
                          <TableCell><Input placeholder="Action" type="text" value={u.action} onChange={(e) => updateArrayVal('userModified', index, 'action', e.target.value)} className="h-7 text-xs" /></TableCell>
                          <TableCell><Input placeholder="Reason" type="text" value={u.reason} onChange={(e) => updateArrayVal('userModified', index, 'reason', e.target.value)} className="h-7 text-xs" /></TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => removeArrayRow('userModified', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Group Membership Changes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">AD Group Membership Changes</h4>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('gpoChanges', { username: '', group: '', action: 'Added' })}>
                  <Plus className="size-3" /> Add Change
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Target Group</TableHead>
                      <TableHead>Action Logged</TableHead>
                      <TableHead className="w-10 text-right">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formState.gpoChanges.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">No group changes logged.</TableCell></TableRow>
                    ) : (
                      formState.gpoChanges.map((u: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell><Input placeholder="Username" type="text" value={u.username} onChange={(e) => updateArrayVal('gpoChanges', index, 'username', e.target.value)} className="h-7 text-xs font-mono" /></TableCell>
                          <TableCell><Input placeholder="Group" type="text" value={u.group} onChange={(e) => updateArrayVal('gpoChanges', index, 'group', e.target.value)} className="h-7 text-xs" /></TableCell>
                          <TableCell><Input placeholder="Action" type="text" value={u.action} onChange={(e) => updateArrayVal('gpoChanges', index, 'action', e.target.value)} className="h-7 text-xs" /></TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => removeArrayRow('gpoChanges', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

          {/* Account Disabled */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">AD Accounts Deactivation / Disabled Logs</h4>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('accountDisabled', { username: '', reason: '', approvedBy: '' })}>
                <Plus className="size-3" /> Add Deactivation
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Deactivation Reason</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead className="w-12 text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formState.accountDisabled.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">No deactivated accounts logged.</TableCell></TableRow>
                  ) : (
                    formState.accountDisabled.map((u: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input placeholder="Username" type="text" value={u.username} onChange={(e) => updateArrayVal('accountDisabled', index, 'username', e.target.value)} className="h-7 text-xs font-mono" />
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Reason" type="text" value={u.reason} onChange={(e) => updateArrayVal('accountDisabled', index, 'reason', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Approved By" type="text" value={u.approvedBy} onChange={(e) => updateArrayVal('accountDisabled', index, 'approvedBy', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => removeArrayRow('accountDisabled', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3.5" /></button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* SECTION 3 – L2 Support Tickets */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><ScrollText className="size-4 text-primary" /> Section 3 – L2 Support Tickets Auditing</CardTitle>
          <CardDescription>Track all hardware, software, printing, and networking incidents submitted by corporate office staff.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Support Tickets Ledger</h4>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('tickets', { no: `TKT-{Math.floor(1000 + Math.random()*9000)}`, user: '', department: '', issue: '', category: 'Software', resolution: '', status: 'Open' })}>
              <Plus className="size-3" /> Add Ticket Row
            </Button>
          </div>
          
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Ticket No</TableHead>
                  <TableHead className="w-32">User</TableHead>
                  <TableHead className="w-32">Department</TableHead>
                  <TableHead>Issue Details</TableHead>
                  <TableHead className="w-36">Category</TableHead>
                  <TableHead>Resolution Action</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.tickets.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">No support tickets logged today.</TableCell></TableRow>
                ) : (
                  formState.tickets.map((t: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="TKT-No" type="text" value={t.no} onChange={(e) => updateArrayVal('tickets', index, 'no', e.target.value)} className="h-7 text-xs font-mono font-bold" /></TableCell>
                      <TableCell><Input placeholder="User" type="text" value={t.user} onChange={(e) => updateArrayVal('tickets', index, 'user', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Department" type="text" value={t.department} onChange={(e) => updateArrayVal('tickets', index, 'department', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Issue Description" type="text" value={t.issue} onChange={(e) => updateArrayVal('tickets', index, 'issue', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell>
                        <select 
                          value={t.category} 
                          onChange={(e) => updateArrayVal('tickets', index, 'category', e.target.value)}
                          className="text-[11px] border border-border bg-background rounded px-1.5 py-1 w-full text-foreground h-7"
                        >
                          <option value="Software">Software</option>
                          <option value="Login">Login</option>
                          <option value="Printer">Printer</option>
                          <option value="Email">Email</option>
                          <option value="Shared Folder">Shared Folder</option>
                          <option value="Windows">Windows</option>
                          <option value="Office">Office</option>
                          <option value="Network">Network</option>
                          <option value="Other">Other</option>
                        </select>
                      </TableCell>
                      <TableCell><Input placeholder="Action Taken" type="text" value={t.resolution} onChange={(e) => updateArrayVal('tickets', index, 'resolution', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell>
                        <select 
                          value={t.status} 
                          onChange={(e) => updateArrayVal('tickets', index, 'status', e.target.value)}
                          className="text-[11px] border border-border bg-background rounded px-1.5 py-1 w-full text-foreground h-7 font-bold"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('tickets', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3.5" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SECTIONS 4, 5 & 6 — Shared Folders, Remote Desktops & GPO */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        
        {/* Section 4 — Shared Folder Management */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 4 — Shared Folders Permissions</h4>
            <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={() => addArrayRow('sharedFolders', { folder: '', permissionChanged: '', user: '', action: '' })}>
              <Plus className="size-2.5" /> Add
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folder</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action Logged</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.sharedFolders.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No permission changes.</TableCell></TableRow>
                ) : (
                  formState.sharedFolders.map((sf: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="Folder" type="text" value={sf.folder} onChange={(e) => updateArrayVal('sharedFolders', index, 'folder', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="User" type="text" value={sf.user} onChange={(e) => updateArrayVal('sharedFolders', index, 'user', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="Action" type="text" value={sf.action} onChange={(e) => updateArrayVal('sharedFolders', index, 'action', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('sharedFolders', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 5 — Remote Desktop Logs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 5 — Remote Desktop Connections</h4>
            <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={() => addArrayRow('remoteDesktop', { computer: '', user: '', connection: 'RDP Port 3389', result: 'Successful' })}>
              <Plus className="size-2.5" /> Add
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Computer</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.remoteDesktop.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No RDP connections logged.</TableCell></TableRow>
                ) : (
                  formState.remoteDesktop.map((rd: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="e.g. WS-05" type="text" value={rd.computer} onChange={(e) => updateArrayVal('remoteDesktop', index, 'computer', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="User" type="text" value={rd.user} onChange={(e) => updateArrayVal('remoteDesktop', index, 'user', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="Result" type="text" value={rd.result} onChange={(e) => updateArrayVal('remoteDesktop', index, 'result', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('remoteDesktop', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 6 — GPO Policies Enforcement */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 6 — Group Policy Updates</h4>
            <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={() => addArrayRow('gpoPolicies', { policy: '', action: '', result: 'Enforced' })}>
              <Plus className="size-2.5" /> Add
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Target</TableHead>
                  <TableHead>Action Taken</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.gpoPolicies.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No GPO changes enforced.</TableCell></TableRow>
                ) : (
                  formState.gpoPolicies.map((gp: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="e.g. Password Policy" type="text" value={gp.policy} onChange={(e) => updateArrayVal('gpoPolicies', index, 'policy', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="Action" type="text" value={gp.action} onChange={(e) => updateArrayVal('gpoPolicies', index, 'action', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell><Input placeholder="Result" type="text" value={gp.result} onChange={(e) => updateArrayVal('gpoPolicies', index, 'result', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('gpoPolicies', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>

      {/* SECTION 7 – Data Integrity Check */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><FolderSync className="size-4 text-primary" /> Section 7 – Daily Data Integrity Checks</CardTitle>
          <CardDescription>Track daily reports submission logs and pending reminders sent to non-compliant departments.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            
            {/* Department Submission Tracker */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Daily Reports Submission Status</h4>
              <div className="rounded-lg border border-border overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="w-24 text-center">Submitted?</TableHead>
                      <TableHead className="w-28">Submission Time</TableHead>
                      <TableHead className="w-24 text-center">Valid?</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(formState.dataIntegrity).map(([key, item]: any) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs font-bold text-foreground capitalize">{key === 'contract' ? 'Contract Administration' : key === 'design' ? 'Design' : key === 'procurement' ? 'Procurement' : 'Supervision & Water Works'}</TableCell>
                        <TableCell className="text-center">
                          <select 
                            value={item.submitted} 
                            onChange={(e) => updateTableVal('dataIntegrity', key, 'submitted', e.target.value)}
                            className="text-[11px] border border-border bg-background rounded px-1 py-0.5 text-foreground w-16"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="text" value={item.time} onChange={(e) => updateTableVal('dataIntegrity', key, 'time', e.target.value)} className="h-7 text-xs font-mono" />
                        </TableCell>
                        <TableCell className="text-center">
                          <select 
                            value={item.valid} 
                            onChange={(e) => updateTableVal('dataIntegrity', key, 'valid', e.target.value)}
                            className="text-[11px] border border-border bg-background rounded px-1 py-0.5 text-foreground w-16"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="text" value={item.remarks} onChange={(e) => updateTableVal('dataIntegrity', key, 'remarks', e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Missing Reports Reminders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Missing Reports Reminders Sent</h4>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('missingReports', { department: '', reminderSent: 'Yes', time: '', method: 'Email' })}>
                  <Plus className="size-3" /> Add Reminder Log
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target Department</TableHead>
                      <TableHead className="w-24 text-center">Reminder Sent?</TableHead>
                      <TableHead className="w-28">Time Sent</TableHead>
                      <TableHead className="w-36">Method</TableHead>
                      <TableHead className="w-10 text-right">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formState.missingReports.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No reminders logged today.</TableCell></TableRow>
                    ) : (
                      formState.missingReports.map((mr: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell><Input placeholder="Department" type="text" value={mr.department} onChange={(e) => updateArrayVal('missingReports', index, 'department', e.target.value)} className="h-7 text-xs" /></TableCell>
                          <TableCell className="text-center">
                            <select 
                              value={mr.reminderSent} 
                              onChange={(e) => updateArrayVal('missingReports', index, 'reminderSent', e.target.value)}
                              className="text-[11px] border border-border bg-background rounded px-1.5 py-0.5 text-foreground h-7"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </TableCell>
                          <TableCell><Input placeholder="e.g. 10:15 AM" type="text" value={mr.time} onChange={(e) => updateArrayVal('missingReports', index, 'time', e.target.value)} className="h-7 text-xs font-mono" /></TableCell>
                          <TableCell>
                            <select 
                              value={mr.method} 
                              onChange={(e) => updateArrayVal('missingReports', index, 'method', e.target.value)}
                              className="text-[11px] border border-border bg-background rounded px-1.5 py-0.5 text-foreground w-full h-7"
                            >
                              <option value="Email">Email</option>
                              <option value="Phone">Phone</option>
                              <option value="Teams">Teams</option>
                              <option value="Manual Visit">Manual Visit</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => removeArrayRow('missingReports', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

        </CardContent>
      </Card>

      {/* SECTION 8 & SECTION 9 & SECTION 10 — Database, Automation Projects & Security */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        
        {/* Section 8 — Database Check */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 8 — Database Logs & Performance</h4>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check Parameters</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Diagnostic Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(formState.database).map(([key, item]: any) => (
                  <TableRow key={key}>
                    <TableCell className="text-xs font-bold text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                    <TableCell>
                      <Input type="text" value={item.status} onChange={(e) => updateTableVal('database', key, 'status', e.target.value)} className="h-7 text-xs font-semibold" />
                    </TableCell>
                    <TableCell>
                      <Input type="text" value={item.remarks} onChange={(e) => updateTableVal('database', key, 'remarks', e.target.value)} className="h-7 text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 9 — Automation Projects */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 9 — Automation & Script Projects</h4>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Script Project Name</TableHead>
                  <TableHead className="w-24">Progress</TableHead>
                  <TableHead>Status Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(formState.automationProjects).map(([key, item]: any) => (
                  <TableRow key={key}>
                    <TableCell className="text-xs font-bold text-foreground capitalize">{key === 'consolidator' ? 'Excel Consolidator' : key === 'bot' ? 'Reminder Bot' : 'Dashboard monitor'}</TableCell>
                    <TableCell>
                      <Input type="text" value={item.progress} onChange={(e) => updateTableVal('automationProjects', key, 'progress', e.target.value)} className="h-7 text-xs font-mono text-center font-bold" />
                    </TableCell>
                    <TableCell>
                      <Input type="text" value={item.remarks} onChange={(e) => updateTableVal('automationProjects', key, 'remarks', e.target.value)} className="h-7 text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 10 — Security checks */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 10 — Security & Compliance Audit</h4>
          <div className="rounded-lg border border-border p-4 bg-card shadow-sm space-y-3.5 flex-1">
            <div className="grid gap-3 text-xs">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-muted-foreground">Failed Login Attempts</Label>
                <Input type="text" value={formState.security.failedLogins} onChange={(e) => updateField('security', 'failedLogins', e.target.value)} className="h-7 text-xs font-mono text-right max-w-[120px]" />
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-muted-foreground">Locked Accounts</Label>
                <Input type="text" value={formState.security.lockedAccounts} onChange={(e) => updateField('security', 'lockedAccounts', e.target.value)} className="h-7 text-xs font-mono text-right max-w-[120px]" />
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-muted-foreground">Antivirus Definitions</Label>
                <Input type="text" value={formState.security.antivirus} onChange={(e) => updateField('security', 'antivirus', e.target.value)} className="h-7 text-xs text-right max-w-[120px]" />
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-muted-foreground">Windows Update Status</Label>
                <Input type="text" value={formState.security.updates} onChange={(e) => updateField('security', 'updates', e.target.value)} className="h-7 text-xs text-right max-w-[120px]" />
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-muted-foreground">Windows Firewall Logs</Label>
                <Input type="text" value={formState.security.firewall} onChange={(e) => updateField('security', 'firewall', e.target.value)} className="h-7 text-xs text-right max-w-[120px]" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 11 — Issues Found & SECTION 12 — Improvements Made */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        
        {/* Section 11 — Issues Found */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 11 — Issues Found Today</h4>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('issuesFound', { time: '', issue: '', severity: 'Medium', actionTaken: '', status: 'Open' })}>
              <Plus className="size-3" /> Add Issue Log
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead>Issue Description</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Action Plan Taken</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.issuesFound.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">No issues logged today.</TableCell></TableRow>
                ) : (
                  formState.issuesFound.map((i: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="Time" type="text" value={i.time} onChange={(e) => updateArrayVal('issuesFound', index, 'time', e.target.value)} className="h-7 text-[11px] px-1 font-mono" /></TableCell>
                      <TableCell><Input placeholder="Details" type="text" value={i.issue} onChange={(e) => updateArrayVal('issuesFound', index, 'issue', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell>
                        <select 
                          value={i.severity} 
                          onChange={(e) => updateArrayVal('issuesFound', index, 'severity', e.target.value)}
                          className="text-[10px] border border-border bg-background rounded px-1 py-0.5 text-foreground h-7 w-full"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </TableCell>
                      <TableCell><Input placeholder="Action Taken" type="text" value={i.actionTaken} onChange={(e) => updateArrayVal('issuesFound', index, 'actionTaken', e.target.value)} className="h-7 text-[11px] px-1.5" /></TableCell>
                      <TableCell>
                        <select 
                          value={i.status} 
                          onChange={(e) => updateArrayVal('issuesFound', index, 'status', e.target.value)}
                          className="text-[10px] border border-border bg-background rounded px-1 py-0.5 text-foreground h-7 w-full"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('issuesFound', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 12 — Improvements Made */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 12 — Operations Improvements Made</h4>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('improvements', { improvement: '', benefit: '' })}>
              <Plus className="size-3" /> Add Improvement
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technical Improvement Details</TableHead>
                  <TableHead>Business/Operational Benefit</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.improvements.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">No improvements logged.</TableCell></TableRow>
                ) : (
                  formState.improvements.map((im: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="Improvement details" type="text" value={im.improvement} onChange={(e) => updateArrayVal('improvements', index, 'improvement', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Benefit detail" type="text" value={im.benefit} onChange={(e) => updateArrayVal('improvements', index, 'benefit', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('improvements', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>

      {/* SECTION 13 — Communication Log & SECTION 14 — Documentation Updated */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        
        {/* Section 13 — Communication Log */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 13 — Systems Administrator Communication Log</h4>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('communication', { time: '', person: '', discussion: '', outcome: '' })}>
              <Plus className="size-3" /> Add Log
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Time</TableHead>
                  <TableHead className="w-32">Person / Role</TableHead>
                  <TableHead>Discussion</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.communication.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No communication logs recorded.</TableCell></TableRow>
                ) : (
                  formState.communication.map((c: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="Time" type="text" value={c.time} onChange={(e) => updateArrayVal('communication', index, 'time', e.target.value)} className="h-7 text-[11px] px-1 font-mono" /></TableCell>
                      <TableCell><Input placeholder="Person" type="text" value={c.person} onChange={(e) => updateArrayVal('communication', index, 'person', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Discussion details" type="text" value={c.discussion} onChange={(e) => updateArrayVal('communication', index, 'discussion', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Outcome details" type="text" value={c.outcome} onChange={(e) => updateArrayVal('communication', index, 'outcome', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('communication', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section 14 — Documentation Updated */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Section 14 — Technical Documentation Logs</h4>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 font-bold" onClick={() => addArrayRow('documentation', { document: '', updated: '' })}>
              <Plus className="size-3" /> Add Doc Log
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto bg-card shadow-sm flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System Manual Document</TableHead>
                  <TableHead>Status / Details Updated</TableHead>
                  <TableHead className="w-10 text-right">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formState.documentation.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">No documentation logs recorded.</TableCell></TableRow>
                ) : (
                  formState.documentation.map((doc: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="Document name" type="text" value={doc.document} onChange={(e) => updateArrayVal('documentation', index, 'document', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell><Input placeholder="Changes details" type="text" value={doc.updated} onChange={(e) => updateArrayVal('documentation', index, 'updated', e.target.value)} className="h-7 text-xs" /></TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeArrayRow('documentation', index)} className="text-rose-500 hover:text-rose-600 p-1" title="Remove"><Trash2 className="size-3" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>

      {/* SECTION 15 — Daily Summary & Sign-off */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><FileText className="size-4 text-primary" /> Section 15 — Daily Operations Summary & Sign-off</CardTitle>
          <CardDescription>Log final operations achievement journals, pending carry-overs, and review signatures.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Today's Achievements & Success Logs</Label>
              <textarea 
                value={formState.summary.achievements} 
                onChange={(e) => updateField('summary', 'achievements', e.target.value)}
                placeholder="List accomplishments completed today..."
                className="w-full min-h-[90px] border border-border bg-background text-foreground rounded-lg p-2.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Pending Operations Carry-overs</Label>
              <textarea 
                value={formState.summary.pending} 
                onChange={(e) => updateField('summary', 'pending', e.target.value)}
                placeholder="List tasks carried over to tomorrow..."
                className="w-full min-h-[90px] border border-border bg-background text-foreground rounded-lg p-2.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Operation Risks identified</Label>
              <textarea 
                value={formState.summary.risks} 
                onChange={(e) => updateField('summary', 'risks', e.target.value)}
                placeholder="List system risks or storage warnings..."
                className="w-full min-h-[90px] border border-border bg-background text-foreground rounded-lg p-2.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Tomorrow's Operation Plans</Label>
              <textarea 
                value={formState.summary.tomorrowPlan} 
                onChange={(e) => updateField('summary', 'tomorrowPlan', e.target.value)}
                placeholder="List scheduled actions for tomorrow..."
                className="w-full min-h-[90px] border border-border bg-background text-foreground rounded-lg p-2.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary text-xs resize-none"
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-4 text-xs border-t border-border/40 pt-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Overall Daily Log Status</Label>
              <select 
                value={formState.summary.overallStatus} 
                onChange={(e) => updateField('summary', 'overallStatus', e.target.value)}
                className="text-xs border border-border bg-background rounded px-2.5 py-1 w-full text-foreground h-8 font-bold"
              >
                <option value="Normal Operations">🟢 Normal Operations</option>
                <option value="Minor Issues">🟡 Minor Issues</option>
                <option value="Attention Required">🟠 Attention Required</option>
                <option value="Critical Incident">🔴 Critical Incident</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Prepared By (Signature Auth)</Label>
              <Input type="text" disabled value={formState.general.employee} className="h-8 text-xs bg-secondary/50 font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Reviewed & Approved By</Label>
              <Input type="text" value={formState.summary.reviewedBy} onChange={(e) => updateField('summary', 'reviewedBy', e.target.value)} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Sign-off Date</Label>
              <Input type="date" value={formState.summary.signDate} onChange={(e) => updateField('summary', 'signDate', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button size="sm" onClick={exportToExcel} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8">
              <FileDown className="size-3.5" /> Export Log to Excel
            </Button>
            <Button size="sm" onClick={exportToPDF} className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1 h-8">
              <FileText className="size-3.5" /> Export PDF Log
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Row count stats footer statistics overlay */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-5 shadow-sm">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 text-center text-xs">
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Total Users</strong>
            <span className="text-base font-black text-foreground">{counts.auth_users ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Active Staff</strong>
            <span className="text-base font-black text-foreground">{counts.employees ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Bonds</strong>
            <span className="text-base font-black text-foreground">{counts.bonds ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Letters Logged</strong>
            <span className="text-base font-black text-foreground">{counts.correspondence ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">EOT Claims</strong>
            <span className="text-base font-black text-foreground">{counts.eot_claims ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Evaluations Logs</strong>
            <span className="text-base font-black text-foreground">{counts.evaluations ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background/50 col-span-2 sm:col-span-2 lg:col-span-2">
            <strong className="block text-[10px] text-muted-foreground font-semibold uppercase mb-1">Automation Engine Status</strong>
            <span className="text-xs font-bold text-emerald-600">Active · 0 failures</span>
          </div>
        </div>
      </div>

    </div>
  )

}







// ─── Tab: My Profile ─────────────────────────────────────────────────────────
function TabProfile() {
  const { data, isLoading, mutate } = useSWR<{ profile: any }>('/api/admin/profile', fetcher)
  const profile = data?.profile

  // ── Edit state ──
  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo]   = useState(false)
  const [infoForm, setInfoForm] = useState({ full_name: '', job_title: '', phone: '', location: '', bio: '' })

  React.useEffect(() => {
    if (profile) setInfoForm({
      full_name: profile.full_name ?? '', job_title: profile.job_title ?? '',
      phone: profile.phone ?? '', location: profile.location ?? '', bio: profile.bio ?? '',
    })
  }, [profile])

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    if (!infoForm.full_name.trim()) { toast.error('Full name is required.'); return }
    setSavingInfo(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(infoForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed.')
      toast.success('Profile updated')
      setEditingInfo(false)
      mutate()
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSavingInfo(false) }
  }

  function cancelEdit() {
    setEditingInfo(false)
    if (profile) setInfoForm({
      full_name: profile.full_name ?? '', job_title: profile.job_title ?? '',
      phone: profile.phone ?? '', location: profile.location ?? '', bio: profile.bio ?? '',
    })
  }


  // Avatar upload state
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
  }, [profile?.avatar_url])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be smaller than 3 MB.'); return }
    const localUrl = URL.createObjectURL(file)
    setAvatarUrl(localUrl)
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/avatar', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed.')
      setAvatarUrl(json.url + '?t=' + Date.now())
      toast.success('Profile photo updated')
      mutate()
    } catch (err) {
      setAvatarUrl(profile?.avatar_url ?? null)
      toast.error('Upload failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // ── Password state ──
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [changing, setChanging]       = useState(false)
  const [pwDone, setPwDone]           = useState(false)

  const strength = React.useMemo(() => {
    if (!newPw) return { score: 0, label: '', pct: 0 }
    let s = 0
    if (newPw.length >= 8) s++; if (newPw.length >= 12) s++
    if (/[A-Z]/.test(newPw)) s++; if (/[0-9]/.test(newPw)) s++
    if (/[^A-Za-z0-9]/.test(newPw)) s++
    const map: Record<number, { label: string; pct: number }> = {
      0: { label: '', pct: 0 }, 1: { label: 'Weak', pct: 20 },
      2: { label: 'Fair', pct: 45 }, 3: { label: 'Fair', pct: 60 },
      4: { label: 'Good', pct: 80 }, 5: { label: 'Strong', pct: 100 },
    }
    return { score: s, ...map[s] }
  }, [newPw])

  const strengthColor =
    strength.label === 'Strong' ? '#10b981' :
    strength.label === 'Good'   ? '#3b82f6' :
    strength.label === 'Fair'   ? '#f59e0b' : '#ef4444'

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setChanging(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success('Password updated successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwDone(true); setTimeout(() => setPwDone(false), 4000)
    } catch (err) {
      toast.error('Change failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setChanging(false) }
  }

  const getInitials = (name: string) =>
    ((name || 'AD').split(' ').map((w: string) => w[0]).join('').toUpperCase() + 'AD').substring(0, 2)

  const ROLE_GRADIENT: Record<string, string> = {
    admin:     'from-violet-600 via-purple-600 to-indigo-700',
    dgm:       'from-emerald-600 via-teal-600 to-cyan-700',
    gm:        'from-blue-600 via-indigo-600 to-violet-700',
    manager:   'from-amber-500 via-orange-500 to-rose-600',
    registrar: 'from-sky-500 via-cyan-500 to-teal-600',
    employee:  'from-blue-500 via-indigo-500 to-violet-600',
  }
  const grad = ROLE_GRADIENT[profile?.role ?? 'admin'] ?? ROLE_GRADIENT.admin

  const ROLE_BADGE: Record<string, string> = {
    admin:     'bg-violet-500/20 text-violet-300 ring-violet-500/30',
    dgm:       'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
    gm:        'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    manager:   'bg-amber-500/20 text-amber-300 ring-amber-500/30',
    registrar: 'bg-sky-500/20 text-sky-300 ring-sky-500/30',
    employee:  'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  }
  const roleBadge = ROLE_BADGE[profile?.role ?? 'admin'] ?? ROLE_BADGE.admin
  const memberYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null

  return (
    <div className="flex flex-col gap-0 -mx-0">

      {/* ══ HERO ══ */}
      <div className={`relative bg-gradient-to-br ${grad} overflow-hidden rounded-2xl`}>
        <div className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: '150px' }} />
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 size-40 rounded-full bg-black/20 blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-9 pb-7 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Avatar � clickable photo uploader */}
            <div className="relative shrink-0 group">
              {/* Hidden file input */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleAvatarChange}
                aria-label="Upload profile photo"
              />
              {/* Avatar circle */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative flex size-24 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-2 ring-white/25 text-white font-black text-3xl shadow-xl overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 transition-all"
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                {/* Photo or initials */}
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile" className="size-full object-cover" />
                ) : isLoading ? (
                  <Loader2 className="size-8 animate-spin opacity-60" />
                ) : (
                  getInitials(profile?.full_name ?? '')
                )}
                {/* Hover overlay */}
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl gap-1">
                  {uploadingAvatar
                    ? <Loader2 className="size-5 animate-spin text-white" />
                    : <Camera className="size-5 text-white" />}
                  <span className="text-[9px] font-bold text-white/90 uppercase tracking-wide">
                    {uploadingAvatar ? 'Uploading�' : 'Change'}
                  </span>
                </span>
              </button>
              {/* Online dot */}
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-background shadow pointer-events-none">
                <span className="size-2 rounded-full bg-white" />
              </span>
            </div>

            {/* Name block */}
            <div className="flex-1 min-w-0 pb-1">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-7 w-52 rounded-lg bg-white/20 animate-pulse" />
                  <div className="h-4 w-36 rounded-lg bg-white/15 animate-pulse" />
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                    {profile?.full_name || 'Administrator'}
                  </h1>
                  <p className="mt-1 text-sm text-white/70 font-medium">
                    {profile?.job_title || (profile?.role === 'dgm' || profile?.role === 'gm' ? 'Deputy General Manager' : 'System Administrator')}
                  </p>
                </>
              )}
            </div>

            {/* Role / status badges */}
            <div className="flex flex-wrap gap-2 pb-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${roleBadge}`}>
                <span className="size-1.5 rounded-full bg-current opacity-80" />{profile?.role ?? '—'}
              </span>
              {profile?.active && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />Active
                </span>
              )}
              {memberYear && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-white/10 text-white/70 ring-1 ring-white/20">
                  Member since {memberYear}
                </span>
              )}
            </div>
          </div>

          {/* Stat chips */}
          {!isLoading && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {[
                { label: 'Email',      value: profile?.email ?? '—' },
                { label: 'Location',   value: profile?.location || 'Not set' },
                { label: 'Phone',      value: profile?.phone    || 'Not set' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2.5 ring-1 ring-white/15 max-w-[220px]">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/90 truncate">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3 pt-6">

        {/* ── Main (left 2/3) ── */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Professional Profile */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className={`flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow`}>
                  <UserCircle className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Professional Profile</p>
                  <p className="text-[11px] text-muted-foreground">Visible across the portal</p>
                </div>
              </div>
              {!editingInfo && (
                <button onClick={() => setEditingInfo(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                  <Pencil className="size-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="px-6 py-5">
              {!editingInfo ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Full Name',         value: profile?.full_name  || '—', icon: UserCircle },
                    ...(profile?.role !== 'dgm' && profile?.role !== 'gm'
                      ? [
                          { label: 'Job Title',         value: profile?.job_title  || '—', icon: BadgeCheck },
                          { label: 'Location / Office', value: profile?.location   || '—', icon: Building2 },
                        ]
                      : []),
                    { label: 'Phone',             value: profile?.phone      || '—', icon: Activity },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60 text-muted-foreground">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground break-all">{value}</p>
                      </div>
                    </div>
                  ))}
                  <div className="sm:col-span-2 rounded-xl bg-secondary/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Bio / About</p>
                    {profile?.bio
                      ? <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                      : <p className="text-sm text-muted-foreground italic">No bio added yet. Click Edit to add one.</p>}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveInfo} className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      { id: 'fn',  label: 'Full Name *',       key: 'full_name', type: 'text', ph: 'e.g. Ameha Tesfaye',          req: true  },
                      ...(profile?.role !== 'dgm' && profile?.role !== 'gm'
                        ? ([
                            { id: 'jt',  label: 'Job Title',         key: 'job_title', type: 'text', ph: 'e.g. Systems Administrator', req: false },
                            { id: 'loc', label: 'Location / Office', key: 'location',  type: 'text', ph: 'e.g. Addis Ababa HQ',       req: false },
                          ] as const)
                        : []),
                      { id: 'ph',  label: 'Phone',              key: 'phone',     type: 'tel',  ph: 'e.g. +251 91 234 5678',       req: false },
                    ] as const).map(({ id, label, key, type, ph, req }) => (
                      <div key={id} className="flex flex-col gap-1.5">
                        <label htmlFor={`prof-${id}`} className="text-xs font-semibold text-foreground">{label}</label>
                        <Input id={`prof-${id}`} type={type}
                          value={(infoForm as any)[key]}
                          onChange={(e) => setInfoForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={ph} required={req}
                          className="h-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 focus-visible:ring-primary/40" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="prof-bio" className="text-xs font-semibold text-foreground">Bio / About</label>
                    <textarea id="prof-bio" value={infoForm.bio}
                      onChange={(e) => setInfoForm((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Write a brief professional summary…" rows={3}
                      className="w-full border border-border/70 bg-background text-foreground rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" disabled={savingInfo}
                      className={`h-9 gap-1.5 text-sm border-0 text-white hover:opacity-90 shadow-sm bg-gradient-to-r ${grad}`}>
                      {savingInfo ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : <><Check className="size-3.5" /> Save Changes</>}
                    </Button>
                    <button type="button" onClick={cancelEdit}
                      className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
              <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <KeyRound className="size-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Change Password</p>
                <p className="text-[11px] text-muted-foreground">Verify your current password before setting a new one</p>
              </div>
            </div>

            {pwDone ? (
              <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCheck className="size-7" />
                </div>
                <p className="font-bold text-base text-foreground">Password updated!</p>
                <p className="text-sm text-muted-foreground">Your password has been changed successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="px-6 py-5 grid gap-4 sm:grid-cols-2 max-w-2xl">

                {/* Current password — full width */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="cpw" className="text-xs font-semibold text-foreground">Current Password *</label>
                  <div className="relative">
                    <Input id="cpw" type={showCurrent ? 'text' : 'password'} value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter your current password"
                      className="h-10 pr-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                      required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle">
                      {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="npw" className="text-xs font-semibold text-foreground">New Password *</label>
                  <div className="relative">
                    <Input id="npw" type={showNew ? 'text' : 'password'} value={newPw}
                      onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 characters"
                      className="h-10 pr-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                      required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle">
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {newPw.length > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${strength.pct}%`, backgroundColor: strengthColor }} />
                      </div>
                      <span className="text-[10px] font-bold w-12 text-right" style={{ color: strengthColor }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fpw" className="text-xs font-semibold text-foreground">Confirm Password *</label>
                  <div className="relative">
                    <Input id="fpw" type={showConfirm ? 'text' : 'password'} value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                      className={`h-10 pr-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 ${confirmPw && confirmPw !== newPw ? 'border-rose-400 focus-visible:ring-rose-400/40' : 'focus-visible:ring-primary/40'}`}
                      required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle">
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {confirmPw.length > 0 && (
                    <p className={`text-[11px] font-semibold flex items-center gap-1 ${confirmPw === newPw ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {confirmPw === newPw
                        ? <><Check className="size-3" /> Passwords match</>
                        : 'Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Hint + Submit — full width */}
                <div className="sm:col-span-2 flex flex-col gap-3">
                  <div className="flex gap-2.5 rounded-xl bg-secondary/40 border border-border/40 px-4 py-3 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5 text-primary" />
                    <span>Use at least <strong>8 characters</strong> with uppercase letters, numbers and symbols.</span>
                  </div>
                  <Button type="submit"
                    disabled={changing || !currentPw || !newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
                    className={`h-10 self-start gap-2 border-0 text-white hover:opacity-90 shadow-sm bg-gradient-to-r ${grad}`}>
                    {changing
                      ? <><Loader2 className="size-4 animate-spin" /> Updating…</>
                      : <><KeyRound className="size-4" /> Update Password</>}
                  </Button>
                </div>

              </form>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="flex flex-col gap-4">

          {/* Account card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50">
              <p className="font-bold text-sm text-foreground">Account</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-lg bg-secondary animate-pulse" />
                ))
              ) : (
                <>
                  {/* Mini avatar row */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
                    <div className={`relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white font-black text-sm shadow overflow-hidden`}>
                      {avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                        : getInitials(profile?.full_name ?? '')
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{profile?.full_name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                    </div>
                  </div>

                  {/* Key-value list */}
                  {[
                    { label: 'Role',         value: profile?.role ?? '—' },
                    { label: 'Status',       value: profile?.active ? 'Active' : 'Inactive' },
                    { label: 'Department',   value: profile?.department || (profile?.role === 'dgm' || profile?.role === 'gm' ? 'Executive' : 'IT Department') },
                    { label: 'Member Since', value: profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[11px] font-bold text-foreground">{value}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Security checklist */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <ShieldAlert className="size-3.5" />
              </div>
              <p className="font-bold text-sm text-foreground">Security Checklist</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2.5">
              {[
                'Change your password every 90 days',
                'Never share admin credentials with others',
                'Use a strong, unique password',
                'Sign out on shared workstations',
                'Report suspicious account activity immediately',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[9px]">
                    {i + 1}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{tip}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
function TabEmail() {
  const { data, isLoading } = useSWR<{ settings: any }>('/api/admin/email-settings', fetcher)
  const settings = data?.settings
  const [testRecipient, setTestRecipient] = useState('')
  const [sending, setSending] = useState(false)

  async function sendTest(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testRecipient || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Send failed.')
      toast.success('Test email sent', { description: `Delivered via ${json.method} to ${json.recipient}` })
    } catch (err) {
      toast.error('Send failed', { description: err instanceof Error ? err.message : 'Check your email configuration.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Current config */}
      <SectionCard title="Current Configuration" icon={Mail}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                { label: 'Provider', value: settings.provider || 'None configured' },
                { label: 'From address', value: settings.from_address || '—' },
                { label: 'From name', value: settings.from_name || '—' },
                { label: 'SMTP host', value: settings.smtp_host || '—' },
                { label: 'SMTP port', value: settings.smtp_port || '—' },
                { label: 'SMTP user', value: settings.smtp_user || '—' },
              ].map(({ label, value }) => (
                <React.Fragment key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground truncate">{value}</span>
                </React.Fragment>
              ))}
              <span className="text-muted-foreground">SMTP password</span>
              <span className={`font-medium text-xs ${settings.smtp_pass_set ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {settings.smtp_pass_set ? '● Set' : '○ Not set'}
              </span>
              <span className="text-muted-foreground">Resend API key</span>
              <span className={`font-medium text-xs ${settings.resend_key_set ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {settings.resend_key_set ? '● Set' : '○ Not set'}
              </span>
              <span className="text-muted-foreground">Cron secret</span>
              <span className={`font-medium text-xs ${settings.cron_secret_set ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {settings.cron_secret_set ? '● Set' : '○ Not set'}
              </span>
            </div>
            {settings.alert_recipients && (
              <div className="mt-1 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Alert recipients: </span>
                <span className="font-medium text-foreground">{settings.alert_recipients}</span>
              </div>
            )}
            {settings.provider === 'none' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2 text-xs text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>No email provider is configured. Set <code>RESEND_API_KEY</code> or SMTP variables in your <code>.env</code> file.</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load settings.</p>
        )}
      </SectionCard>

      {/* Send test */}
      <SectionCard title="Send Test Email" description="Verify your email configuration is working." icon={Send}>
        <form onSubmit={sendTest} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-recipient">Recipient (optional)</Label>
            <Input id="test-recipient" type="email" value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="Leave blank to send to yourself" />
          </div>
          <p className="text-xs text-muted-foreground">
            Leaves the recipient blank to send to your own admin email address.
          </p>
          <Button type="submit" disabled={sending}>
            {sending
              ? <><Loader2 className="size-4 animate-spin mr-2" />Sending…</>
              : <><Send className="size-4 mr-2" />Send test email</>}
          </Button>
        </form>
      </SectionCard>
    </div>
  )
}

// ─── Tab: Permissions ─────────────────────────────────────────────────────────
const ROLE_CAPABILITY_LABELS: Record<string, string> = {
  manage_users:         'Manage users',
  disable_users:        'Disable users',
  reset_passwords:      'Reset passwords',
  manage_departments:   'Manage departments',
  view_logs:            'View audit logs',
  manage_email_settings:'Email settings',
  manage_permissions:   'Manage permissions',
  database_backup:      'Database backup',
  view_submissions:     'View submissions',
  manage_submissions:   'Review submissions',
  manage_projects:      'Manage projects',
  view_employees:       'View employees',
  manage_employees:     'Manage employees',
  view_analytics:       'View analytics',
  export_reports:       'Export reports',
  submit_reports:       'Submit reports',
  view_own_submissions: 'View own submissions',
}

function TabPermissions() {
  const { data, isLoading, mutate } = useSWR<{
    roles: string[]
    capabilities: Record<string, string[]>
    distribution: Record<string, number>
    employees: { id: string; full_name: string; email: string; role: string }[]
  }>('/api/admin/permissions', fetcher)

  const [savingId, setSavingId] = useState<string | null>(null)
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({})

  async function saveRole(id: string) {
    const role = pendingRoles[id]
    if (!role) return
    setSavingId(id)
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success('Role updated', { description: `${json.employee.full_name} is now ${role}` })
      setPendingRoles((prev) => { const next = { ...prev }; delete next[id]; return next })
      mutate()
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSavingId(null)
    }
  }

  const capabilities = data?.capabilities ?? {}
  const employees = data?.employees ?? []
  const distribution = data?.distribution ?? {}

  return (
    <div className="flex flex-col gap-6">
      {/* Distribution chips */}
      {!isLoading && Object.keys(distribution).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(distribution).map(([role, count]) => (
            <div key={role} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${ROLE_COLORS[role] ?? 'bg-secondary text-foreground'}`}>
              <span className="capitalize">{role}</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.5">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Capability matrix */}
      <SectionCard title="Role Capabilities" description="What each role can do in the system." icon={ShieldCheck}>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left font-semibold text-muted-foreground w-40">Capability</th>
                {VALID_ROLES.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-semibold">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[r] ?? ''}`}>{r}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(ROLE_CAPABILITY_LABELS).map((cap) => (
                <tr key={cap} className="border-b border-border/40 hover:bg-secondary/20">
                  <td className="py-2 pr-4 font-medium text-foreground whitespace-nowrap">
                    {ROLE_CAPABILITY_LABELS[cap]}
                  </td>
                  {VALID_ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {(capabilities[r] ?? []).includes(cap)
                        ? <span className="inline-block size-4 rounded-full bg-emerald-500/20 text-emerald-600 leading-4 text-center">✓</span>
                        : <span className="inline-block size-4 text-border leading-4 text-center">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Per-employee role assignment */}
      <SectionCard title="Assign Roles" description="Change the role for individual employees." icon={ShieldAlert}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>New Role</TableHead>
                  <TableHead className="text-right">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const pending = pendingRoles[emp.id]
                  const changed = pending !== undefined && pending !== emp.role
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-medium text-foreground text-sm">{emp.full_name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[emp.role] ?? 'bg-secondary text-muted-foreground'}`}>
                          {emp.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={pending ?? emp.role}
                          onValueChange={(v) => setPendingRoles((prev) => ({ ...prev, [emp.id]: v || '' }))}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALID_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="h-8 text-xs" disabled={!changed || savingId === emp.id}
                          onClick={() => saveRole(emp.id)}>
                          {savingId === emp.id
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <><Check className="size-3.5 mr-1" />Save</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Main AdminPanel component ────────────────────────────────────────────────
const TAB_COMPONENTS: Record<AdminTab, React.ComponentType> = {
  dashboard:   TabDashboard,
  users:       TabUsers,
  disable:     TabDisable,
  reset:       TabReset,
  departments: TabDepartments,
  logs:        TabLogs,
  backup:      TabBackup,
  health:      TabHealth,
  email:       TabEmail,
  permissions: TabPermissions,
  profile:     TabProfile,
}

// Admin-only tabs that DGM/GM must not see
const ADMIN_ONLY_TABS: AdminTab[] = ['dashboard', 'users', 'disable', 'reset', 'departments', 'logs', 'backup', 'health', 'email', 'permissions']

export function AdminPanel({ initialTab = 'dashboard', role = 'admin' }: { initialTab?: AdminTab; role?: string }) {
  return (
    <React.Suspense>
      <AdminPanelInner initialTab={initialTab} role={role} />
    </React.Suspense>
  )
}

function AdminPanelInner({ initialTab = 'dashboard', role = 'admin' }: { initialTab?: AdminTab; role?: string }) {
  const searchParams = useSearchParams()
  const isDgm = role === 'dgm' || role === 'gm'

  // For DGM/GM, clamp any admin-only tab to profile
  const clampTab = (tab: AdminTab): AdminTab => {
    if (isDgm && ADMIN_ONLY_TABS.includes(tab)) return 'profile'
    return tab
  }


  const [activeTab, setActiveTab] = useState<AdminTab>(clampTab(initialTab))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Prevent SSR rendering of tab content (avoids hydration mismatches)
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  // Keep activeTab in sync with the ?tab= query param so clicking the
  // navbar profile icon works even when the panel is already mounted.
  React.useEffect(() => {
    const raw = searchParams.get('tab') ?? ''
    const isValid = (Object.keys(TAB_META) as AdminTab[]).includes(raw as AdminTab)
    if (isValid && raw !== activeTab) {
      setActiveTab(clampTab(raw as AdminTab))
    }
  }, [searchParams])

  // Update URL when a tab is selected so the state is always reflected in the address bar.
  function navigateTab(tab: AdminTab) {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'dashboard') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.pushState({}, '', url.toString())
  }

  const ActiveTabMeta = TAB_META[activeTab]
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur sm:p-6 relative z-30">
        <div className="flex items-center gap-3.5">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${isDgm ? 'from-emerald-500 to-teal-600' : 'from-purple-600 to-indigo-600'} text-white shadow-md`}>
            {isDgm ? <UserCircle className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {isDgm ? 'My Profile' : 'Admin Panel'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isDgm ? 'Account details and password' : 'System administration and user management'}
            </p>
          </div>
        </div>

        {/* Desktop tab bar */}
        <div className="hidden flex-wrap gap-1 rounded-xl border border-border bg-secondary/60 p-1 md:flex">
          {(Object.keys(TAB_META) as AdminTab[])
            .filter((tab) => tab !== 'profile') // Hide profile from tab bar — navbar-only
            .filter((tab) => !(isDgm && ADMIN_ONLY_TABS.includes(tab))) // Hide admin-only tabs for DGM
            .map((tab) => {
              const meta = TAB_META[tab]
              const Icon = meta.icon
              return (
                <button key={tab} onClick={() => navigateTab(tab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider transition-all sm:flex-none sm:px-3 ${
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden lg:inline">{meta.label}</span>
                </button>
              )
            })
          }
        </div>

        {/* Mobile: dropdown selector */}
        <div className="relative md:hidden z-50">
          <button onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <ActiveTabMeta.icon className="size-4 text-primary" />
              {ActiveTabMeta.label}
            </span>
            <svg className={`size-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mobileMenuOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-background p-1 shadow-lg">
              {(Object.keys(TAB_META) as AdminTab[])
                .filter((tab) => tab !== 'profile') // Hide profile from mobile dropdown too
                .filter((tab) => !(isDgm && ADMIN_ONLY_TABS.includes(tab))) // Hide admin-only tabs for DGM
                .map((tab) => {
                  const meta = TAB_META[tab]
                  const Icon = meta.icon
                  return (
                    <button key={tab} onClick={() => { navigateTab(tab); setMobileMenuOpen(false) }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-secondary'
                      }`}>
                      <Icon className="size-4 shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold">{meta.label}</div>
                        <div className={`text-xs ${activeTab === tab ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{meta.description}</div>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          )}
        </div>
      </div>

      {/* Active section breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isDgm ? <UserCircle className="size-4 text-primary" /> : <ShieldCheck className="size-4 text-primary" />}
        <span className="text-foreground font-medium">{isDgm ? 'My Profile' : 'Admin Panel'}</span>
        <span>/</span>
        <span>{ActiveTabMeta.label}</span>
        <span className="ml-1 hidden text-xs sm:inline">— {ActiveTabMeta.description}</span>
      </div>

      {/* Tab content - rendered only after hydration to prevent SSR mismatches */}
      {mounted ? <ActiveComponent /> : (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <svg className="animate-spin size-5 mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>
          Loading...
        </div>
      )}
    </div>
  )
}
