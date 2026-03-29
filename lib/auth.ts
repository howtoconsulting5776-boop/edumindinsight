import { cookies } from "next/headers"

export type UserRole = "admin" | "user"

export interface Session {
  role: UserRole
  username: string
}

const SESSION_COOKIE = "edumind-session"
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// ── Credential validation ───────────────────────────────────────────────────

export function validateCredentials(
  username: string,
  password: string
): UserRole | null {
  const adminUser = process.env.ADMIN_USERNAME ?? "admin"
  const adminPass = process.env.ADMIN_PASSWORD ?? "edumind2024"
  const normalUser = process.env.USER_USERNAME ?? "teacher"
  const normalPass = process.env.USER_PASSWORD ?? "howto2024"

  if (username === adminUser && password === adminPass) return "admin"
  if (username === normalUser && password === normalPass) return "user"
  return null
}

// ── Session helpers (server-side) ───────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export async function setSession(session: Session): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// ── Middleware helper (reads from NextRequest directly) ─────────────────────

export function getSessionFromCookieString(cookieHeader: string | null): Session | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1])) as Session
  } catch {
    return null
  }
}
