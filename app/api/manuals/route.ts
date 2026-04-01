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
function normalize(row: any, contentPreview = "") {
  return {
    id:               row.id,
    title:            row.title,
    content:          contentPreview,
    priority:         row.priority,
    subject:          row.subject,
    tags:             row.tags ?? [],
    entryType:        row.entry_type,
    originalFilename: row.original_filename ?? null,
    fileSizeBytes:    row.file_size_bytes ?? null,
    ocrUsed:          row.ocr_used ?? false,
    totalCharacters:  row.total_characters ?? 0,
    chunkCount:       row.total_chunks ?? 1,
    isActive:         row.is_active,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

// ── GET /api/manuals ──────────────────────────────────────────────────────────
// 모든 로그인 사용자: 자신이 만든 것 + 자신의 학원 것
export async function GET(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const subject    = searchParams.get("subject") ?? ""
    const priority   = searchParams.get("priority") ?? ""
    const entryType  = searchParams.get("entry_type") ?? ""
    const search     = searchParams.get("search") ?? ""

    const db = createSupabaseAdminClient()
    const academyId = profile!.academyId
    const userId    = profile!.id

    let query = db
      .from("manual_sources")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    // 자신이 만든 것 + 자신의 학원 것 (학원 없으면 자신이 만든 것만)
    if (academyId) {
      query = query.or(`academy_id.eq.${academyId},created_by.eq.${userId}`)
    } else {
      query = query.eq("created_by", userId)
    }

    if (subject)   query = query.eq("subject", subject)
    if (priority)  query = query.eq("priority", priority)
    if (entryType) query = query.eq("entry_type", entryType)
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`)

    const { data, error } = await query
    if (error) {
      console.error("[GET /api/manuals]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // knowledge_chunks에서 첫 번째 청크 내용 조회 (목록 미리보기용)
    const sourceIds = (data ?? []).map((r) => r.id as string)
    const contentMap: Record<string, string> = {}
    if (sourceIds.length > 0) {
      const { data: chunks } = await db
        .from("knowledge_chunks")
        .select("source_id, content")
        .in("source_id", sourceIds)
        .eq("chunk_index", 0)
      for (const c of chunks ?? []) {
        if (c.source_id) contentMap[c.source_id as string] = (c.content as string) ?? ""
      }
    }

    return NextResponse.json({
      manuals: (data ?? []).map((row) => normalize(row, contentMap[row.id as string] ?? "")),
    })
  } catch (err) {
    console.error("[GET /api/manuals]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── POST /api/manuals ─────────────────────────────────────────────────────────
// 모든 로그인 사용자가 매뉴얼 등록 가능
export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireAuth()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const body = await req.json()
    const { title, content, priority, subject, tags } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 })
    }

    const validPriorities = ["critical", "high", "medium", "low"]
    const validSubjects   = ["general", "churn_risk", "complaint", "achievement", "fee", "schedule", "refund"]

    const parsedTags: string[] = Array.isArray(tags)
      ? tags
      : (typeof tags === "string" ? tags : "").split(",").map((t: string) => t.trim()).filter(Boolean)

    const db = createSupabaseAdminClient()
    const academyId = profile!.academyId  // null이어도 OK

    // 1. manual_sources 행 생성
    const { data: source, error: sourceError } = await db
      .from("manual_sources")
      .insert({
        academy_id:       academyId,
        title:            title.trim(),
        priority:         validPriorities.includes(priority) ? priority : "medium",
        subject:          validSubjects.includes(subject) ? subject : "general",
        tags:             parsedTags,
        entry_type:       "text",
        total_characters: content.trim().length,
        total_chunks:     1,
        is_active:        true,
        created_by:       profile!.id,
      })
      .select()
      .single()

    if (sourceError || !source) {
      console.error("[POST /api/manuals] source insert error:", sourceError)
      return NextResponse.json({ error: sourceError?.message ?? "저장 실패" }, { status: 500 })
    }

    // 2. knowledge_chunks 행 생성
    const { error: chunkError } = await db
      .from("knowledge_chunks")
      .insert({
        source_id:   source.id,
        academy_id:  academyId,
        chunk_index: 0,
        content:     content.trim(),
        priority:    source.priority,
        subject:     source.subject,
        tags:        parsedTags,
      })

    if (chunkError) {
      await db.from("manual_sources").delete().eq("id", source.id)
      console.error("[POST /api/manuals] chunk insert error:", chunkError)
      return NextResponse.json({ error: chunkError.message }, { status: 500 })
    }

    return NextResponse.json({ manual: normalize(source) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/manuals]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
