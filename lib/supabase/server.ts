import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// ── UserProfile type shared across the app ────────────────────────────────
export type UserRole = "admin" | "director" | "teacher"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  academyId: string | null
  academyName: string | null
  academyCode: string | null
  fullName: string | null
}

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

const SERVER_TIMEOUT_MS = 4000

function serverFetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS)
  return fetch(input as string, { ...(init as RequestInit), signal: controller.signal }).finally(
    () => clearTimeout(id)
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
    global: { fetch: serverFetchWithTimeout },
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
// Tries getUser() (network-validated) first; falls back to getSession()
// (cookie-only JWT parse) so the app keeps working when Supabase is
// temporarily unreachable (e.g. project paused or network issue).
export async function getSupabaseUser() {
  if (!isSupabaseConfigured()) return null
  try {
    const supabase = await createSupabaseServerClient()

    // Primary: server-validated token
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) return user

    if (error) console.warn("[getSupabaseUser] getUser error:", error.message)

    // Fallback: parse JWT from cookie without network call
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) return session.user

    return null
  } catch (err) {
    console.error("[getSupabaseUser] unexpected error:", err)
    // Last resort: try session from cookie
    try {
      const supabase = await createSupabaseServerClient()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.user ?? null
    } catch {
      return null
    }
  }
}

// ── Helper: is the current user a super-admin? ───────────────────────────
export async function isAdminUser(): Promise<boolean> {
  const user = await getSupabaseUser()
  if (!user) return false
  const adminEmail = process.env.ADMIN_EMAIL ?? ""
  return user.email === adminEmail
}

// ── Helper: get full user profile (DB + fallback to user_metadata) ────────
export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getSupabaseUser()
  if (!user) return null

  const adminEmail = process.env.ADMIN_EMAIL ?? ""

  // Super-admin shortcut — no DB query needed
  if (user.email === adminEmail) {
    return {
      id: user.id,
      email: user.email!,
      role: "admin",
      academyId: null,
      academyName: null,
      academyCode: null,
      fullName: user.user_metadata?.full_name ?? null,
    }
  }

  // Try profiles table (authoritative source)
  try {
    const db = createSupabaseAdminClient()
    const { data } = await db
      .from("profiles")
      .select("*, academies(id, name, code)")
      .eq("id", user.id)
      .single()

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const academy = (data as any).academies
      return {
        id: user.id,
        email: user.email!,
        role: data.role as UserRole,
        academyId: data.academy_id ?? null,
        academyName: academy?.name ?? null,
        academyCode: academy?.code ?? null,
        fullName: data.full_name ?? null,
      }
    }
  } catch {
    // Table might not exist yet — fall through to metadata
  }

  // Fallback: JWT user_metadata (set during signUp)
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email!,
    role: (meta.role as UserRole) ?? "teacher",
    academyId: meta.academy_id ?? null,
    academyName: meta.academy_name ?? null,
    academyCode: null,
    fullName: meta.full_name ?? null,
  }
}

// ── Helper: director-or-admin check ──────────────────────────────────────
export async function isDirectorOrAdmin(): Promise<boolean> {
  const profile = await getUserProfile()
  if (!profile) return false
  return profile.role === "admin" || profile.role === "director"
}
