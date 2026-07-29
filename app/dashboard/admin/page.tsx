import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { AdminPanel } from '@/components/admin-panel'

export const dynamic = 'force-dynamic'

const VALID_TABS = [
  'dashboard', 'users', 'disable', 'reset', 'departments',
  'logs', 'backup', 'health', 'email', 'permissions', 'profile',
] as const
type AdminTab = typeof VALID_TABS[number]

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  // Server-side auth guard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/auth/signin?redirect=/dashboard/admin')
  }

  // Role check — only admin and dgm/gm can access this page
  const admin = createAdminClient()

  // Fast-path for DGM env var
  const isDgmEmail =
    process.env.DGM_EMAIL &&
    user.email.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()

  let resolvedRole: string = isDgmEmail ? 'dgm' : 'admin'

  if (!isDgmEmail) {
    const { data: employee } = await admin
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (employee?.role !== 'admin' && employee?.role !== 'dgm' && employee?.role !== 'gm') {
      redirect('/auth/unauthorized')
    }

    resolvedRole = employee?.role ?? 'admin'
  }

  // Resolve initial tab from query param, falling back to 'profile' for DGM and 'dashboard' for admin
  const { tab: rawTab = '' } = await searchParams
  const isDgm = resolvedRole === 'dgm' || resolvedRole === 'gm'
  const defaultTab: AdminTab = isDgm ? 'profile' : 'dashboard'
  const initialTab: AdminTab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as AdminTab)
    : defaultTab

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/30 to-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-4 py-6 sm:py-8 sm:px-6">
        <AdminPanel initialTab={initialTab} role={resolvedRole} />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>{isDgm ? 'My Profile' : 'Admin Panel'} — Restricted Access</p>
        </div>
      </footer>
    </div>
  )
}
