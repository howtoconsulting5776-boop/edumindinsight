import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

// ── Auth helpers ─────────────────────────────────────────────────────────────
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

// assigned_teacher_id 목록으로 profiles에서 이메일 일괄 조회
async function fetchTeacherEmails(db: ReturnType<typeof createSupabaseAdminClient>, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const { data } = await db.from("profiles").select("id, email").in("id", unique)
  const map = new Map<string, string>()
  for (const row of data ?? []) map.set(row.id, row.email ?? "")
  return map
}

// ── GET /api/students ─────────────────────────────────────────────────────────
// Query params:
//   status  = active | inactive | withdrawn | prospect | all  (default: active)
//   search  = 이름 검색 (부분 일치)
//   risk    = high | medium | low  (high: 70+, medium: 40–69, low: 0–39)
//   teacher = assigned_teacher_id UUID (선생님 본인 담당 학생만)
export async function GET(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get("status") ?? "active"
    const search       = searchParams.get("search") ?? ""
    const riskFilter   = searchParams.get("risk") ?? ""
    const teacherFilter = searchParams.get("teacher") ?? ""

    const academyId = profile!.academyId
    if (!academyId) {
      return NextResponse.json({ students: [] })
    }

    const db = createSupabaseAdminClient()

    let query = db
      .from("students")
      .select("*")
      .eq("academy_id", academyId)
      .order("latest_risk_score", { ascending: false })
      .order("last_contacted_at", { ascending: false, nullsFirst: false })

    // 상태 필터
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    // 이름 검색
    if (search.trim()) {
      query = query.ilike("name", `%${search.trim()}%`)
    }

    // 위험도 필터
    if (riskFilter === "high") {
      query = query.gte("latest_risk_score", 70)
    } else if (riskFilter === "medium") {
      query = query.gte("latest_risk_score", 40).lt("latest_risk_score", 70)
    } else if (riskFilter === "low") {
      query = query.lt("latest_risk_score", 40)
    }

    // 담당 선생님 필터
    if (teacherFilter) {
      query = query.eq("assigned_teacher_id", teacherFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error("[GET /api/students]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const teacherIds = rows.map((r) => r.assigned_teacher_id).filter(Boolean) as string[]
    const teacherMap = await fetchTeacherEmails(db, teacherIds)

    return NextResponse.json({ students: rows.map((r) => normalize(r, teacherMap.get(r.assigned_teacher_id) ?? null)) })
  } catch (err) {
    console.error("[GET /api/students]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── POST /api/students ────────────────────────────────────────────────────────
// Body: { name, grade?, school?, memo?, status?, assignedTeacherId? }
export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const academyId = profile!.academyId
    if (!academyId) {
      return NextResponse.json({ error: "학원 정보가 없습니다." }, { status: 400 })
    }

    const body = await req.json()
    const { name, grade, school, memo, status, assignedTeacherId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "학생 이름을 입력해주세요." }, { status: 400 })
    }

    const validStatuses = ["active", "inactive", "withdrawn", "prospect"]
    const studentStatus = validStatuses.includes(status) ? status : "active"

    const db = createSupabaseAdminClient()

    const insertData: Record<string, unknown> = {
      academy_id:  academyId,
      name:        name.trim(),
      grade:       grade?.trim() || null,
      school:      school?.trim() || null,
      memo:        memo?.trim() || null,
      status:      studentStatus,
      created_by:  profile!.id,
    }

    if (assignedTeacherId) {
      // 해당 선생님이 같은 학원 소속인지 검증
      const { data: teacher } = await db
        .from("profiles")
        .select("id")
        .eq("id", assignedTeacherId)
        .eq("academy_id", academyId)
        .eq("role", "teacher")
        .single()

      if (teacher) {
        insertData.assigned_teacher_id = assignedTeacherId
      }
    }

    const { data, error } = await db
      .from("students")
      .insert(insertData)
      .select("*")
      .single()

    if (error) {
      console.error("[POST /api/students]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 담당 선생님 이메일 별도 조회
    let teacherEmail: string | null = null
    if (data.assigned_teacher_id) {
      const teacherMap = await fetchTeacherEmails(db, [data.assigned_teacher_id])
      teacherEmail = teacherMap.get(data.assigned_teacher_id) ?? null
    }

    return NextResponse.json({ student: normalize(data, teacherEmail) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/students]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
