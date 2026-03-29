import { NextRequest, NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  isAdminUser,
  createSupabaseAdminClient,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { readKnowledge, addKnowledgeItem } from "@/lib/store"
import type { KnowledgeItem } from "@/lib/store"

// ── Unified admin auth check ────────────────────────────────────────────────
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

// ── Normalize Supabase row → KnowledgeItem ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(row: any): KnowledgeItem {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    priority: row.priority,
    tags: row.tags ?? [],
    situation: row.situation ?? undefined,
    response: row.response ?? undefined,
    outcome: row.outcome ?? undefined,
    createdAt: row.created_at,
  }
}

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()
    const { data, error } = await db
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: (data ?? []).map(normalize) })
  }

  return NextResponse.json({ items: readKnowledge() })
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  const body = await req.json()
  const { category, title, content, priority, tags, situation, response, outcome } = body

  if (!category || !title || !content || !priority) {
    return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 })
  }

  const parsedTags: string[] = Array.isArray(tags)
    ? tags
    : (typeof tags === "string" ? tags : "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()
    const { data, error } = await db
      .from("knowledge_base")
      .insert({
        category,
        title,
        content,
        priority,
        tags: parsedTags,
        situation: situation ?? null,
        response: response ?? null,
        outcome: outcome ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: normalize(data) }, { status: 201 })
  }

  const newItem = addKnowledgeItem({
    category,
    title,
    content,
    priority,
    tags: parsedTags,
    situation,
    response,
    outcome,
  })
  return NextResponse.json({ item: newItem }, { status: 201 })
}
