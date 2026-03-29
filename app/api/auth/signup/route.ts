import { NextRequest, NextResponse } from "next/server"
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

// POST /api/auth/signup — 이메일 인증 없이 즉시 회원가입 + 자동 로그인
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const body = await req.json()
    const { email, password, full_name, role, academy_id, academy_name } = body

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()

    // 이메일 인증 없이 즉시 가입 (email_confirm: true)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name ?? "",
        role: role ?? "teacher",
        academy_id: academy_id ?? "",
        academy_name: academy_name ?? "",
      },
    })

    if (createErr) {
      const msg =
        createErr.message.includes("already") || createErr.message.includes("registered")
          ? "이미 등록된 이메일입니다. 로그인을 시도해보세요."
          : createErr.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // profiles 테이블 수동 upsert (트리거가 실패할 경우 대비)
    if (created?.user) {
      await admin
        .from("profiles")
        .upsert({
          id: created.user.id,
          email,
          full_name: full_name ?? "",
          role: role ?? "teacher",
          academy_id: academy_id || null,
        })
        .select()
    }

    // 가입 직후 자동 로그인 (세션 쿠키 설정)
    const supabase = await createSupabaseServerClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      // 로그인 실패해도 가입은 성공 — 클라이언트가 별도 로그인 처리
      return NextResponse.json({ success: true, autoLogin: false })
    }

    return NextResponse.json({ success: true, autoLogin: true })
  } catch (err) {
    console.error("[POST /api/auth/signup]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
