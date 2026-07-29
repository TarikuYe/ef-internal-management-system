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

/**
 * GET /api/admin/email-settings
 * Returns current email configuration (non-secret fields only).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    // Return what is safe to expose (env var names/values that aren't secrets)
    const settings = {
      from_address: process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? process.env.SMTP_FROM_EMAIL ?? '',
      from_name: process.env.EMAIL_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? 'EF Architect and Engineering Consulting PLC.',
      provider: process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'none',
      smtp_host: process.env.SMTP_HOST ?? '',
      smtp_port: process.env.SMTP_PORT ?? '587',
      smtp_user: process.env.SMTP_USER ?? '',
      // Never expose secrets — just indicate if they are set
      smtp_pass_set: !!(process.env.SMTP_PASS || process.env.SMTP_PASSWORD),
      resend_key_set: !!process.env.RESEND_API_KEY,
      alert_recipients: process.env.ALERT_EMAIL_RECIPIENTS ?? process.env.ADMIN_EMAILS ?? '',
      cron_secret_set: !!process.env.CRON_SECRET,
    }

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[admin/email-settings] GET error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/email-settings/test
 * Sends a test email to the requesting admin.
 * Body: { recipient?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await requireAdmin(user.id, user.email)))
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const recipient = body.recipient ?? user.email

    // Try Resend first, fall back to nodemailer
    let sent = false
    let method = ''
    let errorMsg = ''

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        // Build a proper "Name <email>" from address using the same env vars as GET
        const fromEmail = process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? process.env.SMTP_FROM_EMAIL ?? ''
        const fromName  = process.env.EMAIL_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? 'EF A&E Internal Management Portal'
        const from = fromEmail
          ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail)
          : `${fromName} <noreply@efae.com>`
        const { error } = await resend.emails.send({
          from,
          to: recipient,
          subject: 'EF A&E Portal — Test Email',
          html: `<p>This is a test email sent from the Admin Panel of the EF A&E Internal Management Portal.</p><p>If you received this, your Resend configuration is working correctly.</p><p><small>Sent at ${new Date().toISOString()}</small></p>`,
        })
        if (error) throw new Error(error.message)
        sent = true
        method = 'resend'
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e)
      }
    }

    if (!sent && process.env.SMTP_HOST) {
      try {
        const nodemailer = await import('nodemailer')
        const smtpPort = parseInt(process.env.SMTP_PORT ?? '587')
        // Port 465 is always SSL; port 587 uses STARTTLS (secure: false)
        const secure = process.env.SMTP_SECURE === 'true' || smtpPort === 465
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD,
          },
        })
        const fromEmail = process.env.EMAIL_FROM ?? process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? ''
        const fromName  = process.env.EMAIL_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? ''
        await transporter.sendMail({
          from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
          to: recipient,
          subject: 'EF A&E Portal — Test Email',
          html: `<p>This is a test email sent from the Admin Panel.</p><p>Your SMTP configuration is working correctly.</p>`,
        })
        sent = true
        method = 'smtp'
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e)
      }
    }

    if (!sent) {
      return NextResponse.json(
        { error: `Email send failed. ${errorMsg}`.trim() },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, method, recipient })
  } catch (err) {
    console.error('[admin/email-settings] POST error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
