import { NextRequest, NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server"

// POST /api/auth/social-profile — 소셜 로그인 후 프로필 초기 설정
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
  }

  // ── 1. 인증 확인 ─────────────────────────────────────────────────────────
  let userId: string
  let userEmail: string
  let signupMethod: "email" | "google"

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }
    userId = user.id
    userEmail = user.email ?? ""
    const provider = (user.app_metadata?.provider as string | undefined) ?? "email"
    signupMethod = provider === "google" ? "google" : "email"
  } catch (err) {
    console.error("[social-profile] auth error:", err)
    return NextResponse.json({ error: "인증 확인 중 오류가 발생했습니다." }, { status: 500 })
  }

  // ── 2. 요청 본문 파싱 ────────────────────────────────────────────────────
  let role: "director" | "teacher"
  let academy_name: string | undefined
  let academy_id: string | undefined

  try {
    const body = await req.json()
    role = body.role
    academy_name = body.academy_name
    academy_id = body.academy_id
  } catch (err) {
    console.error("[social-profile] body parse error:", err)
    return NextResponse.json({ error: "요청 데이터를 읽을 수 없습니다." }, { status: 400 })
  }

  if (!role) {
    return NextResponse.json({ error: "직책을 선택해주세요." }, { status: 400 })
  }

  const db = createSupabaseAdminClient()

  // ── 3. 학원 확정 ─────────────────────────────────────────────────────────
  let resolvedAcademyId: string
  let resolvedAcademyName: string

  if (role === "director") {
    if (!academy_name?.trim()) {
      return NextResponse.json({ error: "학원 이름을 입력해주세요." }, { status: 400 })
    }

    // 기존 /api/academies 와 동일한 코드 생성 로직
    let code = ""
    try {
      for (let i = 0; i < 5; i++) {
        const candidate = Math.random().toString(36).substring(2, 10).toUpperCase()
        const { data: existing } = await db
          .from("academies")
          .select("id")
          .eq("code", candidate)
          .maybeSingle()
        if (!existing) { code = candidate; break }
      }
    } catch (err) {
      console.error("[social-profile] code gen error:", err)
    }

    if (!code) {
      return NextResponse.json({ error: "초대 코드 생성에 실패했습니다. 다시 시도해주세요." }, { status: 500 })
    }

    try {
      const { data: academy, error: academyError } = await db
        .from("academies")
        .insert({ name: academy_name.trim(), code })
        .select("id, name, code")
        .single()

      if (academyError || !academy) {
        console.error("[social-profile] academy insert error:", academyError?.message)
        return NextResponse.json({ error: "학원 생성에 실패했습니다." }, { status: 500 })
      }

      resolvedAcademyId = academy.id
      resolvedAcademyName = academy.name
    } catch (err) {
      console.error("[social-profile] academy insert threw:", err)
      return NextResponse.json({ error: "학원 생성에 실패했습니다." }, { status: 500 })
    }

    // owner_id 업데이트 — 컬럼이 없어도 무시
    try {
      await db
        .from("academies")
        .update({ owner_id: userId })
        .eq("id", resolvedAcademyId)
    } catch (err) {
      console.warn("[social-profile] owner_id update skipped:", err)
    }
  } else {
    if (!academy_id) {
      return NextResponse.json({ error: "학원 코드를 검색하여 학원을 확인해주세요." }, { status: 400 })
    }

    try {
      const { data: academy, error: academyError } = await db
        .from("academies")
        .select("id, name")
        .eq("id", academy_id)
        .single()

      if (academyError || !academy) {
        return NextResponse.json({ error: "학원을 찾을 수 없습니다." }, { status: 404 })
      }

      resolvedAcademyId = academy.id
      resolvedAcademyName = academy.name
    } catch (err) {
      console.error("[social-profile] academy lookup threw:", err)
      return NextResponse.json({ error: "학원 정보를 불러올 수 없습니다." }, { status: 500 })
    }
  }

  // ── 4. 프로필 upsert ─────────────────────────────────────────────────────
  // plan: "free" 는 baseProfile에 항상 포함 — fallback 경로에서도 plan이 누락되지 않도록 보장
  const baseProfile = {
    id:         userId,
    email:      userEmail,
    role,
    academy_id: resolvedAcademyId,
    plan:       "free" as const,   // 항상 free로 강제 — 업그레이드는 별도 결제 플로우에서만
  }

  try {
    const { error: fullError } = await db.from("profiles").upsert({
      ...baseProfile,
      plan_started_at: new Date().toISOString(),
      signup_method:   signupMethod,
    })

    if (fullError) {
      console.warn("[social-profile] full upsert failed, trying fallback:", fullError.message)
      // fallback도 plan: "free" 포함 (baseProfile에 이미 포함됨)
      const { error: fallbackError } = await db.from("profiles").upsert(baseProfile)
      if (fallbackError) {
        console.error("[social-profile] fallback upsert error:", fallbackError.message)
        return NextResponse.json({ error: "프로필 저장에 실패했습니다." }, { status: 500 })
      }
    }
  } catch (err) {
    console.error("[social-profile] profile upsert threw:", err)
    return NextResponse.json({ error: "프로필 저장에 실패했습니다." }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    role,
    academy_id: resolvedAcademyId,
    academy_name: resolvedAcademyName,
  })
}
