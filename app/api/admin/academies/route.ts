import { NextResponse } from "next/server"
import {
  getUserProfile,
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server"

// GET /api/admin/academies — 슈퍼 어드민 전용: 전체 학원 목록 + 통계
export async function GET() {
  try {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "슈퍼 어드민 권한이 필요합니다." }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
  }

  const db = createSupabaseAdminClient()

  // 전체 학원 목록
  const { data: academyRows, error: academyErr } = await db
    .from("academies")
    .select("id, name, code, owner_id, created_at")
    .order("created_at", { ascending: false })

  if (academyErr) {
    return NextResponse.json({ error: academyErr.message }, { status: 500 })
  }

  const rows = academyRows ?? []
  if (rows.length === 0) {
    return NextResponse.json({ academies: [] })
  }

  const academyIds = rows.map((r) => r.id)

  // 학원별 선생님 수
  const { data: teacherCounts } = await db
    .from("profiles")
    .select("academy_id")
    .in("academy_id", academyIds)
    .eq("role", "teacher")

  // 학원별 매뉴얼/사례 수
  const { data: knowledgeCounts } = await db
    .from("knowledge_base")
    .select("academy_id")
    .in("academy_id", academyIds)

  // 학원별 분석 로그 수
  const { data: logCounts } = await db
    .from("counseling_logs")
    .select("academy_id")
    .in("academy_id", academyIds)

  // 학원장 이메일 조회
  const ownerIds = rows.map((r) => r.owner_id).filter(Boolean) as string[]
  const { data: ownerProfiles } = ownerIds.length
    ? await db.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] }

  // 집계
  const teacherMap: Record<string, number> = {}
  const knowledgeMap: Record<string, number> = {}
  const logMap: Record<string, number> = {}
  const ownerMap: Record<string, string> = {}

  ;(teacherCounts ?? []).forEach((r) => {
    if (r.academy_id) teacherMap[r.academy_id] = (teacherMap[r.academy_id] ?? 0) + 1
  })
  ;(knowledgeCounts ?? []).forEach((r) => {
    if (r.academy_id) knowledgeMap[r.academy_id] = (knowledgeMap[r.academy_id] ?? 0) + 1
  })
  ;(logCounts ?? []).forEach((r) => {
    if (r.academy_id) logMap[r.academy_id] = (logMap[r.academy_id] ?? 0) + 1
  })
  ;(ownerProfiles ?? []).forEach((p) => {
    ownerMap[p.id] = p.email
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const academies = rows.map((a: any) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    owner_email: a.owner_id ? (ownerMap[a.owner_id] ?? null) : null,
    teacher_count: teacherMap[a.id] ?? 0,
    manual_count: knowledgeMap[a.id] ?? 0,
    log_count: logMap[a.id] ?? 0,
    created_at: a.created_at,
  }))

  return NextResponse.json({ academies })
  } catch (err) {
    console.error("[GET /api/admin/academies]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
