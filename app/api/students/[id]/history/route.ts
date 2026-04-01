import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

async function requireAuth() {
  const profile = await getUserProfile()
  if (!profile) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }), profile: null }
  }
  return { error: null, profile }
}

// ── GET /api/students/[id]/history ────────────────────────────────────────────
// 학생의 상담 이력 목록 (최신순)
// Query params:
//   limit  = 페이지당 건수 (default: 10)
//   offset = 건너뛸 건수  (default: 0)
//   contact_type = student | father | mother | guardian | other | all
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id: studentId } = await params
    const { searchParams } = new URL(req.url)
    const limit       = Math.min(parseInt(searchParams.get("limit")  ?? "10"), 50)
    const offset      = Math.max(parseInt(searchParams.get("offset") ?? "0"),  0)
    const contactType = searchParams.get("contact_type") ?? "all"

    const academyId = profile!.academyId
    if (!academyId) {
      return NextResponse.json({ error: "학원 정보가 없습니다." }, { status: 400 })
    }

    const db = createSupabaseAdminClient()

    // 학생 정보 조회 + 권한 확인 (같은 학원 소속인지)
    const { data: student, error: studentError } = await db
      .from("students")
      .select("id, name, grade, school, status, latest_risk_score, last_contacted_at, assigned_teacher_id")
      .eq("id", studentId)
      .eq("academy_id", academyId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 })
    }

    // 선생님은 담당 학생 또는 미배정 학생의 이력만 조회 가능
    if (
      profile!.role === "teacher" &&
      student.assigned_teacher_id !== null &&
      student.assigned_teacher_id !== profile!.id
    ) {
      return NextResponse.json({ error: "담당 학생의 이력만 조회할 수 있습니다." }, { status: 403 })
    }

    // 상담 이력 조회 (profiles 조인 제거 — analyzed_by는 auth.users FK라 PostgREST 직접 조인 불가)
    // academy_id 필터: 학생 소속은 이미 위에서 확인했으므로 student_id가 primary key.
    // 이전에 academy_id = null 로 저장된 로그도 포함하기 위해 OR 조건 사용.
    let logsQuery = db
      .from("counseling_logs")
      .select(`
        id,
        contact_type,
        analysis_mode,
        risk_score,
        positive_score,
        negative_score,
        keywords,
        original_text,
        history_summary,
        history_used,
        history_count,
        analyzed_by,
        created_at
      `, { count: "exact" })
      .eq("student_id", studentId)
      .or(`academy_id.eq.${academyId},academy_id.is.null`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (contactType !== "all") {
      logsQuery = logsQuery.eq("contact_type", contactType)
    }

    // 선생님은 본인이 분석한 이력만 조회
    if (profile!.role === "teacher") {
      logsQuery = logsQuery.eq("analyzed_by", profile!.id)
    }

    const { data: logs, error: logsError, count } = await logsQuery

    if (logsError) {
      console.error("[GET /api/students/[id]/history]", logsError)
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    // 대상 유형별 통계
    const { data: statRows } = await db
      .from("counseling_logs")
      .select("contact_type, risk_score")
      .eq("student_id", studentId)
      .or(`academy_id.eq.${academyId},academy_id.is.null`)

    const contactStats: Record<string, number> = {}
    let avgRisk = 0
    let maxRisk = 0

    if (statRows && statRows.length > 0) {
      for (const row of statRows) {
        contactStats[row.contact_type] = (contactStats[row.contact_type] ?? 0) + 1
        if (row.risk_score != null) {
          avgRisk += row.risk_score
          if (row.risk_score > maxRisk) maxRisk = row.risk_score
        }
      }
      avgRisk = Math.round(avgRisk / statRows.length)
    }

    return NextResponse.json({
      student: {
        id:               student.id,
        name:             student.name,
        grade:            student.grade ?? null,
        school:           student.school ?? null,
        status:           student.status,
        latestRiskScore:  student.latest_risk_score ?? 0,
        lastContactedAt:  student.last_contacted_at ?? null,
      },
      logs: (logs ?? []).map((log) => ({
        id:             log.id,
        contactType:    log.contact_type,
        analysisMode:   log.analysis_mode,
        riskScore:      log.risk_score ?? null,
        positiveScore:  log.positive_score ?? null,
        negativeScore:  log.negative_score ?? null,
        keywords:       log.keywords ?? [],
        originalText:   log.original_text ?? null,
        historySummary: log.history_summary ?? null,
        historyUsed:    log.history_used,
        historyCount:   log.history_count,
        createdAt:      log.created_at,
      })),
      pagination: {
        total:  count ?? 0,
        limit,
        offset,
        hasMore: (count ?? 0) > offset + limit,
      },
      stats: {
        totalSessions: count ?? 0,
        avgRiskScore:  avgRisk,
        maxRiskScore:  maxRisk,
        byContactType: contactStats,
      },
    })
  } catch (err) {
    console.error("[GET /api/students/[id]/history]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
