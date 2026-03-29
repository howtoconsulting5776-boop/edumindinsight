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

    // Build insert object — only include optional columns if they exist in the schema
    // (situation/response/outcome may not be present in older schema deployments)
    const insertData: Record<string, unknown> = {
      category,
      title,
      content,
      priority,
      tags: parsedTags,
      academy_id: profile?.academyId ?? null,
    }
    if (situation != null) insertData.situation = situation
    if (response  != null) insertData.response  = response
    if (outcome   != null) insertData.outcome   = outcome

    const { data, error } = await db
      .from("knowledge_base")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Column not found → retry without optional columns
      if (error.message?.includes("schema cache") || error.code === "PGRST204") {
        const { data: data2, error: error2 } = await db
          .from("knowledge_base")
          .insert({ category, title, content, priority, tags: parsedTags, academy_id: profile?.academyId ?? null })
          .select()
          .single()
        if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
        return NextResponse.json({ item: normalize(data2) }, { status: 201 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ item: normalize(data) }, { status: 201 })
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
