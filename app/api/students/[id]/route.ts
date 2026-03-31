import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

async function requireDirectorOrAdmin() {
  const profile = await getUserProfile()
  if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }), profile: null }
  }
  return { error: null, profile }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(row: any, teacherEmail?: string | null) {
  return {
    id:                   row.id,
    name:                 row.name,
    grade:                row.grade ?? null,
    school:               row.school ?? null,
    memo:                 row.memo ?? null,
    status:               row.status,
    latestRiskScore:      row.latest_risk_score ?? 0,
    lastContactedAt:      row.last_contacted_at ?? null,
    assignedTeacherId:    row.assigned_teacher_id ?? null,
    assignedTeacherEmail: teacherEmail ?? null,
    createdAt:            row.created_at,
  }
}

async function getTeacherEmail(db: ReturnType<typeof createSupabaseAdminClient>, teacherId: string | null): Promise<string | null> {
  if (!teacherId) return null
  const { data } = await db.from("profiles").select("email").eq("id", teacherId).single()
  return data?.email ?? null
}

// ── GET /api/students/[id] ────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const db = createSupabaseAdminClient()

    const { data, error } = await db
      .from("students")
      .select("*")
      .eq("id", id)
      .eq("academy_id", profile!.academyId!)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 })
    }

    const teacherEmail = await getTeacherEmail(db, data.assigned_teacher_id)
    return NextResponse.json({ student: normalize(data, teacherEmail) })
  } catch (err) {
    console.error("[GET /api/students/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── PATCH /api/students/[id] ──────────────────────────────────────────────────
// Body: { name?, grade?, school?, memo?, status?, assignedTeacherId? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const academyId = profile!.academyId!
    const db = createSupabaseAdminClient()

    // 학생이 이 학원 소속인지 확인
    const { data: existing } = await db
      .from("students")
      .select("id")
      .eq("id", id)
      .eq("academy_id", academyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 })
    }

    const body = await req.json()
    const { name, grade, school, memo, status, assignedTeacherId } = body

    const validStatuses = ["active", "inactive", "withdrawn", "prospect"]
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (name !== undefined)   updateData.name   = name.trim()
    if (grade !== undefined)  updateData.grade  = grade?.trim() || null
    if (school !== undefined) updateData.school = school?.trim() || null
    if (memo !== undefined)   updateData.memo   = memo?.trim() || null

    if (status !== undefined && validStatuses.includes(status)) {
      updateData.status = status
    }

    if (assignedTeacherId !== undefined) {
      if (assignedTeacherId === null) {
        updateData.assigned_teacher_id = null
      } else {
        // 선생님이 같은 학원 소속인지 검증
        const { data: teacher } = await db
          .from("profiles")
          .select("id")
          .eq("id", assignedTeacherId)
          .eq("academy_id", academyId)
          .eq("role", "teacher")
          .single()

        updateData.assigned_teacher_id = teacher ? assignedTeacherId : null
      }
    }

    const { data, error } = await db
      .from("students")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      console.error("[PATCH /api/students/[id]]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const teacherEmail = await getTeacherEmail(db, data?.assigned_teacher_id)
    return NextResponse.json({ student: normalize(data, teacherEmail) })
  } catch (err) {
    console.error("[PATCH /api/students/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── DELETE /api/students/[id] ─────────────────────────────────────────────────
// 소프트 삭제: status = 'withdrawn'
// 완전 삭제 원할 경우 body에 { hard: true } 전달 (admin 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const academyId = profile!.academyId!
    const db = createSupabaseAdminClient()

    // 학생이 이 학원 소속인지 확인
    const { data: existing } = await db
      .from("students")
      .select("id, name")
      .eq("id", id)
      .eq("academy_id", academyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 })
    }

    // 완전 삭제 여부 확인 (admin만 가능)
    let hard = false
    try {
      const body = await req.json()
      hard = body?.hard === true && profile!.role === "admin"
    } catch { /* body 없음 — 소프트 삭제로 처리 */ }

    if (hard) {
      const { error } = await db.from("students").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: true })
    }

    // 소프트 삭제 — status = 'withdrawn'
    const { error } = await db
      .from("students")
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("[DELETE /api/students/[id]]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, withdrawn: true, name: existing.name })
  } catch (err) {
    console.error("[DELETE /api/students/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
