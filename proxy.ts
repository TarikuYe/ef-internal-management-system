import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSafeRedirectUrl } from '@/lib/security/redirects'

// Routes that do NOT require user authentication
const publicPaths = [
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/unauthorized',
  '/api/auth',
  '/api/send-reminders',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Generate dynamic nonce for Content Security Policy (CSP)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    supabaseUrl,
    process.env.NODE_ENV === 'development' ? 'http://localhost:* ws://localhost:* wss://localhost:*' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
  `.replace(/\s{2,}/g, ' ').trim()

  // Clone request headers and inject x-nonce and CSP header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  // 2. Static files & internal Next.js paths: return response with security headers
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    res.headers.set('Content-Security-Policy', cspHeader)
    return res
  }

  // 3. Always run updateSession so the Supabase session token pair is refreshed
  const { supabaseResponse, user } = await updateSession(request)

  // Apply CSP header to Supabase response
  supabaseResponse.headers.set('Content-Security-Policy', cspHeader)

  // 4. Public paths: allow through after session refresh
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // 5. Protected route checks
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/submit') ||
    pathname.startsWith('/api/submissions')

  if (isProtectedRoute) {
    if (!user) {
      // Validate redirect URL to prevent Open Redirect vulnerabilities
      const safeRedirect = getSafeRedirectUrl(pathname, '/auth/signin')
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('redirect', safeRedirect)

      const redirectResponse = NextResponse.redirect(signInUrl)
      // Forward refreshed session cookies
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      redirectResponse.headers.set('Content-Security-Policy', cspHeader)
      return redirectResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all request paths except static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
