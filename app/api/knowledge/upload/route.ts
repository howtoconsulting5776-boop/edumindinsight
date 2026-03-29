import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  getUserProfile,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { addKnowledgeItem } from "@/lib/store"

export const maxDuration = 60
export const runtime = "nodejs"

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
}

function getImageMediaType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return IMAGE_TYPES[ext] ?? null
}

// Gemini Vision: 이미지 → 상세 설명 추출
async function analyzeImageWithGemini(
  imageBase64: string,
  mediaType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.")

  const googleAI = createGoogleGenerativeAI({ apiKey })

  const { text } = await generateText({
    model: googleAI("gemini-2.0-flash"),
    maxOutputTokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: imageBase64,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mediaType: mediaType as any,
          },
          {
            type: "text",
            text: `이 이미지(파일명: ${fileName})를 분석하여 학원 상담 AI가 참고할 수 있도록 다음을 포함한 상세한 설명을 작성해주세요:
1. 이미지에 있는 모든 텍스트(표, 공지, 안내문 등)를 그대로 옮겨 적어주세요.
2. 이미지의 전체적인 내용과 맥락을 설명해주세요.
3. 학원 운영, 상담, 학부모 대응에 관련된 정보가 있다면 특히 자세히 기술해주세요.
추가 설명 없이 분석 결과만 출력해주세요.`,
          },
        ],
      },
    ],
  })

  return text ?? ""
}

// Gemini Vision OCR: 스캔 PDF → 텍스트 추출
async function ocrWithGemini(pdfBase64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.")

  const googleAI = createGoogleGenerativeAI({ apiKey })

  const { text } = await generateText({
    model: googleAI("gemini-2.0-flash"),
    maxOutputTokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: pdfBase64,
            mediaType: "application/pdf",
          },
          {
            type: "text",
            text: "이 PDF 문서의 모든 텍스트를 빠짐없이 그대로 추출해주세요. 표, 목록, 제목 등의 구조를 최대한 유지하고, 추가 설명이나 요약 없이 원문 텍스트만 출력해주세요.",
          },
        ],
      },
    ],
  })

  return text ?? ""
}

async function requireDirectorOrAdmin() {
  if (isSupabaseConfigured()) {
    const profile = await getUserProfile()
    if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), profile: null }
    }
    return { error: null, profile }
  }
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), profile: null }
  }
  return { error: null, profile: null }
}

// 텍스트를 지식 항목으로 분할 (최대 2000자 청크)
function chunkText(text: string, maxChunkSize = 2000): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChunkSize && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + "\n\n" + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  if (chunks.length === 0 && text.trim()) {
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize).trim())
    }
  }

  return chunks.filter(Boolean)
}

async function saveToKnowledgeBase(
  chunks: string[],
  baseName: string,
  priority: string,
  parsedTags: string[],
  profile: { academyId: string | null } | null,
  isSupabase: boolean
): Promise<string[]> {
  const createdItems: string[] = []

  if (isSupabase) {
    const db = createSupabaseAdminClient()

    const isTableMissing = (e: { message?: string; code?: string }) =>
      e.code === "42P01" ||
      e.message?.includes("does not exist") ||
      e.message?.includes("relation") ||
      e.message?.includes("undefined_table")

    const isSchemaErr = (e: { message?: string; code?: string }) =>
      e.message?.includes("schema cache") ||
      e.message?.includes("Could not find") ||
      e.code === "PGRST204"

    for (let i = 0; i < chunks.length; i++) {
      const title = chunks.length === 1 ? baseName : `${baseName} (${i + 1}/${chunks.length})`
      const base = { category: "manual", title, content: chunks[i], priority }

      // Try with optional columns first, fall back to minimal columns
      const attempts = [
        { ...base, tags: parsedTags, academy_id: profile?.academyId ?? null },
        { ...base, academy_id: profile?.academyId ?? null },
        base,
      ]

      let saved = false
      for (const insertData of attempts) {
        const { data, error } = await db
          .from("knowledge_base")
          .insert(insertData)
          .select("id")
          .single()
        if (!error && data) { createdItems.push(data.id); saved = true; break }
        if (error) {
          if (isTableMissing(error)) throw new Error("DB_SETUP_NEEDED") // 테이블 자체 없음
          if (!isSchemaErr(error)) break // 다른 실제 오류 → 더 시도 불필요
        }
      }
      if (!saved && i === 0) break // 첫 청크 저장 실패시 나머지 청크도 포기
    }
  } else {
    for (let i = 0; i < chunks.length; i++) {
      const title = chunks.length === 1 ? baseName : `${baseName} (${i + 1}/${chunks.length})`
      const item = addKnowledgeItem({
        category: "manual",
        title,
        content: chunks[i],
        priority: priority as "low" | "medium" | "high",
        tags: parsedTags,
      })
      createdItems.push(item.id)
    }
  }

  return createdItems
}

