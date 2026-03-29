import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

function generateCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// GET /api/academies?code=XXXXXXXX — 초대 코드로 학원 검색
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: "code 파라미터가 필요합니다." }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
  }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from("academies")
    .select("id, name, code")
    .eq("code", code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "해당 코드의 학원을 찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json({ academy: { id: data.id, name: data.name, code: data.code } })
}

// POST /api/academies — 새 학원 생성 (학원장 가입 시)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const name: string = (body.name ?? "").trim()

  if (!name) {
    return NextResponse.json({ error: "학원 이름을 입력해주세요." }, { status: 400 })
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "학원 이름은 50자 이하로 입력해주세요." }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 })
  }

  const db = createSupabaseAdminClient()

  // Generate a unique code — retry up to 5 times
  let code = ""
  for (let i = 0; i < 5; i++) {
    const candidate = generateCode()
    const { data: existing } = await db
      .from("academies")
      .select("id")
      .eq("code", candidate)
      .single()
    if (!existing) {
      code = candidate
      break
    }
  }
  if (!code) {
    return NextResponse.json({ error: "초대 코드 생성에 실패했습니다. 다시 시도해주세요." }, { status: 500 })
  }

  const { data, error } = await db
    .from("academies")
    .insert({ name, code })
    .select("id, name, code")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "학원 생성에 실패했습니다." }, { status: 500 })
  }

  return NextResponse.json({ academy: { id: data.id, name: data.name, code: data.code } }, { status: 201 })
}
