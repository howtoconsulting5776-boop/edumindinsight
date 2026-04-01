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
function normalize(row: any, contentPreview = "") {
  return {
    id:               row.id,
    title:            row.title,
    content:          contentPreview,   // knowledge_chunks 첫 청크 미리보기
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
// 매뉴얼 소스 목록 (학원별 + 공용)
// Query: subject, priority, entry_type, search
export async function GET(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
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

    let query = db
      .from("manual_sources")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    // 학원 필터: 내 학원 항목 + 공용(academy_id IS NULL)
    if (academyId) {
      query = query.or(`academy_id.eq.${academyId},academy_id.is.null`)
    } else {
      query = query.is("academy_id", null)
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
// 텍스트 직접 입력으로 매뉴얼 등록
// Body: { title, content, priority, subject, tags }
export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
    }

    const academyId = profile!.academyId
    // admin은 academy_id=null로 전역 매뉴얼 등록 허용
    if (!academyId && profile!.role !== "admin") {
      return NextResponse.json({ error: "학원 정보가 없습니다." }, { status: 400 })
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

    // 2. knowledge_chunks 행 생성 (텍스트는 청크 1개)
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
      // 청크 실패 시 소스도 롤백
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
