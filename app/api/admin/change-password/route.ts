import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/change-password
 * Allows an authenticated admin to change their own password.
 * Body: { currentPassword: string; newPassword: string }
 *
 * We verify the current password by attempting a fresh sign-in with the
 * user's email + supplied current password before applying the update,
 * so the route is safe even if the session cookie is stolen.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Confirm the caller is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    // 2. Confirm the caller is an admin (or DGM / GM)
    const adminClient = createAdminClient()
    const { data: emp } = await adminClient
      .from('employees')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['admin', 'dgm', 'gm']
    const isDgmByEmail =
      process.env.DGM_EMAIL &&
      user.email.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()

    if (!isDgmByEmail && !allowedRoles.includes(emp?.role ?? '')) {
      return NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 },
      )
    }

    // 3. Parse and validate body
    const body = await request.json()
    const currentPassword = String(body.currentPassword ?? '').trim()
    const newPassword = String(body.newPassword ?? '').trim()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Both currentPassword and newPassword are required.' },
        { status: 400 },
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters.' },
        { status: 400 },
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must differ from the current password.' },
        { status: 400 },
      )
    }

    // 4. Verify the current password by re-authenticating with a fresh client
    //    (uses the anon key — this is a normal sign-in attempt)
    const verifyClient = createClient()
    const { error: signInError } = await (await verifyClient).auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 },
      )
    }

    // 5. Apply the new password via the admin service-role client so we
    //    bypass Supabase's "same-session" requirement for password updates
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword },
    )

    if (updateError) {
      console.error('[admin/change-password] update error:', updateError.message)
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
      name: emp?.full_name ?? user.email,
    })
  } catch (err) {
    console.error('[admin/change-password] unexpected error:', err)
    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 },
    )
  }
}
