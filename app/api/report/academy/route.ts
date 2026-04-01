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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 90)

    const now    = new Date()
    const fromDt = new Date(now)
    fromDt.setDate(fromDt.getDate() - days)
    const fromIso = fromDt.toISOString()

    const db = createSupabaseAdminClient()

    // ── 1. 전체 학생 조회 ──────────────────────────────────────────────────
    const { data: students } = await db
      .from("students")
      .select("id, name, grade, school, status, latest_risk_score, last_contacted_at, assigned_teacher_id")
      .eq("academy_id", academyId)

    const allStudents = students ?? []

    // 상태별 분포
    const statusStats = { active: 0, prospect: 0, inactive: 0, withdrawn: 0 }
    for (const s of allStudents) {
      const k = s.status as keyof typeof statusStats
      if (k in statusStats) statusStats[k]++
    }

    // 위험도별 분류 (active 학생만)
    const activeStudents = allStudents.filter((s) => s.status === "active")
    const highRisk   = activeStudents.filter((s) => (s.latest_risk_score ?? 0) >= 70)
    const mediumRisk = activeStudents.filter((s) => {
      const score = s.latest_risk_score ?? 0
      return score >= 40 && score < 70
    })

    // 장기 미상담: active + 30일 이상 상담 없음 (또는 한 번도 없음)
    const longAbsent = activeStudents.filter((s) => {
      if (!s.last_contacted_at) return true
      const diffDays = Math.floor((now.getTime() - new Date(s.last_contacted_at).getTime()) / 86400000)
      return diffDays >= 30
    })

    // ── 2. 기간 내 상담 로그 조회 ─────────────────────────────────────────
    const { data: logs } = await db
      .from("counseling_logs")
      .select("id, student_id, risk_score, positive_score, negative_score, keywords, contact_type, analyzed_by, created_at")
      .eq("academy_id", academyId)
      .gte("created_at", fromIso)
      .order("created_at", { ascending: true })

    const allLogs = logs ?? []

    // 요약 통계
    const avgRiskScore = allLogs.length > 0
      ? Math.round(allLogs.reduce((s, l) => s + (l.risk_score ?? 0), 0) / allLogs.length)
      : 0

    // ── 3. 날짜별 상담 추이 ───────────────────────────────────────────────
    const trendMap = new Map<string, { count: number; riskSum: number }>()
    for (const log of allLogs) {
      const date = new Date(log.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
      const cur  = trendMap.get(date) ?? { count: 0, riskSum: 0 }
      trendMap.set(date, { count: cur.count + 1, riskSum: cur.riskSum + (log.risk_score ?? 0) })
    }
    const trend = [...trendMap.entries()].map(([date, v]) => ({
      date,
      count:   v.count,
      avgRisk: Math.round(v.riskSum / v.count),
    }))

    // ── 4. 키워드 빈도 집계 ───────────────────────────────────────────────
    // PII 비식별화 플레이스홀더 및 의미 없는 범용 단어 제외
    const EXCLUDED_KEYWORDS = new Set([
      // 비식별화 플레이스홀더
      "OO", "oo", "○○", "XX", "xx", "□□", "△△",
      // 역할어 (모든 상담에 등장해 변별력 없음)
      "해당", "학생", "학부모", "학부모님", "선생님", "강사님", "원장님", "강사",
      // 서비스 자체 단어 (모든 상담이 학원 관련이므로 의미 없음)
      "학원", "상담", "수업", "교육", "학습",
      // 너무 짧은 단어 (1자)
    ])
    const kwFreq = new Map<string, number>()
    for (const log of allLogs) {
      for (const kw of (log.keywords as string[]) ?? []) {
        const trimmed = kw.trim()
        if (!trimmed || trimmed.length <= 1 || EXCLUDED_KEYWORDS.has(trimmed)) continue
        kwFreq.set(trimmed, (kwFreq.get(trimmed) ?? 0) + 1)
      }
    }
    const keywords = [...kwFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }))

    // ── 5. 상담 대상별 통계 ───────────────────────────────────────────────
    const contactTypeStats: Record<string, number> = {}
    for (const log of allLogs) {
      const ct = log.contact_type ?? "unknown"
      contactTypeStats[ct] = (contactTypeStats[ct] ?? 0) + 1
    }

    // ── 6. 선생님별 통계 ──────────────────────────────────────────────────
    const teacherLogMap  = new Map<string, { sessions: number; riskSum: number; studentIds: Set<string> }>()
    for (const log of allLogs) {
      if (!log.analyzed_by) continue
      const cur = teacherLogMap.get(log.analyzed_by) ?? { sessions: 0, riskSum: 0, studentIds: new Set() }
      cur.sessions++
      cur.riskSum += log.risk_score ?? 0
      if (log.student_id) cur.studentIds.add(log.student_id)
      teacherLogMap.set(log.analyzed_by, cur)
    }

    // 선생님 이메일 조회
    const teacherIds = [...teacherLogMap.keys()]
    let teacherEmailMap = new Map<string, string>()
    if (teacherIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, email")
        .in("id", teacherIds)
      for (const p of profiles ?? []) teacherEmailMap.set(p.id, p.email ?? "")
    }

    const teacherStats = [...teacherLogMap.entries()].map(([id, v]) => ({
      teacherId:    id,
      email:        teacherEmailMap.get(id) ?? id.slice(0, 8) + "...",
      sessionCount: v.sessions,
      studentCount: v.studentIds.size,
      avgRisk:      v.sessions > 0 ? Math.round(v.riskSum / v.sessions) : 0,
    })).sort((a, b) => b.sessionCount - a.sessionCount)

    // ── 7. 고위험/주의 학생 상세 (위험도 추이 포함) ───────────────────────
    const riskStudentIds = [
      ...highRisk.map((s) => s.id),
      ...mediumRisk.map((s) => s.id),
    ]

    // 각 위험 학생의 최근 2건 로그 조회
    let recentLogsPerStudent: Map<string, { riskScore: number; keywords: string[]; contactType: string }[]> = new Map()
    if (riskStudentIds.length > 0) {
      const { data: recentLogs } = await db
        .from("counseling_logs")
        .select("student_id, risk_score, keywords, contact_type, created_at")
        .in("student_id", riskStudentIds)
        .or(`academy_id.eq.${academyId},academy_id.is.null`)
        .order("created_at", { ascending: false })

      for (const log of recentLogs ?? []) {
        if (!log.student_id) continue
        const arr = recentLogsPerStudent.get(log.student_id) ?? []
        if (arr.length < 2) {
          arr.push({ riskScore: log.risk_score ?? 0, keywords: log.keywords ?? [], contactType: log.contact_type ?? "" })
          recentLogsPerStudent.set(log.student_id, arr)
        }
      }
    }

    function buildRiskStudentList(list: typeof allStudents) {
      return list.map((s) => {
        const logs2 = recentLogsPerStudent.get(s.id) ?? []
        const latest = logs2[0]
        const prev   = logs2[1]
        let trend: "상승" | "하락" | "유지" | "첫기록" = "첫기록"
        if (latest && prev) {
          if (latest.riskScore > prev.riskScore) trend = "상승"
          else if (latest.riskScore < prev.riskScore) trend = "하락"
          else trend = "유지"
        } else if (latest) {
          trend = "첫기록"
        }
        const daysAgo = s.last_contacted_at
          ? Math.floor((now.getTime() - new Date(s.last_contacted_at).getTime()) / 86400000)
          : null
        return {
          id:              s.id,
          name:            s.name,
          grade:           s.grade ?? null,
          school:          s.school ?? null,
          riskScore:       s.latest_risk_score ?? 0,
          lastContactedAt: s.last_contacted_at ?? null,
          daysAgo,
          riskTrend:       trend,
          recentKeywords:  latest?.keywords?.slice(0, 5) ?? [],
          recentContactType: latest?.contactType ?? null,
        }
      }).sort((a, b) => b.riskScore - a.riskScore)
    }

    return NextResponse.json({
      period: { from: fromIso, to: now.toISOString(), days },
      summary: {
        totalStudents:    activeStudents.length,
        thisMonthSessions: allLogs.length,
        avgRiskScore,
        highRiskCount:    highRisk.length,
        longAbsentCount:  longAbsent.length,
      },
      riskStudents: {
        high:        buildRiskStudentList(highRisk),
        medium:      buildRiskStudentList(mediumRisk),
        longAbsent:  buildRiskStudentList(longAbsent),
      },
      trend,
      keywords,
      contactTypeStats,
      studentStatusStats: statusStats,
      teacherStats,
    })
  } catch (err) {
    console.error("[GET /api/report/academy]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
