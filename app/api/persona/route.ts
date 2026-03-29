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
    const { data, error } = await db
      .from("persona_settings")
      .select("*")
      .eq("id", 1)
      .single()

    if (error) {
      // Row might not exist yet — return defaults
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
    const { data, error } = await db
      .from("persona_settings")
      .upsert({ id: 1, ...personaToDb(body) })
      .select()
      .single()

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(dbToPersona(data))
  }

  writePersona(body)
  return NextResponse.json(body)
}
