import { NextResponse } from "next/server"
import { getUserProfile } from "@/lib/supabase/server"

// Returns the full profile of the currently authenticated Supabase user.
export async function GET() {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ isAdmin: false, role: null, user: null }, { status: 401 })
  }
  return NextResponse.json({
    isAdmin: profile.role === "admin",
    role: profile.role,
    email: profile.email,
    academyId: profile.academyId,
    academyName: profile.academyName,
    academyCode: profile.academyCode,
    fullName: profile.fullName,
  })
}
