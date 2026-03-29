import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionFromCookieString } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Supabase SSR path (when env vars are set) ────────────────────────────
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseProxy(request, pathname)
  }

  // ── Legacy cookie-based fallback ─────────────────────────────────────────
  return legacyProxy(request, pathname)
}

// ── Supabase-aware proxy ───────────────────────────────────────────────────
// Uses getSession() (local cookie read, no network call) for fast route
// protection.  The actual user identity is re-verified server-side inside
// every API route via requireAdmin() → isAdminUser() → getUser().
async function supabaseProxy(request: NextRequest, pathname: string) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads the JWT from the auth cookie without a network round-trip,
  // making navigation near-instant.  Token integrity is enforced at the API layer.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const userEmail = session?.user?.email ?? null
  const adminEmail = process.env.ADMIN_EMAIL ?? ""
  const isLoggedIn = !!session
  const isAdmin = isLoggedIn && userEmail === adminEmail

  // Redirect already-authenticated users away from /login
  if (pathname === "/login") {
    if (isLoggedIn) {
      return NextResponse.redirect(
        new URL(isAdmin ? "/admin" : "/", request.url)
      )
    }
    return response
  }

  // Protect /admin — must be authenticated AND admin email
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  // Protect main analysis page
  if (pathname === "/") {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return response
  }

  return response
}

// ── Legacy cookie-based fallback (no Supabase configured) ─────────────────
function legacyProxy(request: NextRequest, pathname: string) {
  const cookieHeader = request.headers.get("cookie")
  const session = getSessionFromCookieString(cookieHeader)

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(session.role === "admin" ? "/admin" : "/", request.url)
      )
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (pathname === "/") {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*"],
}
