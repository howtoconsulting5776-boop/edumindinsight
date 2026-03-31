// ADMIN_BYPASS_EMAIL 환경변수 설정 안내:
// .env.local 에 아래 항목을 추가하세요.
// # 사용량 제한 bypass 이메일 (테스트/관리자용)
// ADMIN_BYPASS_EMAIL=your_admin_email@example.com
//
// # Supabase
// NEXT_PUBLIC_SUPABASE_URL=...
// NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//
// # OAuth (Supabase Dashboard에서 설정)
// # Google: Dashboard → Auth → Providers → Google
// # Kakao:  Dashboard → Auth → Providers → Kakao

import { NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server"
import { getRemainingUsage } from "@/services/usageService"
import type { Plan, SignupMethod } from "@/services/usageService"

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase가 구성되지 않았습니다." },
      { status: 503 }
    )
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const db = createSupabaseAdminClient()
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("academy_id, plan, email, signup_method")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "프로필 정보를 불러올 수 없습니다." },
        { status: 404 }
      )
    }

    const plan = ((profile.plan as Plan) ?? "free")
    const signupMethod = ((profile.signup_method as SignupMethod) ?? "email")
    const academyId: string | null = profile.academy_id ?? null

    // 관리자 bypass: 무제한으로 처리
    const adminBypassEmail = process.env.ADMIN_BYPASS_EMAIL
    const userEmail = user.email ?? profile.email ?? ""
    if (adminBypassEmail && userEmail === adminBypassEmail) {
      return NextResponse.json({
        used: 0,
        limit: null,
        remaining: null,
        percent: 0,
        plan: "enterprise",
        signup_method: signupMethod,
      })
    }

    if (!academyId) {
      return NextResponse.json({
        used: 0,
        limit: null,
        remaining: null,
        percent: 0,
        plan,
        signup_method: signupMethod,
      })
    }

    const { used, limit, remaining, percent } = await getRemainingUsage(academyId, plan)

    return NextResponse.json({ used, limit, remaining, percent, plan, signup_method: signupMethod })
  } catch (err) {
    console.error("[usage] GET error:", err)
    return NextResponse.json(
      { error: "사용량 조회 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
