import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { DesignEmployeeWorkspace } from '@/components/design-employee-workspace'

export const metadata = {
  title: 'Design Department Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

type Tab = 'dashboard' | 'timesheet' | 'projects' | 'evaluations' | 'profile'

export default async function DesignWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/auth/signin')
  }

  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee) {
    redirect('/dashboard')
  }

  // Security: must belong to design dept, or have admin/dgm cross-dept access
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    employee.department_id !== 'design'
  ) {
    redirect('/auth/unauthorized')
  }

  const VALID: Tab[] = ['dashboard', 'timesheet', 'projects', 'evaluations', 'profile']
  const { tab: rawTab = '' } = await searchParams
  const initialTab: Tab = VALID.includes(rawTab as Tab) ? (rawTab as Tab) : 'dashboard'

  const DEPT_MAP: Record<string, string> = {
    'contract': 'Contract Administration',
    'design': 'Design Department',
    'office-eng': 'Office Engineering',
    'procurement': 'Procurement',
    'supervision': 'Supervision & Water Works',
    'office_engineering': 'Office Engineering',
  }
  const rawDept = employee.department_id || employee.department || ''
  const formattedDept = DEPT_MAP[rawDept] || rawDept

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <DesignEmployeeWorkspace
          userId={user.id}
          userEmail={user.email}
          userName={employee.full_name}
          userDepartment={formattedDept}
          userRole={employee.role}
          initialTab={initialTab}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Design Department Workspace</p>
        </div>
      </footer>
    </div>
  )
}
