import 'server-only'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { securityLogger } from '@/lib/security/logger'

/**
 * Standardized API Error Handler.
 * Strips internal stack traces and database error details in production environments
 * to prevent security information disclosure.
 */
export function handleApiError(error: unknown, context = 'API Request') {
  securityLogger.error(`Error encountered in ${context}:`, error)

  const isDev = env.NODE_ENV === 'development'

  if (error instanceof Error) {
    if (error.message.startsWith('Unauthorized') || error.message.startsWith('Forbidden')) {
      const statusCode = error.message.startsWith('Unauthorized') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status: statusCode })
    }

    return NextResponse.json(
      {
        error: isDev ? error.message : 'An unexpected error occurred. Please try again later.',
        ...(isDev && { details: error.stack }),
      },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { error: 'An unexpected internal server error occurred.' },
    { status: 500 },
  )
}
