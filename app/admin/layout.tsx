import AdminSidebar from "./AdminSidebar"
import { getUserProfile } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/supabase/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fetch profile server-side so the sidebar has role info without client fetches
  const profile = await getUserProfile()
  const role: UserRole = profile?.role ?? "director"

  return (
    <div className="flex min-h-screen" style={{ background: "#F0EFFB" }}>
      <AdminSidebar
        role={role}
        academyName={profile?.academyName ?? null}
        fullName={profile?.fullName ?? null}
      />
      <main className="flex-1 md:ml-64 p-6 md:p-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
