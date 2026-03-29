"use client"

import { createBrowserClient } from "@supabase/ssr"

// ── Supabase browser client ────────────────────────────────────────────────
// Used in client components. Sessions are stored in cookies automatically
// so they are available to server components and the middleware.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
