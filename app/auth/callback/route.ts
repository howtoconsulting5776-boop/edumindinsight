import { NextRequest, NextResponse } from "next/server"
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

// GET /auth/callback — Supabase OAuth 리다이렉트 핸들러
// Supabase Dashboard → Auth → URL Configuration → Redirect URLs 에 아래 URL 등록 필요:
//   https://<your-domain>/auth/callback
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession error:", exchangeError.message)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=no_user`)
    }

    // 프로필 확인 — academy_id가 없으면 온보딩 필요
    const db = createSupabaseAdminClient()
    const { data: profile } = await db
      .from("profiles")
      .select("academy_id, role, signup_method")
      .eq("id", user.id)
      .single()

    if (!profile?.academy_id) {
      // 신규 소셜 유저 → 온보딩 페이지로
      return NextResponse.redirect(`${origin}/auth/social-onboarding`)
    }

    // 기존 유저 → 역할에 맞는 페이지로
    const dest = profile.role === "admin" || profile.role === "director" ? "/admin" : "/"
    return NextResponse.redirect(`${origin}${dest}`)
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }
}
