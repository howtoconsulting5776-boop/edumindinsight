import { NextRequest, NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  isAdminUser,
  createSupabaseAdminClient,
} from "@/lib/supabase/server"
import { getSession } from "@/lib/auth"
import { deleteKnowledgeItem } from "@/lib/store"

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id } = await params

  if (isSupabaseConfigured()) {
    const db = createSupabaseAdminClient()
    const { error } = await db.from("knowledge_base").delete().eq("id", id)
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const deleted = deleteKnowledgeItem(id)
  if (!deleted)
    return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
