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
function normalize(row: any) {
  return {
    id:          row.id,
    title:       row.title,
    priority:    row.priority,
    subject:     row.subject,
    tags:        row.tags ?? [],
    situation:   row.situation,
    response:    row.response,
    outcome:     row.outcome,
    outcomeType: row.outcome_type,
    riskScore:   row.risk_score ?? null,
    logId:       row.log_id ?? null,
    isActive:    row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

// ── GET /api/cases ────────────────────────────────────────────────────────────
// 모범 사례 목록 (학원별 + 공용)
// Query: subject, priority, outcome_type, search
export async function GET(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const subject     = searchParams.get("subject") ?? ""
    const priority    = searchParams.get("priority") ?? ""
    const outcomeType = searchParams.get("outcome_type") ?? ""
    const search      = searchParams.get("search") ?? ""

    const db = createSupabaseAdminClient()
    const academyId = profile!.academyId

    let query = db
      .from("counseling_cases")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (academyId) {
      query = query.or(`academy_id.eq.${academyId},academy_id.is.null`)
    } else {
      query = query.is("academy_id", null)
    }

    if (subject)     query = query.eq("subject", subject)
    if (priority)    query = query.eq("priority", priority)
    if (outcomeType) query = query.eq("outcome_type", outcomeType)
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`)

    const { data, error } = await query
    if (error) {
      console.error("[GET /api/cases]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cases: (data ?? []).map(normalize) })
  } catch (err) {
    console.error("[GET /api/cases]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── POST /api/cases ───────────────────────────────────────────────────────────
// 모범 사례 등록
// Body: { title, situation, response, outcome, priority, subject, tags, outcomeType, riskScore?, logId? }
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
    const { title, situation, response: resp, outcome, priority, subject, tags, outcomeType, riskScore, logId } = body

    if (!title?.trim() || !situation?.trim() || !resp?.trim() || !outcome?.trim()) {
      return NextResponse.json({
        error: "제목, 상황(situation), 대응(response), 결과(outcome)는 필수입니다.",
      }, { status: 400 })
    }

    const validPriorities   = ["high", "medium", "low"]
    const validSubjects     = ["general", "churn_risk", "complaint", "achievement", "fee", "schedule", "refund"]
    const validOutcomeTypes = ["success", "failure", "neutral"]

    const parsedTags: string[] = Array.isArray(tags)
      ? tags
      : (typeof tags === "string" ? tags : "").split(",").map((t: string) => t.trim()).filter(Boolean)

    const db = createSupabaseAdminClient()

    const { data, error } = await db
      .from("counseling_cases")
      .insert({
        academy_id:   academyId,
        title:        title.trim(),
        priority:     validPriorities.includes(priority) ? priority : "high",
        subject:      validSubjects.includes(subject) ? subject : "general",
        tags:         parsedTags,
        situation:    situation.trim(),
        response:     resp.trim(),
        outcome:      outcome.trim(),
        outcome_type: validOutcomeTypes.includes(outcomeType) ? outcomeType : "success",
        risk_score:   riskScore ?? null,
        log_id:       logId ?? null,
        is_active:    true,
        created_by:   profile!.id,
      })
      .select()
      .single()

    if (error) {
      console.error("[POST /api/cases]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ case: normalize(data) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/cases]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
