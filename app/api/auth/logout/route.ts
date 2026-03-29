import { NextResponse } from "next/server"
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server"
import { clearSession } from "@/lib/auth"

export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } else {
    await clearSession()
  }
  return NextResponse.json({ ok: true })
}
