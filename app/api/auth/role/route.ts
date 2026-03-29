import { NextResponse } from "next/server"
import { getSupabaseUser } from "@/lib/supabase/server"

// Returns the admin/user role of the currently authenticated Supabase user.
export async function GET() {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ isAdmin: false, user: null }, { status: 401 })
  }
  const adminEmail = process.env.ADMIN_EMAIL ?? ""
  const isAdmin = user.email === adminEmail
  return NextResponse.json({ isAdmin, email: user.email })
}
