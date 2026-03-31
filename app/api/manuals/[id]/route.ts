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

// ── GET /api/manuals/[id] ─────────────────────────────────────────────────────
// 소스 상세 + 청크 목록
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

    const { data: source, error: sourceError } = await db
      .from("manual_sources")
      .select("*")
      .eq("id", id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: "매뉴얼을 찾을 수 없습니다." }, { status: 404 })
    }

    // 소속 학원 또는 공용 항목인지 확인
    if (source.academy_id !== null && source.academy_id !== profile!.academyId) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    // 청크 목록
    const { data: chunks } = await db
      .from("knowledge_chunks")
      .select("id, chunk_index, content, created_at")
      .eq("source_id", id)
      .order("chunk_index", { ascending: true })

    return NextResponse.json({
      manual: {
        id:               source.id,
        title:            source.title,
        priority:         source.priority,
        subject:          source.subject,
        tags:             source.tags ?? [],
        entryType:        source.entry_type,
        originalFilename: source.original_filename ?? null,
        fileSizeBytes:    source.file_size_bytes ?? null,
        ocrUsed:          source.ocr_used ?? false,
        totalCharacters:  source.total_characters ?? 0,
        totalChunks:      source.total_chunks ?? 1,
        isActive:         source.is_active,
        createdAt:        source.created_at,
        updatedAt:        source.updated_at,
      },
      chunks: (chunks ?? []).map((c) => ({
        id:         c.id,
        chunkIndex: c.chunk_index,
        content:    c.content,
        createdAt:  c.created_at,
      })),
    })
  } catch (err) {
    console.error("[GET /api/manuals/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── PATCH /api/manuals/[id] ───────────────────────────────────────────────────
// 메타데이터 수정 (title, priority, subject, tags)
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
    const db = createSupabaseAdminClient()

    const { data: existing } = await db
      .from("manual_sources")
      .select("id, academy_id")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "매뉴얼을 찾을 수 없습니다." }, { status: 404 })
    }

    if (existing.academy_id !== null && existing.academy_id !== profile!.academyId) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    const body = await req.json()
    const { title, priority, subject, tags } = body

    const validPriorities = ["critical", "high", "medium", "low"]
    const validSubjects   = ["general", "churn_risk", "complaint", "achievement", "fee", "schedule", "refund"]

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title    !== undefined) updateData.title    = title.trim()
    if (priority !== undefined && validPriorities.includes(priority)) updateData.priority = priority
    if (subject  !== undefined && validSubjects.includes(subject))    updateData.subject  = subject
    if (tags     !== undefined) {
      updateData.tags = Array.isArray(tags)
        ? tags
        : String(tags).split(",").map((t: string) => t.trim()).filter(Boolean)
    }

    const { data, error } = await db
      .from("manual_sources")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 청크의 priority/subject/tags도 동기화
    await db
      .from("knowledge_chunks")
      .update({
        priority: updateData.priority ?? data.priority,
        subject:  updateData.subject  ?? data.subject,
        tags:     updateData.tags     ?? data.tags,
      })
      .eq("source_id", id)

    return NextResponse.json({ manual: data })
  } catch (err) {
    console.error("[PATCH /api/manuals/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ── DELETE /api/manuals/[id] ──────────────────────────────────────────────────
// 소스 삭제 → knowledge_chunks CASCADE 자동 삭제
export async function DELETE(
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

    const { data: existing } = await db
      .from("manual_sources")
      .select("id, academy_id, title, storage_path, total_chunks")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "매뉴얼을 찾을 수 없습니다." }, { status: 404 })
    }

    if (existing.academy_id !== null && existing.academy_id !== profile!.academyId) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    // Supabase Storage 파일 삭제 (파일 업로드 항목인 경우)
    if (existing.storage_path) {
      try {
        await db.storage.from("pdf-uploads").remove([existing.storage_path])
      } catch { /* 스토리지 삭제 실패는 무시 */ }
    }

    // manual_sources 삭제 → knowledge_chunks CASCADE 자동 삭제
    const { error } = await db.from("manual_sources").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/manuals/[id]]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      title: existing.title,
      chunksRemoved: existing.total_chunks ?? 0,
    })
  } catch (err) {
    console.error("[DELETE /api/manuals/[id]]", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
