import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Info, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Procurement Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

export default async function ProcurementWorkspacePage() {
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

  // Security check: ensure engineer belongs to procurement or has admin/dgm access
  if (
    employee.role !== 'admin' &&
    employee.role !== 'dgm' &&
    employee.department_id !== 'procurement'
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
              Employee Workspace
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Procurement
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitor procurement lifecycles, RFQs, vendor comparisons, and purchase approvals.
            </p>
          </div>

          <Card className="border-dashed border-2 border-border">
            <CardHeader className="flex flex-col items-center justify-center text-center p-12">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Sparkles className="size-6" />
              </div>
              <CardTitle className="text-lg">Discovery Phase Active</CardTitle>
              <CardDescription className="max-w-md mt-2 text-sm">
                The Procurement module is currently undergoing discovery. RFQ templates, quotation evaluations, and purchase approval pipelines are being mapped.
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
          <p>EF Management Portal — Procurement Workspace</p>
        </div>
      </footer>
    </div>
  )
}
