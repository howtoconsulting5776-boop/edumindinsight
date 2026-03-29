import { NextRequest, NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  createSupabaseAdminClient,
  getUserProfile,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { readKnowledge, addKnowledgeItem } from "@/lib/store"
import type { KnowledgeItem } from "@/lib/store"

// ── Auth: admin or director only ─────────────────────────────────────────
async function requireDirectorOrAdmin() {
  if (isSupabaseConfigured()) {
    const profile = await getUserProfile()
    if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), profile: null }
    }
    return { error: null, profile }
  }
  // Legacy cookie fallback
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), profile: null }
  }
  return { error: null, profile: null }
}

// ── Normalize Supabase row → KnowledgeItem ──────────────────────────────
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
  const { error: authError, profile } = await requireDirectorOrAdmin()
  if (authError) return authError

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()

    let query = db
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false })

    // Super-admin sees everything; director sees their academy + global items
    if (profile?.role === "director" && profile.academyId) {
      query = db
        .from("knowledge_base")
        .select("*")
        .or(`academy_id.eq.${profile.academyId},academy_id.is.null`)
        .order("created_at", { ascending: false })
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: (data ?? []).map(normalize) })
  }

  return NextResponse.json({ items: readKnowledge() })
}

export async function POST(req: NextRequest) {
  const { error: authError, profile } = await requireDirectorOrAdmin()
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

    // Progressively strip columns not present in the schema until the insert succeeds.
    // Some deployments may not have tags/situation/response/outcome columns.
    const isSchemaError = (e: { message?: string; code?: string }) =>
      e.message?.includes("schema cache") ||
      e.message?.includes("Could not find") ||
      e.code === "PGRST204"

    const attempts: Record<string, unknown>[] = [
      // Attempt 1 — all desired columns
      {
        category, title, content, priority,
        tags: parsedTags,
        situation: situation ?? null,
        response: response ?? null,
        outcome: outcome ?? null,
        academy_id: profile?.academyId ?? null,
      },
      // Attempt 2 — drop situation/response/outcome
      { category, title, content, priority, tags: parsedTags, academy_id: profile?.academyId ?? null },
      // Attempt 3 — drop tags too
      { category, title, content, priority, academy_id: profile?.academyId ?? null },
      // Attempt 4 — absolute minimum (no academy_id either, in case that's also missing)
      { category, title, content, priority },
    ]

    for (const insertData of attempts) {
      const { data, error } = await db
        .from("knowledge_base")
        .insert(insertData)
        .select()
        .single()
      if (!error) return NextResponse.json({ item: normalize(data) }, { status: 201 })
      if (!isSchemaError(error)) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      // schema error → try next attempt with fewer columns
    }

    return NextResponse.json({ error: "지식베이스 테이블 스키마가 맞지 않습니다. Supabase SQL Editor에서 supabase-schema-v2.sql을 실행해주세요." }, { status: 500 })
  }

  const newItem = addKnowledgeItem({ category, title, content, priority, tags: parsedTags, situation, response, outcome })
  return NextResponse.json({ item: newItem }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { error: authError, profile } = await requireDirectorOrAdmin()
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()

    // Directors can only delete their own academy's items
    let deleteQuery = db.from("knowledge_base").delete().eq("id", id)
    if (profile?.role === "director" && profile.academyId) {
      deleteQuery = db.from("knowledge_base").delete().eq("id", id).eq("academy_id", profile.academyId)
    }

    const { error } = await deleteQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true })
}
