import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  getUserProfile,
} from "@/lib/supabase/server"

export const maxDuration = 60
export const runtime = "nodejs"

// ── 파일 타입 헬퍼 ───────────────────────────────────────────────────────────
const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif",
}

function getImageMediaType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return IMAGE_TYPES[ext] ?? null
}

// ── Gemini Vision: 이미지 → 내용 분석 ───────────────────────────────────────
async function analyzeImageWithGemini(imageBase64: string, mediaType: string, fileName: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.")
  const googleAI = createGoogleGenerativeAI({ apiKey })
  const { text } = await generateText({
    model: googleAI("gemini-2.0-flash"),
    maxOutputTokens: 4096,
    messages: [{
      role: "user",
      content: [
        { type: "image", image: imageBase64, mediaType: mediaType as "image/jpeg" },
        { type: "text", text: `이 이미지(파일명: ${fileName})를 분석하여 학원 상담 AI가 참고할 수 있도록 상세한 설명을 작성해주세요:\n1. 이미지에 있는 모든 텍스트를 그대로 옮겨 적어주세요.\n2. 전체적인 내용과 맥락을 설명해주세요.\n3. 학원 운영, 상담, 학부모 대응 관련 정보를 특히 자세히 기술해주세요.\n추가 설명 없이 분석 결과만 출력해주세요.` },
      ],
    }],
  })
  return text ?? ""
}

// ── Gemini OCR: PDF → 텍스트 추출 ───────────────────────────────────────────
async function ocrWithGemini(pdfBase64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.")
  const googleAI = createGoogleGenerativeAI({ apiKey })
  const { text } = await generateText({
    model: googleAI("gemini-2.0-flash"),
    maxOutputTokens: 8192,
    messages: [{
      role: "user",
      content: [
        { type: "file", data: pdfBase64, mediaType: "application/pdf" },
        { type: "text", text: "이 PDF의 모든 텍스트를 빠짐없이 그대로 추출해주세요. 표, 목록, 제목 구조를 유지하고, 추가 설명 없이 원문만 출력해주세요." },
      ],
    }],
  })
  return text ?? ""
}

// ── 텍스트 청킹 (최대 2000자, 단락 기준) ────────────────────────────────────
function chunkText(text: string, maxSize = 2000): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""
  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxSize && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + "\n\n" + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  // 단락 분리 안 되는 긴 텍스트 처리
  if (chunks.length === 0 && text.trim()) {
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize).trim())
    }
  }
  return chunks.filter(Boolean)
}

async function requireDirectorOrAdmin() {
  if (isSupabaseConfigured()) {
    const profile = await getUserProfile()
    if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
      return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }), profile: null }
    }
    return { error: null, profile }
  }
  return { error: NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 }), profile: null }
}

