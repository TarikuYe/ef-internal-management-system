import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Validates Origin and Referer headers for mutating requests (POST, PUT, PATCH, DELETE)
 * to guard custom API endpoints against Cross-Site Request Forgery (CSRF).
 */
export function validateOrigin(request: NextRequest): { isValid: boolean; errorResponse?: NextResponse } {
  const method = request.method.toUpperCase()

  // Only enforce origin check on state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true }
  }

  const originHeader = request.headers.get('origin')
  const refererHeader = request.headers.get('referer')
  const requestOrigin = request.nextUrl.origin

  // Verify Origin header if present
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader)
      if (originUrl.origin !== requestOrigin) {
        return {
          isValid: false,
          errorResponse: NextResponse.json(
            { error: 'Forbidden: Invalid request origin.' },
            { status: 403 },
          ),
        }
      }
    } catch {
      return {
        isValid: false,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: Malformed origin header.' },
          { status: 403 },
        ),
      }
    }
  }

  // Verify Referer header if Origin is missing
  if (!originHeader && refererHeader) {
    try {
      const refererUrl = new URL(refererHeader)
      if (refererUrl.origin !== requestOrigin) {
        return {
          isValid: false,
          errorResponse: NextResponse.json(
            { error: 'Forbidden: Invalid request referer.' },
            { status: 403 },
          ),
        }
      }
    } catch {
      return {
        isValid: false,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: Malformed referer header.' },
          { status: 403 },
        ),
      }
    }
  }

  return { isValid: true }
}
