/**
 * Module-level flag used to prevent the site header from briefly flashing
 * the unauthenticated state (e.g. "Get started" button) when sign-out fires
 * the Supabase auth state change before the page navigates away.
 */
let _signingOut = false

export function setSigningOut(value: boolean) {
  _signingOut = value
}

export function isSigningOut() {
  return _signingOut
}
