import 'server-only'
import { NextResponse } from 'next/server'

interface RateLimitStore {
  count: number
  resetTime: number
}

const memoryStore = new Map<string, RateLimitStore>()

/**
 * High-performance sliding window / token bucket memory rate limiter fallback.
 * Can be replaced or backed by @upstash/ratelimit when UPSTASH_REDIS_REST_URL is configured.
 */
export async function checkRateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60 * 1000,
): Promise<{ success: boolean; remaining: number; resetTime: number; response?: NextResponse }> {
  const now = Date.now()
  const key = `ratelimit:${identifier}`

  const current = memoryStore.get(key)

  if (!current || now > current.resetTime) {
    const resetTime = now + windowMs
    memoryStore.set(key, { count: 1, resetTime })
    return { success: true, remaining: limit - 1, resetTime }
  }

  if (current.count >= limit) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000)
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(current.resetTime / 1000)),
        },
      },
    )
    return { success: false, remaining: 0, resetTime: current.resetTime, response }
  }

  current.count += 1
  memoryStore.set(key, current)
  return { success: true, remaining: limit - current.count, resetTime: current.resetTime }
}
