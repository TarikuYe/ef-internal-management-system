'use client'

import { createClient } from '@/lib/supabase/client'
import { setSigningOut } from '@/lib/sign-out-state'
import { LogOut } from 'lucide-react'

export function SignOutButton({ className }: { className?: string }) {
  async function handleSignOut() {
    // Set flag BEFORE sign-out so the header's onAuthStateChange listener
    // knows not to flash the unauthenticated UI while we navigate away.
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/signin'
  }

  return (
    <button
      onClick={handleSignOut}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className ?? ''}`}
    >
      <LogOut className="size-4" />
      Sign out
    </button>
  )
}
