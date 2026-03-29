import AdminSidebar from "./AdminSidebar"
import { getUserProfile } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/supabase/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let role: UserRole = "director"
  let academyName: string | null = null
  let fullName: string | null = null

  try {
    const profile = await getUserProfile()
    role = profile?.role ?? "director"
    academyName = profile?.academyName ?? null
    fullName = profile?.fullName ?? null
  } catch {
    // Supabase 연결 실패 시 기본값으로 렌더링
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F0EFFB" }}>
      <AdminSidebar role={role} academyName={academyName} fullName={fullName} />
      <main className="flex-1 md:ml-64 p-6 md:p-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
