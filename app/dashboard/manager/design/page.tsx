import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Info, Sparkles, Award } from 'lucide-react'

export const metadata = {
  title: 'Manager Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

export default async function DesignManagerPage() {
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

  // Security guard: must be admin, dgm, or design manager
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    !(employee.role === 'manager' && employee.department_id === 'design')
  ) {
    redirect('/auth/unauthorized')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Manager Control Center
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Design Department
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review and coordinate operational tasks, design outputs, and drawing lifecycle reviews.
            </p>
          </div>

          <Card className="border-dashed border-2 border-border">
            <CardHeader className="flex flex-col items-center justify-center text-center p-12">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Sparkles className="size-6" />
              </div>
              <CardTitle className="text-lg">Manager Discovery Phase Active</CardTitle>
              <CardDescription className="max-w-md mt-2 text-sm">
                The Design Department management metrics, approval chains, and KPI charts are currently undergoing system discovery and database mapping.
              </CardDescription>
              <div className="flex items-center gap-2 mt-6 p-3 rounded-md bg-secondary/50 text-xs text-muted-foreground max-w-lg">
                <Info className="size-4 text-primary shrink-0" />
                <span>Existing Contract Administration databases, correspondence registers, and timesheet logs are preserved and unaffected.</span>
              </div>
            </CardHeader>
          </Card>
        </div>
      </main>
      <footer className="border-t border-border bg-secondary/40 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Design Manager Dashboard</p>
        </div>
      </footer>
    </div>
  )
}
