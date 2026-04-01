import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// ── UserProfile type shared across the app ────────────────────────────────
export type UserRole = "admin" | "director" | "teacher"
export type Plan = "free" | "pro" | "enterprise"
export type SignupMethod = "email" | "google"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  academyId: string | null
  academyName: string | null
  academyCode: string | null
  /** auth.users.user_metadata.name 또는 full_name에서 읽음 — profiles 테이블에는 저장하지 않음 */
  displayName: string | null
  plan: Plan
  planStartedAt: string | null
  planExpiresAt: string | null
  signupMethod: SignupMethod
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
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  return (user.email ?? "").trim().toLowerCase() === adminEmail && adminEmail !== ""
}

// ── Helper: get full user profile (DB + fallback to user_metadata) ────────
export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getSupabaseUser()
  if (!user) return null

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  const userEmailNorm = (user.email ?? "").trim().toLowerCase()
  const isAdminByEmail = adminEmail !== "" && userEmailNorm === adminEmail

  // displayName: profiles에는 저장하지 않고 user_metadata에서 읽음
  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    null

  // Try profiles table (authoritative source)
  // admin 포함 모든 유저의 academy_id / 학원 정보를 DB에서 조회
  try {
    const db = createSupabaseAdminClient()
    const { data } = await db
      .from("profiles")
      .select("*, academies(id, name, code)")
      .eq("id", user.id)
      .single()

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let academy = (data as any).academies
      let resolvedAcademyId: string | null = data.academy_id ?? null

      // director인데 academy_id가 null → 자동으로 학원 찾아 연결 (2단계)
      const effectiveRole = isAdminByEmail ? "admin" : (data.role as UserRole)
      if (!resolvedAcademyId && effectiveRole === "director") {
        // 1차: academies.owner_id로 찾기
        const { data: ownedAcademy } = await db
          .from("academies")
          .select("id, name, code")
          .eq("owner_id", user.id)
          .maybeSingle()
        if (ownedAcademy) {
          resolvedAcademyId = ownedAcademy.id
          academy = ownedAcademy
          await db.from("profiles").update({ academy_id: ownedAcademy.id }).eq("id", user.id).catch(() => {})
        } else {
          // 2차: user_metadata.academy_id로 찾기 (가입 시 저장된 값)
          const metaAcademyId = user.user_metadata?.academy_id as string | undefined
          if (metaAcademyId) {
            const { data: metaAcademy } = await db
              .from("academies")
              .select("id, name, code")
              .eq("id", metaAcademyId)
              .maybeSingle()
            if (metaAcademy) {
              resolvedAcademyId = metaAcademy.id
              academy = metaAcademy
              await db.from("profiles").update({ academy_id: metaAcademy.id }).eq("id", user.id).catch(() => {})
            }
          }
        }
      }

      return {
        id: user.id,
        email: user.email!,
        // admin 이메일이면 role을 항상 'admin'으로 강제 (DB 값 무관)
        role: effectiveRole,
        academyId: resolvedAcademyId,
        academyName: academy?.name ?? null,
        academyCode: academy?.code ?? null,
        displayName,
        // admin 이메일이면 plan을 항상 'enterprise'로 강제
        plan: isAdminByEmail ? ("enterprise" as Plan) : ((data.plan as Plan) ?? "free"),
        planStartedAt: data.plan_started_at ?? null,
        planExpiresAt: data.plan_expires_at ?? null,
        signupMethod: (data.signup_method as SignupMethod) ?? "email",
      }
    }
  } catch {
    // Table might not exist yet — fall through to metadata
  }

  // DB에 profiles 행이 없는 경우: admin 이메일이면 기본값 반환
  if (isAdminByEmail) {
    return {
      id: user.id,
      email: user.email!,
      role: "admin" as UserRole,
      academyId: user.user_metadata?.academy_id ?? null,
      academyName: user.user_metadata?.academy_name ?? null,
      academyCode: null,
      displayName,
      plan: "enterprise" as Plan,
      planStartedAt: null,
      planExpiresAt: null,
      signupMethod: "email" as SignupMethod,
    }
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
    displayName,
    plan: "free" as Plan,
    planStartedAt: null,
    planExpiresAt: null,
    signupMethod: "email" as SignupMethod,
  }
}

// ── Helper: director-or-admin check ──────────────────────────────────────
export async function isDirectorOrAdmin(): Promise<boolean> {
  const profile = await getUserProfile()
  if (!profile) return false
  return profile.role === "admin" || profile.role === "director"
}
