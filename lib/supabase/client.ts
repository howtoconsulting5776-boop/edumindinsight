"use client"

import { createBrowserClient } from "@supabase/ssr"

const SUPABASE_TIMEOUT_MS = 8000

// fetch wrapper with 8-second timeout — prevents 21-second hangs when
// the Supabase project is paused or the network is unavailable.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id))
}

// ── Supabase browser client ────────────────────────────────────────────────
// Used in client components. Sessions are stored in cookies automatically
// so they are available to server components and the middleware.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchWithTimeout } }
  )
}
