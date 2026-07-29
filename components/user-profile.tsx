'use client'

import React, { useState, useRef } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Camera, KeyRound, Eye, EyeOff, Check, Pencil,
  CheckCheck, Info, Mail, Building2, ShieldCheck, Activity,
  ScrollText, ShieldAlert, UserCircle, BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Colour themes per role family
const THEME = {
  employee: {
    grad:    'from-blue-600 via-indigo-600 to-violet-700',
    roleBadge: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    cardIcon:  'bg-blue-500/10 text-blue-500',
    pwIcon:    'bg-rose-500/10 text-rose-500',
  },
  manager: {
    grad:    'from-amber-500 via-orange-500 to-rose-600',
    roleBadge: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
    cardIcon:  'bg-amber-500/10 text-amber-500',
    pwIcon:    'bg-rose-500/10 text-rose-500',
  },
} as const
type ThemeKey = keyof typeof THEME

function getInitials(name: string) {
  return ((name || 'ME').split(' ').map(w => w[0]).join('').toUpperCase() + 'ME').substring(0, 2)
}

export interface UserProfileProps {
  /** Supabase auth user id */
  userId: string
  userEmail: string
  userName: string
  userRole: string
  userDepartment: string
  /** 'employee' → blue theme, 'manager' → amber theme */
  theme?: ThemeKey
}

