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
    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 })
    }

    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    // ────────────────────────────────────────────────────────────────────────
    // 경로 A: admin 클라이언트 사용 (SUPABASE_SERVICE_ROLE_KEY 있을 때)
    // ────────────────────────────────────────────────────────────────────────
    if (hasServiceKey) {
      const admin = createSupabaseAdminClient()

      // 트리거 오류 방지: user_metadata에 최소 정보만 포함
      // (academy_id를 메타에 넣으면 트리거가 academies.owner_id 업데이트를 시도해 실패할 수 있음)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name ?? "",
          role: role ?? "teacher",
          // academy 정보는 메타에서 제외 → 트리거 간소화
        },
      })

      if (createErr) {
        console.error("[signup] createUser error:", createErr.message)
        let msg = createErr.message
        if (msg.includes("already") || msg.includes("registered") || msg.includes("duplicate") || msg.includes("User already")) {
          msg = "이미 등록된 이메일입니다. 로그인을 시도해보세요."
        } else if (msg.includes("Database error") || msg.includes("database")) {
          return NextResponse.json({ error: "DB_SETUP_NEEDED" }, { status: 409 })
        } else if (msg.includes("password")) {
          msg = "비밀번호는 최소 6자 이상이어야 합니다."
        } else if (msg.includes("Invalid email")) {
          msg = "올바른 이메일 형식을 입력해주세요."
        }
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      const userId = created?.user?.id ?? null

      // user_metadata 업데이트 (academy 정보 포함)
      if (userId && (academy_id || academy_name)) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: full_name ?? "",
            role: role ?? "teacher",
            academy_id: academy_id ?? "",
            academy_name: academy_name ?? "",
          },
        }).catch((e) => console.warn("[signup] metadata update failed:", e))
      }

      // profiles 테이블 수동 upsert
      if (userId) {
        try {
          await admin.from("profiles").upsert({
            id: userId,
            email,
            full_name: full_name ?? "",
            role: role ?? "teacher",
            academy_id: academy_id || null,
            plan: "free",
            plan_started_at: new Date().toISOString(),
            signup_method: "email",
          })
        } catch (profileErr) {
          console.warn("[signup] profile upsert failed:", profileErr)
        }

        // director인 경우 academy.owner_id 업데이트
        if (role === "director" && academy_id) {
          try {
            await admin
              .from("academies")
              .update({ owner_id: userId, updated_at: new Date().toISOString() })
              .eq("id", academy_id)
              .is("owner_id", null)
          } catch (e) {
            console.warn("[signup] academy owner update failed:", e)
          }
        }
      }

      // 서버에서 자동 로그인을 시도하지 않음.
      // 클라이언트(브라우저)에서 signInWithPassword()를 직접 호출해야
      // 세션 쿠키가 브라우저에 올바르게 저장됩니다.
      return NextResponse.json({ success: true, autoLogin: false, role: role ?? "teacher" })
    }

    // ────────────────────────────────────────────────────────────────────────
    // 경로 B: SUPABASE_SERVICE_ROLE_KEY 없을 때 → 일반 signUp 폴백
    // ────────────────────────────────────────────────────────────────────────
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

    // 경로 B에서는 클라이언트가 브라우저에서 직접 로그인하도록 유도
    // (서버에서 세션 쿠키를 설정하면 브라우저에 제대로 전달되지 않음)
    if (signupData?.user && !signupData.session) {
      // 이메일 인증 필요
      return NextResponse.json({ success: true, autoLogin: false, needsEmailVerification: true })
    }

    return NextResponse.json({ success: true, autoLogin: false, role: role ?? "teacher" })

  } catch (err) {
    console.error("[POST /api/auth/signup]", err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("fetch failed") || msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("network")) {
      return NextResponse.json({ error: "SUPABASE_PAUSED" }, { status: 503 })
    }
    return NextResponse.json({ error: "회원가입 중 서버 오류가 발생했습니다." }, { status: 500 })
  }
}
