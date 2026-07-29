import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'dgm', 'gm']
const BUCKET = 'avatars'
const MAX_BYTES = 3 * 1024 * 1024 // 3 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const isDgmByEmail =
    process.env.DGM_EMAIL &&
    user.email.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()

  const adminClient = createAdminClient()
  const { data: emp } = await adminClient
    .from('employees')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isDgmByEmail && !ALLOWED_ROLES.includes(emp?.role ?? '')) return null
  return { user, adminClient }
}

/**
 * POST /api/admin/avatar
 * Accepts multipart/form-data with a single "file" field.
 * Uploads to Supabase Storage bucket "avatars" under avatars/<userId>.<ext>
 * Returns { url } — the public URL of the uploaded avatar.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedAdmin()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP and GIF images are allowed.' }, { status: 400 })
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'Image must be smaller than 3 MB.' }, { status: 400 })

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${ctx.user.id}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await ctx.adminClient.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true, // overwrite previous avatar
      })

    if (uploadError) {
      console.error('[admin/avatar] upload error:', uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = ctx.adminClient.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Persist the avatar_url on the employee row if the column exists
    await ctx.adminClient
      .from('employees')
      .update({ avatar_url: publicUrl })
      .eq('id', ctx.user.id)
    // ignore error — column may not exist yet (migration not run)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[admin/avatar] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
