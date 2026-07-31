import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { OfficeEngManagerWorkspace } from '@/components/office-eng-manager-workspace'

export const metadata = {
  title: 'Manager Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

export default async function OfficeEngManagerPage() {
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

  // Security guard: must be admin, dgm, or office-eng manager
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    !(employee.role === 'manager' && employee.department_id === 'office-eng')
  ) {
    redirect('/auth/unauthorized')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <OfficeEngManagerWorkspace
          userId={employee.id}
          userEmail={employee.email}
          userName={employee.full_name}
          userDepartment={employee.department_id}
          userDepartmentId="office-eng"
          userRole={employee.role}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Office Engineering Manager Dashboard</p>
        </div>
      </footer>
    </div>
  )
}
