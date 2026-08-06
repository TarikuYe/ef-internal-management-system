'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  Copy,
  CheckCheck,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  AlertTriangle,
  Eye,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Mail,
  Building2,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Employee {
  id: string
  full_name: string
  email: string
  department: string | null
  department_id: string | null
  role: string
  active?: boolean   // optional – column may not exist in older DB schemas
  created_at: string
  job_title?: string | null
  phone?: string | null
  location?: string | null
  bio?: string | null
  avatar_url?: string | null
}

const DEPARTMENTS: { id: string; name: string }[] = [
  { id: 'contract',    name: 'Contract Administration' },
  { id: 'design',      name: 'Design Department' },
  { id: 'office-eng',  name: 'Office Engineering' },
  { id: 'procurement', name: 'Procurement' },
  { id: 'supervision', name: 'Supervision & Water Works' },
]

const ROLES: { value: string; label: string }[] = [
  { value: 'employee',   label: 'Employee' },
  { value: 'manager',    label: 'Manager' },
  { value: 'registrar',  label: 'Registrar' },
  { value: 'dgm',        label: 'DGM' },
  { value: 'gm',         label: 'GM' },
  { value: 'admin',      label: 'Admin' },
]

const ROLE_BADGES: Record<string, string> = {
  admin:     'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  dgm:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  gm:        'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  registrar: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  manager:   'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  employee:  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
}

// Maps legacy ef_department enum values to new department IDs
const OLD_DEPT_TO_ID: Record<string, string> = {
  management:         'contract',
  contract_admin:     'contract',
  office_engineering: 'office-eng',
  design:             'design',
  procurement:        'procurement',
  supervision:        'supervision',
}