export function UserProfile({
  userId, userEmail, userName, userRole, userDepartment,
  theme: themeProp,
}: UserProfileProps) {
  const theme = THEME[themeProp ?? (userRole === 'manager' ? 'manager' : 'employee')]
  const { grad, roleBadge, cardIcon, pwIcon } = theme

  const { data, isLoading, mutate } = useSWR<{ profile: any }>(
    '/api/user/profile', fetcher
  )
  const profile = data?.profile

  // ── Avatar ──
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
  }, [profile?.avatar_url])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    setAvatarUrl(URL.createObjectURL(file))
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setAvatarUrl(json.url + '?t=' + Date.now())
      toast.success('Profile photo updated')
      mutate()
    } catch (err) {
      setAvatarUrl(profile?.avatar_url ?? null)
      toast.error('Upload failed', { description: err instanceof Error ? err.message : 'Try again.' })
    } finally {
      setUploadingAvatar(false)
      if (avatarRef.current) avatarRef.current.value = ''
    }
  }

  // ── Profile edit ──
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ full_name: '', job_title: '', phone: '', location: '', bio: '' })

  React.useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? '',
      job_title: profile.job_title ?? '',
      phone:     profile.phone     ?? '',
      location:  profile.location  ?? '',
      bio:       profile.bio       ?? '',
    })
  }, [profile])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Full name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      toast.success('Profile updated')
      setEditing(false)
      mutate()
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Try again.' })
    } finally { setSaving(false) }
  }

  function cancelEdit() {
    setEditing(false)
    if (profile) setForm({
      full_name: profile.full_name ?? '', job_title: profile.job_title ?? '',
      phone: profile.phone ?? '', location: profile.location ?? '', bio: profile.bio ?? '',
    })
  }

  // ── Password change ──
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
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setChanging(true)
    try {
      // Verify current password then update via Supabase client
      const supabase = createClient()
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: userEmail, password: currentPw,
      })
      if (verifyErr) { toast.error('Current password is incorrect'); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
      if (updateErr) throw updateErr
      toast.success('Password updated successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwDone(true); setTimeout(() => setPwDone(false), 4000)
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Try again.' })
    } finally { setChanging(false) }
  }

  const memberYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null
  const displayName = profile?.full_name || userName
  const displayDept = (() => {
    const d = profile?.department || userDepartment || ''
    if (!d || d.toLowerCase().includes('contract') || d.includes('_')) return 'Contract Administration'
    return d
  })()

  return (
    <div className="flex flex-col gap-6">

      {/* ══ HERO ══ */}
      <div className={`relative bg-gradient-to-br ${grad} overflow-hidden rounded-2xl`}>
        <div className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize:'150px' }} />
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 size-40 rounded-full bg-black/20 blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-9 pb-7 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">

            {/* Clickable avatar */}
            <div className="relative shrink-0 group">
              <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only" onChange={handleAvatarChange} aria-label="Upload profile photo" />
              <button type="button" onClick={() => avatarRef.current?.click()}
                className="relative flex size-24 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-2 ring-white/25 text-white font-black text-3xl shadow-xl overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                title="Change profile photo">
                {avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                  : isLoading ? <Loader2 className="size-8 animate-spin opacity-60" />
                  : getInitials(displayName)}
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl gap-1">
                  {uploadingAvatar ? <Loader2 className="size-5 animate-spin text-white" /> : <Camera className="size-5 text-white" />}
                  <span className="text-[9px] font-bold text-white/90 uppercase tracking-wide">
                    {uploadingAvatar ? 'Uploading…' : 'Change'}
                  </span>
                </span>
              </button>
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-background shadow pointer-events-none">
                <span className="size-2 rounded-full bg-white" />
              </span>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0 pb-1">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-7 w-52 rounded-lg bg-white/20 animate-pulse" />
                  <div className="h-4 w-36 rounded-lg bg-white/15 animate-pulse" />
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                    {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-white/70 font-medium">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    {displayDept ? ` · ${displayDept}` : ''}
                  </p>
                </>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pb-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${roleBadge}`}>
                <span className="size-1.5 rounded-full bg-current opacity-80" />{userRole}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />Active
              </span>
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
                { label: 'Email',    value: userEmail },
                { label: 'Location', value: profile?.location || 'Not set' },
                { label: 'Phone',    value: profile?.phone    || 'Not set' },
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
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">

        {/* ── Main (left 2/3) ── */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Professional Profile card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className={`flex size-9 items-center justify-center rounded-xl ${cardIcon} shadow`}>
                  <UserCircle className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Professional Profile</p>
                  <p className="text-[11px] text-muted-foreground">Your information across the portal</p>
                </div>
              </div>
              {!editing && (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                  <Pencil className="size-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="px-6 py-5">
              {!editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Full Name', value: profile?.full_name || '—', icon: UserCircle },
                    { label: 'Phone',     value: profile?.phone      || '—', icon: Activity },
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
                      : <p className="text-sm text-muted-foreground italic">No bio yet. Click Edit to add one.</p>}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      { id:'fn', label:'Full Name *', key:'full_name', type:'text', ph:'e.g. Dawit Bekele', req:true  },
                      { id:'ph', label:'Phone',        key:'phone',     type:'tel',  ph:'e.g. +251 91 234 5678', req:false },
                    ] as const).map(({ id, label, key, type, ph, req }) => (
                      <div key={id} className="flex flex-col gap-1.5">
                        <label htmlFor={`up-${id}`} className="text-xs font-semibold text-foreground">{label}</label>
                        <Input id={`up-${id}`} type={type}
                          value={(form as any)[key]}
                          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={ph} required={req}
                          className="h-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 focus-visible:ring-primary/40" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="up-bio" className="text-xs font-semibold text-foreground">Bio / About</label>
                    <textarea id="up-bio" value={form.bio} rows={3}
                      onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Brief professional summary…"
                      className="w-full border border-border/70 bg-background text-foreground rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" disabled={saving}
                      className={`h-9 gap-1.5 text-sm border-0 text-white hover:opacity-90 shadow-sm bg-gradient-to-r ${grad}`}>
                      {saving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : <><Check className="size-3.5" /> Save Changes</>}
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

          {/* Change Password card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
              <div className={`flex size-9 items-center justify-center rounded-xl ${pwIcon}`}>
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
                <p className="text-sm text-muted-foreground">Your new password is active.</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="px-6 py-5 grid gap-4 sm:grid-cols-2 max-w-2xl">
                {/* Current password — full width */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="up-cpw" className="text-xs font-semibold text-foreground">Current Password *</label>
                  <div className="relative">
                    <Input id="up-cpw" type={showCurrent ? 'text' : 'password'} value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Enter your current password"
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
                  <label htmlFor="up-npw" className="text-xs font-semibold text-foreground">New Password *</label>
                  <div className="relative">
                    <Input id="up-npw" type={showNew ? 'text' : 'password'} value={newPw}
                      onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
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
                  <label htmlFor="up-fpw" className="text-xs font-semibold text-foreground">Confirm Password *</label>
                  <div className="relative">
                    <Input id="up-fpw" type={showConfirm ? 'text' : 'password'} value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                      className={`h-10 pr-10 rounded-lg border-border/70 bg-background focus-visible:ring-2 ${confirmPw && confirmPw !== newPw ? 'border-rose-400 focus-visible:ring-rose-400/40' : 'focus-visible:ring-primary/40'}`}
                      required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle">
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {confirmPw.length > 0 && (
                    <p className={`text-[11px] font-semibold flex items-center gap-1 ${confirmPw === newPw ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {confirmPw === newPw ? <><Check className="size-3" /> Passwords match</> : 'Passwords do not match'}
                    </p>
                  )}
                </div>
                {/* Hint + submit */}
                <div className="sm:col-span-2 flex flex-col gap-3">
                  <div className="flex gap-2.5 rounded-xl bg-secondary/40 border border-border/40 px-4 py-3 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5 text-primary" />
                    <span>Use at least <strong>8 characters</strong> with uppercase letters, numbers and symbols.</span>
                  </div>
                  <Button type="submit"
                    disabled={changing || !currentPw || !newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
                    className={`h-10 self-start gap-2 border-0 text-white hover:opacity-90 shadow-sm bg-gradient-to-r ${grad}`}>
                    {changing ? <><Loader2 className="size-4 animate-spin" /> Updating…</> : <><KeyRound className="size-4" /> Update Password</>}
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
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white font-black text-sm shadow overflow-hidden`}>
                      {avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                        : getInitials(displayName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                  {[
                    { label: 'Role',         value: userRole },
                    { label: 'Status',       value: 'Active' },
                    { label: 'Department',   value: displayDept },
                    { label: 'Member Since', value: memberYear ? `Since ${memberYear}` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[11px] font-bold text-foreground capitalize">{value}</span>
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
              <p className="font-bold text-sm text-foreground">Security Tips</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2.5">
              {[
                'Change your password every 90 days',
                'Never share your login credentials',
                'Use a strong, unique password',
                'Sign out on shared computers',
                'Report any suspicious activity',
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
