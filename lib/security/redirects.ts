/**
 * Safe Redirect Utility to prevent Open Redirect Vulnerabilities.
 * Ensures redirects remain strictly internal to the application.
 */

/**
 * Validates whether a given URL is a safe internal redirect path.
 * @param url The redirect target candidate
 * @returns boolean indicating if the URL is a safe internal path
 */
export function isSafeRedirectUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmed = url.trim()

  // Must start with '/' but NOT '//' or '/\' (protocol-relative/evasive URLs)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false
  }

  // Reject URLs containing control characters or whitespace
  if (/[\x00-\x1F\x7F\s]/.test(trimmed)) {
    return false
  }

  // Attempt to parse as relative URL relative to a dummy base host
  try {
    const parsed = new URL(trimmed, 'https://localhost')
    // Pathname must equal original trimmed path (no host injection)
    return parsed.origin === 'https://localhost'
  } catch {
    return false
  }
}

/**
 * Returns a sanitized internal redirect path, falling back to a default route.
 * @param url The untrusted candidate path
 * @param fallback Default safe route if candidate is invalid
 */
export function getSafeRedirectUrl(url: string | null | undefined, fallback = '/dashboard'): string {
  if (isSafeRedirectUrl(url)) {
    return url as string
  }
  return fallback
}
