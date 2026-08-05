import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

export interface AuthUser {
  id: string
  email?: string
  role?: string
}

/**
 * Ensures the request is made by an authenticated user.
 * Throws an Error if unauthenticated.
 */
export async function requireAuthenticatedUser(): Promise<AuthUser> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized: Authentication required.')
  }

  return {
    id: user.id,
    email: user.email,
    role: user.user_metadata?.role || user.role,
  }
}

/**
 * Ensures the request is made by the DGM / Admin user.
 * Throws an Error if unauthorized.
 */
export async function requireDGMUser(): Promise<AuthUser> {
  const currentUser = await requireAuthenticatedUser()

  const dgmEmail = env.DGM_EMAIL?.toLowerCase()
  const userEmail = currentUser.email?.toLowerCase()

  const isDGMByEmail = Boolean(dgmEmail && userEmail && userEmail === dgmEmail)
  const isDGMByRole = currentUser.role === 'admin' || currentUser.role === 'dgm'

  if (!isDGMByEmail && !isDGMByRole) {
    throw new Error('Forbidden: DGM or Admin privileges required.')
  }

  return currentUser
}
