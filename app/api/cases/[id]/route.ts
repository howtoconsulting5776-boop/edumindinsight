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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canAccess(row: any, profile: { id: string; academyId: string | null; role: string }) {
  if (profile.role === "admin") return true
  if (row.created_by === profile.id) return true
  if (profile.academyId && row.academy_id === profile.academyId) return true
  return false
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

// ── GET /api/cases/[id] ───────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const db = createSupabaseAdminClient()

    const { data, error } = await db
      .from("counseling_cases")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "사례를 찾을 수 없습니다." }, { status: 404 })
    }

    if (!canAccess(data, profile!)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    return NextResponse.json({ case: normalize(data) })
  } catch (err) {
    console.error("[GET /api/cases/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── PATCH /api/cases/[id] ─────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const db = createSupabaseAdminClient()

    const { data: existing } = await db
      .from("counseling_cases")
      .select("id, academy_id, created_by")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "사례를 찾을 수 없습니다." }, { status: 404 })
    }

    if (!canAccess(existing, profile!)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    const body = await req.json()
    const { title, situation, response: resp, outcome, priority, subject, tags, outcomeType, riskScore } = body

    const validPriorities   = ["high", "medium", "low"]
    const validSubjects     = ["general", "churn_risk", "complaint", "achievement", "fee", "schedule", "refund"]
    const validOutcomeTypes = ["success", "failure", "neutral"]

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title       !== undefined) updateData.title        = title.trim()
    if (situation   !== undefined) updateData.situation    = situation.trim()
    if (resp        !== undefined) updateData.response     = resp.trim()
    if (outcome     !== undefined) updateData.outcome      = outcome.trim()
    if (riskScore   !== undefined) updateData.risk_score   = riskScore
    if (priority    !== undefined && validPriorities.includes(priority))     updateData.priority     = priority
    if (subject     !== undefined && validSubjects.includes(subject))        updateData.subject      = subject
    if (outcomeType !== undefined && validOutcomeTypes.includes(outcomeType)) updateData.outcome_type = outcomeType
    if (tags        !== undefined) {
      updateData.tags = Array.isArray(tags)
        ? tags
        : String(tags).split(",").map((t: string) => t.trim()).filter(Boolean)
    }

    const { data, error } = await db
      .from("counseling_cases")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[PATCH /api/cases/[id]]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ case: normalize(data) })
  } catch (err) {
    console.error("[PATCH /api/cases/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── DELETE /api/cases/[id] ────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { id } = await params
    const db = createSupabaseAdminClient()

    const { data: existing } = await db
      .from("counseling_cases")
      .select("id, academy_id, created_by, title")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "사례를 찾을 수 없습니다." }, { status: 404 })
    }

    if (!canAccess(existing, profile!)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    let hard = false
    try {
      const body = await req.json()
      hard = body?.hard === true && profile!.role === "admin"
    } catch { /* 소프트 삭제로 처리 */ }

    if (hard) {
      const { error } = await db.from("counseling_cases").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: true })
    }

    const { error } = await db
      .from("counseling_cases")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("[DELETE /api/cases/[id]]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, title: existing.title })
  } catch (err) {
    console.error("[DELETE /api/cases/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
