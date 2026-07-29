import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that do NOT require authentication
const publicPaths = [
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/unauthorized',
  '/api/auth', // Auth API routes (signup, etc.)
  '/api/send-reminders', // Has its own CRON_SECRET auth
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and Next.js internals through without touching the session
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Always run updateSession so the token pair is refreshed on every request.
  // Skipping this on public paths was the cause of "Invalid Refresh Token" errors.
  const { supabaseResponse, user } = await updateSession(request)

  // Public paths: allow through after session refresh (so cookies are updated)
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // Check auth for protected routes
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/submit') ||
    pathname.startsWith('/api/submissions')

  if (isProtectedRoute) {
    if (!user) {
      // Redirect to sign-in with return URL
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      const redirectResponse = NextResponse.redirect(signInUrl)
      // Carry over any refreshed session cookies
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
    // Role-based access (DGM, admin, etc.) is enforced at the page/API level,
    // which can query the database. The middleware only ensures the user is
    // authenticated before reaching any protected route.
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all request paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
