import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

// ── POST /api/billing/upgrade ─────────────────────────────────────────────────
// 플랜 업그레이드/변경 (서버에서만 처리 — 클라이언트 직접 수정 차단)
// Body: { plan: 'pro' | 'enterprise' }
export async function POST(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const body = await req.json()
    const { plan } = body

    const validPlans = ["free", "pro", "enterprise"]
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: "유효하지 않은 플랜입니다." }, { status: 400 })
    }

    const db = createSupabaseAdminClient()
    const now = new Date().toISOString()

    // plan_history 기록
    await db.from("plan_history").insert({
      user_id:    profile.id,
      academy_id: profile.academyId,
      from_plan:  profile.plan,
      to_plan:    plan,
      changed_by: "user",
      reason:     plan === "free" ? "downgrade" : "upgrade",
      changed_at: now,
    })

    // profiles 업데이트
    const { error } = await db
      .from("profiles")
      .update({
        plan,
        plan_started_at: now,
        plan_expires_at: null, // 결제 연동 시 만료일 설정
        updated_at: now,
      })
      .eq("id", profile.id)

    if (error) {
      console.error("[POST /api/billing/upgrade]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan,
      changedAt: now,
      message: `${plan === "pro" ? "Pro" : plan === "enterprise" ? "Enterprise" : "Free"} 플랜으로 변경되었습니다.`,
    })
  } catch (err) {
    console.error("[POST /api/billing/upgrade]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── GET /api/billing/upgrade ──────────────────────────────────────────────────
// 플랜 변경 이력 조회
export async function GET() {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ history: [] })
    }

    const db = createSupabaseAdminClient()
    const { data } = await db
      .from("plan_history")
      .select("*")
      .eq("user_id", profile.id)
      .order("changed_at", { ascending: false })
      .limit(20)

    return NextResponse.json({ history: data ?? [] })
  } catch (err) {
    console.error("[GET /api/billing/upgrade]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
