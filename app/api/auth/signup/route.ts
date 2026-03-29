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

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    let userId: string | null = null

    if (serviceRoleKey && supabaseUrl) {
      // ── 경로 A: admin 클라이언트로 이메일 인증 없이 즉시 가입 ──
      const admin = createSupabaseAdminClient()

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
        console.error("[signup] createUser error:", createErr.message)
        let msg = createErr.message
        if (msg.includes("already") || msg.includes("registered") || msg.includes("duplicate") || msg.includes("User already")) {
          msg = "이미 등록된 이메일입니다. 로그인을 시도해보세요."
        } else if (msg.includes("Database error") || msg.includes("database")) {
          msg = "데이터베이스 오류가 발생했습니다. Supabase 스키마(supabase-schema-v2.sql)를 적용해주세요."
        } else if (msg.includes("password")) {
          msg = "비밀번호는 최소 6자 이상이어야 합니다."
        } else if (msg.includes("Invalid email")) {
          msg = "올바른 이메일 형식을 입력해주세요."
        }
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      userId = created?.user?.id ?? null

      // profiles 테이블 수동 upsert (트리거 실패 대비)
      if (userId) {
        try {
          await admin.from("profiles").upsert({
            id: userId,
            email,
            full_name: full_name ?? "",
            role: role ?? "teacher",
            academy_id: academy_id || null,
          })
        } catch (profileErr) {
          console.warn("[signup] profile upsert failed:", profileErr)
        }
      }
    } else {
      // ── 경로 B: SUPABASE_SERVICE_ROLE_KEY 없을 때 일반 signUp 폴백 ──
      console.warn("[signup] SUPABASE_SERVICE_ROLE_KEY not set — falling back to signUp()")
      const supabase = await createSupabaseServerClient()
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name ?? "",
            role: role ?? "teacher",
            academy_id: academy_id ?? "",
            academy_name: academy_name ?? "",
          },
        },
      })

      if (signupErr) {
        let msg = signupErr.message
        if (msg.includes("already") || msg.includes("registered")) {
          msg = "이미 등록된 이메일입니다. 로그인을 시도해보세요."
        } else if (msg.includes("password")) {
          msg = "비밀번호는 최소 6자 이상이어야 합니다."
        }
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      userId = signupData?.user?.id ?? null

      // 이메일 인증 없이 바로 로그인을 시도 (이미 세션이 있을 경우)
      if (signupData?.session) {
        return NextResponse.json({ success: true, autoLogin: true })
      }

      // 이메일 인증이 필요한 경우
      return NextResponse.json({ success: true, autoLogin: false, needsEmailVerification: true })
    }

    // 가입 직후 자동 로그인 (세션 쿠키 설정)
    const supabase = await createSupabaseServerClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      return NextResponse.json({ success: true, autoLogin: false })
    }

    return NextResponse.json({ success: true, autoLogin: true, role: role ?? "teacher" })
  } catch (err) {
    console.error("[POST /api/auth/signup]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
