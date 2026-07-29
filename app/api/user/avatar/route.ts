import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'
const MAX_BYTES = 3 * 1024 * 1024 // 3 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * POST /api/user/avatar
 * Accepts multipart/form-data with a single "file" field.
 * Any authenticated user (any role) can upload their own avatar.
 * Uploads to Supabase Storage bucket "avatars" under avatars/<userId>.<ext>
 * Returns { url } — the public URL of the uploaded avatar.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP and GIF images are allowed.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image must be smaller than 3 MB.' },
        { status: 400 }
      )
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${user.id}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true, // overwrite previous avatar
      })

    if (uploadError) {
      console.error('[user/avatar] upload error:', uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Persist avatar_url on the employee row
    await adminClient
      .from('employees')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)
    // ignore error — column may not exist yet (migration not run)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[user/avatar] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
