import { NextRequest, NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ points: [] })
    }

    const academyId = profile.academyId
    if (!academyId) {
      return NextResponse.json({ points: [] })
    }

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId") ?? null
    const rawLimit  = parseInt(searchParams.get("limit") ?? "20", 10)
    const limit     = Math.min(Math.max(rawLimit, 1), 50)

    const db = createSupabaseAdminClient()

    let query = db
      .from("counseling_logs")
      .select("created_at, risk_score, positive_score, negative_score")
      .eq("academy_id", academyId)
      .not("risk_score", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (studentId && studentId !== "none") {
      query = query.eq("student_id", studentId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[GET /api/stats/scores]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const points = (data ?? []).map((row) => ({
      date:          new Date(row.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
      riskScore:     row.risk_score    ?? 0,
      positiveScore: row.positive_score ?? 0,
      negativeScore: row.negative_score ?? 0,
    }))

    return NextResponse.json({ points })
  } catch (err) {
    console.error("[GET /api/stats/scores]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
