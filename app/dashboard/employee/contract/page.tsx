import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { ContractEmployeeWorkspace } from '@/components/contract-employee-workspace'

export const metadata = {
  title: 'Contract Administration Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

type Tab = 'dashboard' | 'timesheet' | 'projects' | 'registrar' | 'evaluations' | 'profile'

async function getEmployee(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return employee
}

export default async function ContractAdminWorkspacePage({
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

  const employee = await getEmployee(user.id)
  
  if (!employee) {
    redirect('/dashboard')
  }

  // Security check: ensure engineer belongs to contract-admin or has admin privileges
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    employee.department_id !== 'contract'
  ) {
    redirect('/auth/unauthorized')
  }

  const VALID: Tab[] = ['dashboard', 'timesheet', 'projects', 'registrar', 'evaluations', 'profile']
  const { tab: rawTab = '' } = await searchParams
  const initialTab: Tab = VALID.includes(rawTab as Tab) ? (rawTab as Tab) : 'dashboard'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <ContractEmployeeWorkspace
          userId={user.id}
          userEmail={user.email}
          userName={employee.full_name}
          userDepartment={employee.department}
          userRole={employee.role}
          initialTab={initialTab}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Direct Entry Mode</p>
        </div>
      </footer>
    </div>
  )
}
