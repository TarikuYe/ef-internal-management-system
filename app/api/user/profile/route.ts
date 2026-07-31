import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Any authenticated employee/manager can call this — no role restriction. */
async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  return { user, adminClient: createAdminClient() }
}

/**
 * GET /api/user/profile
 * Returns the current user's employee record.
 */
export async function GET() {
  try {
    const ctx = await getAuthedUser()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { data: emp } = await ctx.adminClient
      .from('employees')
      .select('*')
      .eq('id', ctx.user.id)
      .maybeSingle()

    let rawDept = emp?.department_id ?? emp?.department ?? ''
    if (emp?.role === 'manager' && emp?.department_id) {
      rawDept = emp.department_id
    }
    const DEPT_MAP: Record<string, string> = {
      // department_id slugs
      'contract':           'Contract Administration',
      'design':             'Design Department',
      'procurement':        'Procurement Department',
      'supervision':        'Supervision Department',
      'office-eng':         'Office Engineering',
      'office_eng':         'Office Engineering',
      // ef_department enum values
      'contract_admin':     'Contract Administration',
      'management':         'Management',
      'office_engineering': 'Office Engineering',
      'design_department':  'Design Department',
    }
    // Normalise: lowercase + replace spaces/dashes with underscores for lookup
    const slug = rawDept.toLowerCase().replace(/[\s-]/g, '_')
    let cleanDept: string
    if (DEPT_MAP[slug]) {
      cleanDept = DEPT_MAP[slug]
    } else if (rawDept.includes('_') || rawDept.includes('-')) {
      // Unknown slug — prettify it
      cleanDept = rawDept.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    } else {
      cleanDept = rawDept || 'Not set'
    }

    return NextResponse.json({
      profile: {
        id:          emp?.id,
        full_name:   emp?.full_name  ?? '',
        email:       ctx.user.email,
        role:        emp?.role       ?? '',
        department:  cleanDept,
        active:      emp?.active     ?? true,
        created_at:  emp?.created_at ?? null,
        job_title:   emp?.job_title  ?? '',
        phone:       emp?.phone      ?? '',
        location:    emp?.location   ?? '',
        bio:         emp?.bio        ?? '',
        avatar_url:  emp?.avatar_url ?? '',
      },
    })
  } catch (err) {
    console.error('[user/profile] GET error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/profile
 * Updates editable self-service profile fields.
 * Body: { full_name?, job_title?, phone?, location?, bio? }
 */
export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthedUser()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json()
    const ALLOWED = ['full_name', 'job_title', 'phone', 'location', 'bio'] as const
    type F = typeof ALLOWED[number]

    const updates: Partial<Record<F, string>> = {}
    for (const f of ALLOWED) {
      if (f in body && typeof body[f] === 'string') updates[f] = body[f].trim()
    }

    if ('full_name' in updates && !updates.full_name) {
      return NextResponse.json({ error: 'Full name cannot be empty.' }, { status: 400 })
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
    }

    const { error } = await ctx.adminClient
      .from('employees')
      .update(updates)
      .eq('id', ctx.user.id)

    if (error) {
      // Extended columns not yet migrated — fall back to full_name only
      const isSchemaError =
        error.code === '42703' || error.code === 'PGRST204' ||
        (error.message ?? '').toLowerCase().includes('column') ||
        (error.message ?? '').toLowerCase().includes('schema cache')

      if (isSchemaError) {
        if (updates.full_name) {
          const { error: e2 } = await ctx.adminClient
            .from('employees').update({ full_name: updates.full_name }).eq('id', ctx.user.id)
          if (e2) return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
        }
        return NextResponse.json({
          success: true, updates: { full_name: updates.full_name },
          warning: 'Run migrations/add_profile_fields.sql to enable all fields.',
        })
      }
      return NextResponse.json({ error: error.message ?? 'Failed to update.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, updates })
  } catch (err) {
    console.error('[user/profile] PATCH error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
