import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { ContractManagerWorkspace } from '@/components/contract-manager-workspace'

export const metadata = {
  title: 'Manager Control Center — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

type ManagerTab = 'dashboard' | 'timesheets' | 'projects' | 'registrar' | 'evaluations' | 'exports' | 'profile' | 'analytics'

export default async function ContractAdminManagerPage({
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

  // Security guard: must be admin, dgm, or contract-admin manager
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    !(employee.role === 'manager' && employee.department_id === 'contract')
  ) {
    redirect('/auth/unauthorized')
  }

  const VALID: ManagerTab[] = ['dashboard', 'timesheets', 'projects', 'registrar', 'evaluations', 'exports', 'profile', 'analytics']
  const { tab: rawTab = '' } = await searchParams
  const initialTab: ManagerTab = VALID.includes(rawTab as ManagerTab) ? (rawTab as ManagerTab) : 'dashboard'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <ContractManagerWorkspace
          userId={user.id}
          userEmail={user.email}
          userName={employee.full_name}
          userDepartment={employee.department}
          userDepartmentId="contract"
          userRole={employee.role}
          initialTab={initialTab}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Manager Dashboard</p>
        </div>
      </footer>
    </div>
  )
}
