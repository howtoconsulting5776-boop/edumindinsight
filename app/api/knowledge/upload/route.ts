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

// PDF 텍스트를 지식 항목으로 분할 (최대 2000자 청크)
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

// ── POST: multipart (소형) 또는 JSON { storagePath } (Supabase Storage 경유) ──
export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    const contentType = req.headers.get("content-type") ?? ""

    let buffer: Buffer
    let fileName: string
    let priority = "medium"
    let tags = ""

    if (contentType.includes("application/json")) {
      // ── 경로 2: 클라이언트가 Supabase Storage에 업로드 후 경로를 전달 ──
      const body = await req.json()
      const { storagePath, originalName, priority: p, tags: t } = body

      if (!storagePath) {
        return NextResponse.json({ error: "storagePath가 필요합니다." }, { status: 400 })
      }

      priority = p ?? "medium"
      tags = t ?? ""
      fileName = originalName ?? storagePath.split("/").pop() ?? "document.pdf"

      const db = createSupabaseAdminClient()
      const { data, error: dlErr } = await db.storage
        .from("pdf-uploads")
        .download(storagePath)

      if (dlErr || !data) {
        return NextResponse.json({ error: `Storage에서 파일을 불러올 수 없습니다: ${dlErr?.message}` }, { status: 500 })
      }

      buffer = Buffer.from(await data.arrayBuffer())

      // 처리 완료 후 Storage에서 파일 삭제 (공간 절약)
      await db.storage.from("pdf-uploads").remove([storagePath])

    } else {
      // ── 경로 1: 직접 multipart 업로드 (소형 파일, 개발 환경용) ──
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      priority = (formData.get("priority") as string) || "medium"
      tags = (formData.get("tags") as string) || ""

      if (!file) {
        return NextResponse.json({ error: "PDF 파일을 선택해주세요." }, { status: 400 })
      }
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 })
      }

      fileName = file.name
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    // ── 텍스트 추출 ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse")
    let rawText = ""
    let ocrUsed = false

    try {
      const parsed = await pdfParse(buffer)
      rawText = parsed.text ?? ""
    } catch {
      // pdf-parse 실패 시 OCR 폴백
    }

    if (rawText.trim().length < 100) {
      try {
        const pdfBase64 = buffer.toString("base64")
        rawText = await ocrWithGemini(pdfBase64)
        ocrUsed = true
      } catch (ocrErr) {
        const ocrMsg = ocrErr instanceof Error ? ocrErr.message : "OCR 실패"
        return NextResponse.json(
          { error: `텍스트 추출에 실패했습니다. (OCR 오류: ${ocrMsg})` },
          { status: 500 }
        )
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "PDF에서 텍스트를 추출할 수 없습니다." }, { status: 400 })
    }

    // ── 지식베이스 저장 ───────────────────────────────────────────────────────
    const baseName = fileName.replace(/\.pdf$/i, "")
    const parsedTags: string[] = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    if (!parsedTags.includes("PDF")) parsedTags.push("PDF")

    const chunks = chunkText(rawText)
    const createdItems: string[] = []

    if (isSupabaseConfigured()) {
      const db = createSupabaseAdminClient()
      for (let i = 0; i < chunks.length; i++) {
        const title = chunks.length === 1
          ? baseName
          : `${baseName} (${i + 1}/${chunks.length})`
        const { data, error } = await db.from("knowledge_base").insert({
          category: "manual",
          title,
          content: chunks[i],
          priority,
          tags: parsedTags,
          academy_id: profile?.academyId ?? null,
        }).select("id").single()
        if (!error && data) createdItems.push(data.id)
      }
    } else {
      for (let i = 0; i < chunks.length; i++) {
        const title = chunks.length === 1
          ? baseName
          : `${baseName} (${i + 1}/${chunks.length})`
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

    return NextResponse.json({
      success: true,
      fileName,
      chunks: chunks.length,
      characters: rawText.length,
      ocrUsed,
      ids: createdItems,
    })
  } catch (err) {
    console.error("[POST /api/knowledge/upload]", err)
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
