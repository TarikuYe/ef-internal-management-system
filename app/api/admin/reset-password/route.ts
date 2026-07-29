import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin(userId: string, userEmail: string) {
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) return true
  const admin = createAdminClient()
  const { data } = await admin.from('employees').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin' || data?.role === 'dgm'
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/**
 * POST /api/admin/reset-password
 * Generates a new temporary password for a user.
 * Body: { id: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const targetId = String(body.id ?? '').trim()
    if (!targetId) return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })

    const admin = createAdminClient()

    // Confirm target exists
    const { data: emp } = await admin
      .from('employees')
      .select('id, full_name, email')
      .eq('id', targetId)
      .maybeSingle()

    if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

    const tempPassword = generateTempPassword()

    const { error } = await admin.auth.admin.updateUserById(targetId, {
      password: tempPassword,
    })

    if (error) {
      console.error('[admin/reset-password] error:', error.message)
      return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      employee: { id: emp.id, full_name: emp.full_name, email: emp.email },
      temp_password: tempPassword,
    })
  } catch (err) {
    console.error('[admin/reset-password] error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
