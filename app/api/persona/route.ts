import { NextRequest, NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  isAdminUser,
  createSupabaseAdminClient,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { readPersona, writePersona } from "@/lib/store"
import type { PersonaSettings } from "@/lib/store"

async function requireAdmin(): Promise<NextResponse | null> {
  if (isSupabaseConfigured()) {
    const ok = await isAdminUser()
    if (!ok)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return null
  }
  const session = await getSession()
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return null
}

// ── camelCase ↔ snake_case helpers ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToPersona(row: any): PersonaSettings {
  return {
    tone: row.tone,
    empathyLevel: row.empathy_level,
    formality: row.formality,
    customInstructions: row.custom_instructions ?? "",
  }
}

function personaToDb(p: PersonaSettings) {
  return {
    tone: p.tone,
    empathy_level: p.empathyLevel,
    formality: p.formality,
    custom_instructions: p.customInstructions,
    updated_at: new Date().toISOString(),
  }
}

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()
    // v3: academy_id IS NULL = 전역 기본 페르소나
    const { data, error } = await db
      .from("persona_settings")
      .select("*")
      .is("academy_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(readPersona())
    }
    return NextResponse.json(dbToPersona(data))
  }

  return NextResponse.json(readPersona())
}

export async function PUT(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  const body: PersonaSettings = await req.json()

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()

    // 기존 전역 페르소나 행 조회 (academy_id IS NULL)
    const { data: existing } = await db
      .from("persona_settings")
      .select("id")
      .is("academy_id", null)
      .limit(1)
      .maybeSingle()

    let result
    if (existing?.id) {
      // 기존 행 업데이트
      const { data, error } = await db
        .from("persona_settings")
        .update(personaToDb(body))
        .eq("id", existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      // 행이 없으면 새로 삽입 (academy_id = NULL = 전역)
      const { data, error } = await db
        .from("persona_settings")
        .insert({ ...personaToDb(body), academy_id: null })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(dbToPersona(result))
  }

  writePersona(body)
  return NextResponse.json(body)
}
