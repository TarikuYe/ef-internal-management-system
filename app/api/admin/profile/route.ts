import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'dgm', 'gm']

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const adminClient = createAdminClient()
  const { data: emp } = await adminClient
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const isDgmByEmail =
    process.env.DGM_EMAIL &&
    user.email.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()

  if (!isDgmByEmail && !ALLOWED_ROLES.includes(emp?.role ?? '')) return null
  return { user, emp }
}

/**
 * GET /api/admin/profile
 * Returns the current admin's full employee record + auth email.
 */
export async function GET() {
  try {
    const ctx = await getAuthedAdmin()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    // For DGM/GM roles there is no department — label them as Executive
    const role = ctx.emp?.role ?? ''
    const isExecutive = role === 'dgm' || role === 'gm'
    let rawDept = ctx.emp?.department ?? ctx.emp?.department_id ?? ''
    if (role === 'manager' && ctx.emp?.department_id) {
      rawDept = ctx.emp.department_id
    }

    const DEPT_MAP: Record<string, string> = {
      'contract':           'Contract Administration',
      'design':             'Design Department',
      'procurement':        'Procurement Department',
      'supervision':        'Supervision Department',
      'office-eng':         'Office Engineering',
      'office_eng':         'Office Engineering',
      'contract_admin':     'Contract Administration',
      'management':         'Management',
      'office_engineering': 'Office Engineering',
      'design_department':  'Design Department',
    }
    const slug = rawDept.toLowerCase().replace(/[\s-]/g, '_')
    const cleanDept = isExecutive
      ? 'Executive'
      : (DEPT_MAP[slug]
          ?? (rawDept
              ? rawDept.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : 'Not set')
        )

    return NextResponse.json({
      profile: {
        id:           ctx.emp?.id,
        full_name:    ctx.emp?.full_name ?? '',
        email:        ctx.user.email,
        role:         ctx.emp?.role ?? '',
        department:   cleanDept,
        active:       ctx.emp?.active ?? true,
        created_at:   ctx.emp?.created_at ?? null,
        job_title:    ctx.emp?.job_title ?? '',
        phone:        ctx.emp?.phone ?? '',
        location:     ctx.emp?.location ?? '',
        bio:          ctx.emp?.bio ?? '',
        avatar_url:   ctx.emp?.avatar_url ?? '',
      },
    })
  } catch (err) {
    console.error('[admin/profile] GET error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/profile
 * Updates editable profile fields for the authenticated admin.
 * Body: { full_name?, job_title?, phone?, location?, bio? }
 *
 * Columns job_title / phone / location / bio require the
 * add_profile_fields migration to have been run. If they don't exist yet
 * the route falls back to only updating full_name (which always exists).
 */
export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthedAdmin()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json()

    const ALWAYS_EXISTS   = ['full_name'] as const
    const EXTENDED_FIELDS = ['job_title', 'phone', 'location', 'bio'] as const
    const ALL_FIELDS      = [...ALWAYS_EXISTS, ...EXTENDED_FIELDS] as const
    type AllowedField     = typeof ALL_FIELDS[number]

    // Collect only the fields that were actually sent with valid string values
    const updates: Partial<Record<AllowedField, string>> = {}
    for (const field of ALL_FIELDS) {
      if (field in body && typeof body[field] === 'string') {
        updates[field] = body[field].trim()
      }
    }

    if ('full_name' in updates && !updates.full_name) {
      return NextResponse.json({ error: 'Full name cannot be empty.' }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // ── Attempt 1: update all requested fields ──
    const { error } = await adminClient
      .from('employees')
      .update(updates)
      .eq('id', ctx.user.id)

    if (!error) {
      return NextResponse.json({ success: true, updates })
    }

    // ── Attempt 2: unknown column (42703 / PGRST204) ──
    // The extended profile columns haven't been migrated yet.
    // Fall back to updating only the columns that always exist.
    const isSchemaError =
      error.code === '42703' ||        // PostgreSQL unknown column
      error.code === 'PGRST204' ||     // PostgREST: column not in schema cache
      (error.message ?? '').toLowerCase().includes('column') ||
      (error.message ?? '').toLowerCase().includes('schema cache')

    if (isSchemaError) {
      console.warn('[admin/profile] Extended columns missing — falling back to full_name only. Run migrations/add_profile_fields.sql to enable all fields.')

      const fallback: Partial<Record<string, string>> = {}
      if (updates.full_name) fallback.full_name = updates.full_name

      if (Object.keys(fallback).length > 0) {
        const { error: e2 } = await adminClient
          .from('employees')
          .update(fallback)
          .eq('id', ctx.user.id)

        if (e2) {
          console.error('[admin/profile] Fallback update error:', e2)
          return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        updates: fallback,
        warning: 'Extended profile fields (job_title, phone, location, bio) are not available yet. Run the add_profile_fields migration to enable them.',
      })
    }

    // ── Any other DB error ──
    console.error('[admin/profile] PATCH error:', error)
    return NextResponse.json({ error: error.message ?? 'Failed to update profile.' }, { status: 500 })

  } catch (err) {
    console.error('[admin/profile] PATCH unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
