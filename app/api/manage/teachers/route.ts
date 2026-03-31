import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

async function requireDirector() {
  const profile = await getUserProfile()
  if (!profile || (profile.role !== "director" && profile.role !== "admin")) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }), profile: null }
  }
  return { error: null, profile }
}

// GET /api/manage/teachers — 현재 학원의 선생님 목록 + 학원 정보
export async function GET() {
  try {
    const { error: authError, profile } = await requireDirector()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const db = createSupabaseAdminClient()

    // Super-admin: return all academies summary — for this route, return first academy
    // Director: return their academy only
    const academyId = profile!.academyId

    if (!academyId) {
      return NextResponse.json({ academy: null, teachers: [] })
    }

    const [academyRes, teachersRes] = await Promise.all([
      db.from("academies").select("id, name, code").eq("id", academyId).single(),
      db.from("profiles")
        .select("id, email, created_at")
        .eq("academy_id", academyId)
        .eq("role", "teacher")
        .order("created_at", { ascending: true }),
    ])

    if (academyRes.error) {
      return NextResponse.json({ error: academyRes.error.message }, { status: 500 })
    }

    return NextResponse.json({
      academy: academyRes.data,
      teachers: teachersRes.data ?? [],
    })
  } catch (err) {
    console.error("[GET /api/manage/teachers]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/manage/teachers — 선생님 학원에서 제외 (academy_id = null)
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirector()
    if (authError) return authError

    const body = await req.json()
    const teacherId: string = body.teacherId ?? ""
    if (!teacherId) {
      return NextResponse.json({ error: "teacherId가 필요합니다." }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const db = createSupabaseAdminClient()

    // Verify the teacher belongs to the director's academy
    const { data: teacher } = await db
      .from("profiles")
      .select("id, academy_id, role")
      .eq("id", teacherId)
      .single()

    if (!teacher || teacher.academy_id !== profile!.academyId) {
      return NextResponse.json({ error: "해당 선생님을 찾을 수 없습니다." }, { status: 404 })
    }
    if (teacher.role !== "teacher") {
      return NextResponse.json({ error: "선생님 계정만 제외할 수 있습니다." }, { status: 400 })
    }

    const { error } = await db
      .from("profiles")
      .update({ academy_id: null })
      .eq("id", teacherId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/manage/teachers]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