// Returns a human-readable department name regardless of which column is populated
function getDeptDisplay(emp: { department_id?: string | null; department?: string | null }): string {
  if (emp.department_id) {
    return DEPARTMENTS.find(d => d.id === emp.department_id)?.name ?? emp.department_id
  }
  if (emp.department) {
    // Check if it matches a new department ID first
    const byId = DEPARTMENTS.find(d => d.id === emp.department)
    if (byId) return byId.name
    // Format old enum value: contract_admin → Contract Admin
    return emp.department.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  return '—'
}

// Returns the best department_id to pre-fill the edit dropdown
function getEditDeptId(emp: { department_id?: string | null; department?: string | null }): string {
  if (emp.department_id && DEPARTMENTS.some(d => d.id === emp.department_id)) {
    return emp.department_id
  }
  if (emp.department) {
    return OLD_DEPT_TO_ID[emp.department] ?? 'contract'
  }
  return 'contract'
}

export function EmployeeManager() {
  const { data: empData, isLoading, mutate } = useSWR<{ employees: Employee[] }>(
    '/api/employees',
    fetcher,
  )

  const employees = empData?.employees ?? []

  // ── Employee details view modal ──
  const [viewDetailsEmp, setViewDetailsEmp] = useState<Employee | null>(null)

  // ── Add form ──
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newRole, setNewRole] = useState('')
  const [adding, setAdding] = useState(false)

  // ── One-time password modal ──
  const [tempPassword, setTempPassword] = useState<{
    name: string; email: string; password: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Busy (activate/deactivate) per row ──
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)

    // Map department_id slug → ef_department enum value for the DB column
    const DEPT_ENUM_MAP: Record<string, string> = {
      'contract':    'contract_admin',
      'design':      'design',
      'office-eng':  'office_engineering',
      'procurement': 'procurement',
      'supervision': 'supervision',
    }
    const isExec = ['dgm', 'gm'].includes(newRole)
    const deptId = isExec ? null : (newDept || 'contract')
    const deptEnum = isExec ? null : (DEPT_ENUM_MAP[deptId ?? ''] ?? deptId)

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newName,
          email: newEmail,
          department_id: deptId,
          department: deptEnum,
          role: newRole || 'employee',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create employee.')
      setTempPassword({ name: json.employee.full_name, email: json.employee.email, password: json.temp_password })
      setNewName('')
      setNewEmail('')
      setNewDept('')
      setNewRole('')
      setShowAdd(false)
      mutate()
    } catch (err) {
      toast.error('Failed to create employee', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)

    const DEPT_ENUM_MAP: Record<string, string> = {
      'contract':    'contract_admin',
      'design':      'design',
      'office-eng':  'office_engineering',
      'procurement': 'procurement',
      'supervision': 'supervision',
    }
    const isExec = ['dgm', 'gm'].includes(editRole)
    const deptEnum = isExec ? null : (DEPT_ENUM_MAP[editDept] ?? editDept ?? null)

    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          full_name: editName,
          department_id: isExec ? null : editDept,
          department: deptEnum,
          role: editRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed.')
      toast.success('Employee updated')
      setEditingId(null)
      mutate()
    } catch (err) {
      toast.error('Update failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(emp: Employee) {
    setBusyId(emp.id)
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, active: !emp.active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success(emp.active ? 'Employee deactivated' : 'Employee reactivated', {
        description: emp.email,
      })
      mutate()
    } catch (err) {
      toast.error('Failed to update employee', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete employee.')
      toast.success('Employee permanently deleted', { description: deleteTarget.email })
      setDeleteTarget(null)
      mutate()
    } catch (err) {
      toast.error('Delete failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Delete confirmation dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Delete employee?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You are about to permanently delete the account for{' '}
              <strong className="text-foreground">{deleteTarget.full_name}</strong>.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
              <div className="font-medium text-foreground">{deleteTarget.full_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{deleteTarget.email}</div>
              {deleteTarget.department && (
                <div className="mt-0.5 text-xs text-muted-foreground">{deleteTarget.department}</div>
              )}
            </div>
            <div className="mt-3 rounded-lg bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
              <strong>This action cannot be undone.</strong> Their account and login access will be permanently removed.
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="sm:w-auto"
              >
                Cancel, keep employee
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="sm:w-auto"
              >
                {deleting ? (
                  <><Loader2 className="size-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="size-4" /> Yes, delete permanently</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Details Modal ── */}
      {viewDetailsEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header banner */}
            <div className="relative bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 p-6 border-b border-border/60">
              <button
                onClick={() => setViewDetailsEmp(null)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label="Close details"
              >
                <X className="size-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display text-2xl font-bold shadow-md">
                  {viewDetailsEmp.avatar_url ? (
                    <img src={viewDetailsEmp.avatar_url} alt={viewDetailsEmp.full_name} className="size-full rounded-2xl object-cover" />
                  ) : (
                    viewDetailsEmp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold text-foreground truncate">{viewDetailsEmp.full_name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      viewDetailsEmp.active !== false ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {viewDetailsEmp.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{viewDetailsEmp.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      ROLE_BADGES[viewDetailsEmp.role] || 'bg-blue-100 text-blue-800'
                    }`}>
                      {viewDetailsEmp.role}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="size-3.5" />
                      {getDeptDisplay(viewDetailsEmp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="p-6 flex flex-col gap-4 text-sm max-h-[60vh] overflow-y-auto">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Employee Profile Details</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <Briefcase className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Job Title</div>
                    <div className="font-semibold text-foreground mt-0.5">{viewDetailsEmp.job_title || 'Not set'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <Building2 className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Department</div>
                    <div className="font-semibold text-foreground mt-0.5">{getDeptDisplay(viewDetailsEmp)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <Mail className="size-4 shrink-0 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground font-medium">Work Email</div>
                    <div className="font-semibold text-foreground mt-0.5 truncate">{viewDetailsEmp.email}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(viewDetailsEmp.email)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title="Copy Email"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <Phone className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Phone Number</div>
                    <div className="font-semibold text-foreground mt-0.5">{viewDetailsEmp.phone || 'Not provided'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Location / Office</div>
                    <div className="font-semibold text-foreground mt-0.5">{viewDetailsEmp.location || 'Not provided'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <Calendar className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Account Created</div>
                    <div className="font-semibold text-foreground mt-0.5">
                      {viewDetailsEmp.created_at ? new Date(viewDetailsEmp.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {viewDetailsEmp.bio && (
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Bio / Notes</div>
                  <p className="text-foreground text-xs leading-relaxed">{viewDetailsEmp.bio}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border bg-secondary/20 px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const emp = viewDetailsEmp
                  setViewDetailsEmp(null)
                  setEditingId(emp.id)
                  setEditName(emp.full_name)
                  setEditDept(getEditDeptId(emp))
                  setEditRole(emp.role ?? 'employee')
                }}
              >
                <Pencil className="size-3.5 mr-1.5" /> Edit Account
              </Button>

              <Button size="sm" onClick={() => setViewDetailsEmp(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── One-time password modal ── */}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-chart-4/15 text-chart-4">
              <KeyRound className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Account created!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Share this one-time password with{' '}
              <strong className="text-foreground">{tempPassword.name}</strong> ({tempPassword.email}).
              It won&apos;t be shown again.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-3">
              <code className="flex-1 select-all font-mono text-base font-semibold tracking-wider text-foreground">
                {tempPassword.password}
              </code>
              <button
                onClick={() => handleCopy(tempPassword.password)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Copy password"
              >
                {copied ? <CheckCheck className="size-4 text-chart-4" /> : <Copy className="size-4" />}
              </button>
            </div>

            <div className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
              The employee should change this password after their first login.
            </div>

            <Button
              className="mt-5 w-full"
              onClick={() => { setTempPassword(null); setCopied(false) }}
            >
              Done — I&apos;ve saved the password
            </Button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Create employee accounts, view profile details, and manage access for all team members.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant={showAdd ? 'outline' : 'default'}
          className="shrink-0 self-start sm:self-auto"
        >
          {showAdd ? (
            <><X className="size-4" /> Cancel</>
          ) : (
            <><Plus className="size-4" /> Add employee</>
          )}
        </Button>
      </div>

      {/* ── Add employee form ── */}
      {showAdd && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-5">
            <form
              onSubmit={handleAdd}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Full name *</label>
                  <Input
                    id="new-emp-name"
                    placeholder="Jane Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Work email *</label>
                  <Input
                    id="new-emp-email"
                    type="email"
                    placeholder="jane@efae.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                {/* Department — hidden for DGM / GM roles */}
                {!['dgm', 'gm'].includes(newRole) && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                    <select
                      id="new-emp-dept"
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="contract">Contract Administration</option>
                      <option value="design">Design Department</option>
                      <option value="office-eng">Office Engineering</option>
                      <option value="procurement">Procurement</option>
                      <option value="supervision">Supervision &amp; Water Works</option>
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    id="new-emp-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {/* Info note for executive roles */}
                {['dgm', 'gm'].includes(newRole) && (
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-700">
                    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" /></svg>
                    <span><strong className="font-semibold capitalize">{newRole.toUpperCase()}</strong> is an executive role — no department assignment required.</span>
                  </div>
                )}
              </div>
              <Button type="submit" disabled={adding} className="sm:self-start">
                {adding ? (
                  <><Loader2 className="size-4 animate-spin" /> Creating…</>
                ) : (
                  <><Check className="size-4" /> Create account</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Employees table ── */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display">
            <span className="flex items-center gap-2">
              <Users className="size-5 text-accent" />
              All employees
            </span>
          </CardTitle>
          <CardDescription>
            {employees.length} employee{employees.length !== 1 ? 's' : ''} ·{' '}
            {employees.filter((e) => e.active).length} active
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading employees…</div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No employees yet. Click &quot;Add employee&quot; to create the first account.
            </div>
          ) : (
            <>
              {/* ── Mobile card list (hidden md+) ── */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {employees.map((emp) => {
                  const roleBadgeClass =
                    emp.role === 'dgm'  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : emp.role === 'gm'    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    : emp.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  return (
                    <div key={emp.id} className={`p-4 ${!emp.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {editingId === emp.id ? (
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm mb-1" autoFocus />
                          ) : (
                            <div className="font-medium text-foreground truncate">{emp.full_name}</div>
                          )}
                          <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}>{emp.role}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.active ? 'bg-chart-4/15 text-chart-4' : 'bg-secondary text-muted-foreground'}`}>{emp.active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {editingId === emp.id ? (
                            <>
                              <button onClick={() => handleSaveEdit(emp.id)} disabled={saving} className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50" aria-label="Save">
                                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                              </button>
                              <button onClick={() => setEditingId(null)} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Cancel"><X className="size-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setViewDetailsEmp(emp)} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={`View details for ${emp.full_name}`} title="View profile details"><Eye className="size-3.5" /></button>
                              <button onClick={() => { setEditingId(emp.id); setEditName(emp.full_name); setEditDept(getEditDeptId(emp)); setEditRole(emp.role ?? 'employee') }} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={`Edit ${emp.full_name}`} title="Edit employee"><Pencil className="size-3.5" /></button>
                              <button onClick={() => handleToggleActive(emp)} disabled={busyId === emp.id} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50" aria-label={emp.active ? 'Deactivate' : 'Reactivate'}>
                                {busyId === emp.id ? <Loader2 className="size-3.5 animate-spin" /> : emp.active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                              </button>
                              <button onClick={() => setDeleteTarget(emp)} className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/40 text-destructive/70 transition-colors hover:bg-destructive hover:text-white" aria-label={`Delete ${emp.full_name}`} title="Permanently delete employee">
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingId === emp.id && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select value={editDept} onChange={(e) => setEditDept(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      )}
                      {editingId !== emp.id && (
                        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{getDeptDisplay(emp)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Desktop table (hidden below md) ── */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-48 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => {
                    const roleBadgeClass =
                      emp.role === 'dgm'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : emp.role === 'gm'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                        : emp.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'

                    return (
                      <TableRow key={emp.id} className={!emp.active ? 'opacity-50' : undefined}>
                        {/* Name / email */}
                        <TableCell>
                          {editingId === emp.id ? (
                            <Input
                              id={`edit-name-${emp.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          ) : (
                            <>
                              <div className="font-medium text-foreground">{emp.full_name}</div>
                              <div className="text-xs text-muted-foreground">{emp.email}</div>
                            </>
                          )}
                        </TableCell>

                        {/* Department */}
                        <TableCell>
                          {['dgm', 'gm'].includes(emp.role) ? (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          ) : editingId === emp.id ? (
                            <select
                              id={`edit-dept-${emp.id}`}
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {getDeptDisplay(emp)}
                            </span>
                          )}
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          {editingId === emp.id ? (
                            <select
                              id={`edit-role-${emp.id}`}
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ) : (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}>
                              {emp.role}
                            </span>
                          )}
                        </TableCell>

                        {/* Status badge */}
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              emp.active
                                ? 'bg-chart-4/15 text-chart-4'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {emp.active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {editingId === emp.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(emp.id)}
                                  disabled={saving}
                                  className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
                                  aria-label="Save"
                                >
                                  {saving
                                    ? <Loader2 className="size-3.5 animate-spin" />
                                    : <Check className="size-3.5" />}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  aria-label="Cancel"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* View details */}
                                <button
                                  onClick={() => setViewDetailsEmp(emp)}
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                  aria-label={`View details for ${emp.full_name}`}
                                  title="View employee profile details"
                                >
                                  <Eye className="size-3.5" />
                                </button>

                                {/* Edit name/dept/role */}
                                <button
                                  onClick={() => {
                                    setEditingId(emp.id)
                                    setEditName(emp.full_name)
                                    setEditDept(getEditDeptId(emp))
                                    setEditRole(emp.role ?? 'employee')
                                  }}
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                  aria-label={`Edit ${emp.full_name}`}
                                  title="Edit employee"
                                >
                                  <Pencil className="size-3.5" />
                                </button>

                                {/* Activate / deactivate */}
                                <button
                                  onClick={() => handleToggleActive(emp)}
                                  disabled={busyId === emp.id}
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                                  aria-label={emp.active ? 'Deactivate' : 'Reactivate'}
                                  title={emp.active ? 'Deactivate account' : 'Reactivate account'}
                                >
                                  {busyId === emp.id
                                    ? <Loader2 className="size-3.5 animate-spin" />
                                    : emp.active
                                      ? <UserX className="size-3.5" />
                                      : <UserCheck className="size-3.5" />}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => setDeleteTarget(emp)}
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/40 text-destructive/70 transition-colors hover:bg-destructive hover:text-white"
                                  aria-label={`Delete ${emp.full_name}`}
                                  title="Permanently delete employee"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
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
        </CardContent>
      </Card>
    </div>
  )
}
