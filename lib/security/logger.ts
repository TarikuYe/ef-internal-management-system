import 'server-only'

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'service_role',
]

/**
 * Sanitizes input data before writing to server logs to prevent Log Injection
 * and accidental exposure of sensitive keys or auth tokens.
 */
function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    // Strip control characters & newlines to prevent log injection / forging
    return data.replace(/[\r\n]/g, ' ')
  }

  if (typeof data === 'object') {
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message.replace(/[\r\n]/g, ' '),
        stack: data.stack?.replace(/[\r\n]/g, ' '),
      }
    }

    if (Array.isArray(data)) {
      return data.map(sanitizeLogData)
    }

    const sanitizedObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))
      if (isSensitive) {
        sanitizedObj[key] = '[REDACTED]'
      } else {
        sanitizedObj[key] = sanitizeLogData(value)
      }
    }
    return sanitizedObj
  }

  return data
}

export const securityLogger = {
  info: (message: string, ...meta: unknown[]) => {
    const sanitizedMsg = message.replace(/[\r\n]/g, ' ')
    const sanitizedMeta = meta.map(sanitizeLogData)
    console.log(`[INFO] [${new Date().toISOString()}] ${sanitizedMsg}`, ...sanitizedMeta)
  },
  warn: (message: string, ...meta: unknown[]) => {
    const sanitizedMsg = message.replace(/[\r\n]/g, ' ')
    const sanitizedMeta = meta.map(sanitizeLogData)
    console.warn(`[WARN] [${new Date().toISOString()}] ${sanitizedMsg}`, ...sanitizedMeta)
  },
  error: (message: string, ...meta: unknown[]) => {
    const sanitizedMsg = message.replace(/[\r\n]/g, ' ')
    const sanitizedMeta = meta.map(sanitizeLogData)
    console.error(`[ERROR] [${new Date().toISOString()}] ${sanitizedMsg}`, ...sanitizedMeta)
  },
}
