import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60 // Vercel 함수 최대 실행시간 60초 (PDF 처리/OCR 대응)
export const runtime = "nodejs"
import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  getUserProfile,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { addKnowledgeItem } from "@/lib/store"

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

  // 청크가 없으면 maxChunkSize 단위로 분할
  if (chunks.length === 0 && text.trim()) {
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize).trim())
    }
  }

  return chunks.filter(Boolean)
}

export async function POST(req: NextRequest) {
  try {
    const { error: authError, profile } = await requireDirectorOrAdmin()
    if (authError) return authError

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const priority = (formData.get("priority") as string) || "medium"
    const tags = (formData.get("tags") as string) || ""

    if (!file) {
      return NextResponse.json({ error: "PDF 파일을 선택해주세요." }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 })
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 50MB 이하여야 합니다." }, { status: 400 })
    }

    // PDF → Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 1단계: pdf-parse로 텍스트 추출 시도 (일반 PDF)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse")
    let rawText = ""
    let ocrUsed = false

    try {
      const parsed = await pdfParse(buffer)
      rawText = parsed.text ?? ""
    } catch {
      // pdf-parse 실패 시 OCR로 폴백
    }

    // 2단계: 텍스트가 너무 적으면 Gemini Vision OCR로 폴백 (스캔 PDF)
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

    const baseName = file.name.replace(/\.pdf$/i, "")
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
      fileName: file.name,
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