// ── POST /api/manuals/upload ──────────────────────────────────────────────────
// 경로 A: multipart (소용량)
// 경로 B: JSON { storagePath } (Supabase Storage 경유, 대용량)
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
      return NextResponse.json({ error: "학원 정보가 없습니다. 학원을 먼저 등록하거나 학원 코드로 합류해주세요." }, { status: 400 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let buffer: Buffer
    let fileName: string
    let priority = "medium"
    let subject  = "general"
    let tags     = ""
    let storagePath: string | null = null
    let fileType: "pdf" | "image" = "pdf"

    if (contentType.includes("application/json")) {
      // ── 경로 B: Supabase Storage 경유 ────────────────────────────────────
      const body = await req.json()
      const { storagePath: sp, originalName, priority: p, subject: s, tags: t, bucket } = body

      if (!sp) return NextResponse.json({ error: "storagePath가 필요합니다." }, { status: 400 })

      priority    = p ?? "medium"
      subject     = s ?? "general"
      tags        = t ?? ""
      fileName    = originalName ?? sp.split("/").pop() ?? "file"
      storagePath = sp

      const bucketName = bucket ?? "pdf-uploads"
      const db = createSupabaseAdminClient()
      const { data, error: dlErr } = await db.storage.from(bucketName).download(sp)
      if (dlErr || !data) {
        return NextResponse.json({ error: `Storage에서 파일을 불러올 수 없습니다: ${dlErr?.message}` }, { status: 500 })
      }
      buffer = Buffer.from(await data.arrayBuffer())
      fileType = getImageMediaType(fileName) ? "image" : "pdf"

    } else {
      // ── 경로 A: multipart 직접 업로드 ────────────────────────────────────
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      priority = (formData.get("priority") as string) || "medium"
      subject  = (formData.get("subject")  as string) || "general"
      tags     = (formData.get("tags")     as string) || ""

      if (!file) return NextResponse.json({ error: "파일을 선택해주세요." }, { status: 400 })

      fileName = file.name
      const imgType = getImageMediaType(fileName)
      const isPdf   = fileName.toLowerCase().endsWith(".pdf")

      if (!isPdf && !imgType) {
        return NextResponse.json({ error: "PDF 또는 이미지 파일(JPG, PNG, WebP, GIF)만 업로드 가능합니다." }, { status: 400 })
      }

      fileType = imgType ? "image" : "pdf"
      buffer   = Buffer.from(await file.arrayBuffer())
    }

    // ── 텍스트 추출 ──────────────────────────────────────────────────────────
    let rawText = ""
    let ocrUsed = false

    if (fileType === "image") {
      const imgMediaType = getImageMediaType(fileName) ?? "image/jpeg"
      rawText = await analyzeImageWithGemini(buffer.toString("base64"), imgMediaType, fileName)
      ocrUsed = true
    } else {
      // pdf-parse 먼저 시도
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse")
        const parsed   = await pdfParse(buffer)
        rawText = parsed.text ?? ""
      } catch { /* OCR 폴백 */ }

      if (rawText.trim().length < 100) {
        rawText = await ocrWithGemini(buffer.toString("base64"))
        ocrUsed = true
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "파일에서 내용을 추출할 수 없습니다." }, { status: 400 })
    }

    // ── DB 저장 ───────────────────────────────────────────────────────────────
    const extRegex   = /\.(pdf|jpe?g|png|webp|gif|heic|heif)$/i
    const baseName   = fileName.replace(extRegex, "")
    const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean)
    if (fileType === "image" && !parsedTags.includes("이미지")) parsedTags.push("이미지")
    if (fileType === "pdf"   && !parsedTags.includes("PDF"))   parsedTags.push("PDF")

    const validPriorities = ["critical", "high", "medium", "low"]
    const validSubjects   = ["general", "churn_risk", "complaint", "achievement", "fee", "schedule", "refund"]
    const safeP = validPriorities.includes(priority) ? priority : "medium"
    const safeS = validSubjects.includes(subject)    ? subject  : "general"

    const chunks      = chunkText(rawText)
    const db          = createSupabaseAdminClient()

    // 1. manual_sources 생성
    const { data: source, error: sourceError } = await db
      .from("manual_sources")
      .insert({
        academy_id:        academyId,
        title:             baseName,
        priority:          safeP,
        subject:           safeS,
        tags:              parsedTags,
        entry_type:        fileType,
        original_filename: fileName,
        storage_path:      storagePath,
        file_size_bytes:   buffer.byteLength,
        ocr_used:          ocrUsed,
        total_characters:  rawText.length,
        total_chunks:      chunks.length,
        is_active:         true,
        created_by:        profile!.id,
      })
      .select()
      .single()

    if (sourceError || !source) {
      console.error("[POST /api/manuals/upload] source:", sourceError)
      return NextResponse.json({ error: sourceError?.message ?? "소스 저장 실패" }, { status: 500 })
    }

    // 2. knowledge_chunks 일괄 생성
    const chunkRows = chunks.map((content, idx) => ({
      source_id:   source.id,
      academy_id:  academyId,
      chunk_index: idx,
      content,
      priority:    safeP,
      subject:     safeS,
      tags:        parsedTags,
    }))

    const { error: chunkError } = await db.from("knowledge_chunks").insert(chunkRows)

    if (chunkError) {
      // 청크 실패 시 소스 롤백
      await db.from("manual_sources").delete().eq("id", source.id)
      console.error("[POST /api/manuals/upload] chunks:", chunkError)
      return NextResponse.json({ error: chunkError.message }, { status: 500 })
    }

    // Supabase Storage 임시 파일 삭제 (경로 B의 경우)
    if (storagePath) {
      await db.storage.from("pdf-uploads").remove([storagePath]).catch(() => {})
    }

    return NextResponse.json({
      success:    true,
      manualId:   source.id,
      title:      baseName,
      fileType,
      fileName,
      chunks:     chunks.length,
      characters: rawText.length,
      ocrUsed,
    })
  } catch (err) {
    console.error("[POST /api/manuals/upload]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
