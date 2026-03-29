import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// ── Supabase client for server components / route handlers ─────────────────
// Uses the anon key + the user's session cookie (respects RLS).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie mutation ignored.
          }
        },
      },
    }
  )
}

// ── Supabase admin client (service role — bypasses RLS) ────────────────────
// Use ONLY in trusted server-side code (API routes, server components).
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Supabase admin client: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set."
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Helper: is Supabase fully configured? ──────────────────────────────────
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// ── Helper: get authenticated user from server context ────────────────────
export async function getSupabaseUser() {
  if (!isSupabaseConfigured()) return null
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// ── Helper: is the current user an admin? ─────────────────────────────────
export async function isAdminUser(): Promise<boolean> {
  const user = await getSupabaseUser()
  if (!user) return false
  const adminEmail = process.env.ADMIN_EMAIL ?? ""
  return user.email === adminEmail
}