// ── POST: JSON { storagePath } (Supabase Storage 경유) 또는 multipart ──────
export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    const contentType = req.headers.get("content-type") ?? ""

    let buffer: Buffer
    let fileName: string
    let priority = "medium"
    let tags = ""
    let fileType: "pdf" | "image" = "pdf"

    if (contentType.includes("application/json")) {
      // ── 경로 A: Supabase Storage 경유 (대용량 파일) ──────────────────────
      const body = await req.json()
      const { storagePath, originalName, priority: p, tags: t, bucket } = body

      if (!storagePath) {
        return NextResponse.json({ error: "storagePath가 필요합니다." }, { status: 400 })
      }

      priority = p ?? "medium"
      tags = t ?? ""
      fileName = originalName ?? storagePath.split("/").pop() ?? "file"

      const bucketName = bucket ?? "pdf-uploads"
      const db = createSupabaseAdminClient()
      const { data, error: dlErr } = await db.storage.from(bucketName).download(storagePath)

      if (dlErr || !data) {
        return NextResponse.json({ error: `Storage에서 파일을 불러올 수 없습니다: ${dlErr?.message}` }, { status: 500 })
      }

      buffer = Buffer.from(await data.arrayBuffer())
      await db.storage.from(bucketName).remove([storagePath])

      // 파일 타입 판별
      const imgType = getImageMediaType(fileName)
      fileType = imgType ? "image" : "pdf"

    } else {
      // ── 경로 B: 직접 multipart 업로드 (소형 파일) ────────────────────────
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      priority = (formData.get("priority") as string) || "medium"
      tags = (formData.get("tags") as string) || ""

      if (!file) {
        return NextResponse.json({ error: "파일을 선택해주세요." }, { status: 400 })
      }

      fileName = file.name
      const imgType = getImageMediaType(fileName)
      const isPdf = fileName.toLowerCase().endsWith(".pdf")

      if (!isPdf && !imgType) {
        return NextResponse.json({ error: "PDF 또는 이미지 파일(JPG, PNG, WebP, GIF)만 업로드 가능합니다." }, { status: 400 })
      }

      fileType = imgType ? "image" : "pdf"
      buffer = Buffer.from(await file.arrayBuffer())
    }

    // ── 텍스트 / 설명 추출 ────────────────────────────────────────────────
    let rawText = ""
    let ocrUsed = false

    if (fileType === "image") {
      // 이미지 → Gemini Vision으로 내용 분석
      const imgMediaType = getImageMediaType(fileName) ?? "image/jpeg"
      const imageBase64 = buffer.toString("base64")
      try {
        rawText = await analyzeImageWithGemini(imageBase64, imgMediaType, fileName)
        ocrUsed = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : "이미지 분석 실패"
        return NextResponse.json({ error: `이미지 분석에 실패했습니다: ${msg}` }, { status: 500 })
      }
    } else {
      // PDF → pdf-parse 먼저, 부족하면 Gemini OCR
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse")
      try {
        const parsed = await pdfParse(buffer)
        rawText = parsed.text ?? ""
      } catch { /* OCR 폴백 */ }

      if (rawText.trim().length < 100) {
        try {
          rawText = await ocrWithGemini(buffer.toString("base64"))
          ocrUsed = true
        } catch (ocrErr) {
          const ocrMsg = ocrErr instanceof Error ? ocrErr.message : "OCR 실패"
          return NextResponse.json({ error: `텍스트 추출 실패 (OCR 오류: ${ocrMsg})` }, { status: 500 })
        }
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "파일에서 내용을 추출할 수 없습니다." }, { status: 400 })
    }

    // ── 지식베이스 저장 ───────────────────────────────────────────────────
    const extRegex = /\.(pdf|jpe?g|png|webp|gif|heic|heif)$/i
    const baseName = fileName.replace(extRegex, "")
    const parsedTags: string[] = tags.split(",").map((t) => t.trim()).filter(Boolean)

    if (fileType === "image") {
      if (!parsedTags.includes("이미지")) parsedTags.push("이미지")
    } else {
      if (!parsedTags.includes("PDF")) parsedTags.push("PDF")
    }

    const chunks = chunkText(rawText)
    const createdItems = await saveToKnowledgeBase(
      chunks, baseName, priority, parsedTags, profile, isSupabaseConfigured()
    )

    return NextResponse.json({
      success: true,
      fileType,
      fileName,
      chunks: chunks.length,
      characters: rawText.length,
      ocrUsed,
      ids: createdItems,
    })
  } catch (err) {
    console.error("[POST /api/knowledge/upload]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    if (msg === "DB_SETUP_NEEDED") {
      return NextResponse.json({ error: "DB_SETUP_NEEDED" }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
