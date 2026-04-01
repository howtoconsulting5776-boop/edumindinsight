"use client"

import { useEffect, useState } from "react"
import AdminSidebar from "./AdminSidebar"
import type { UserRole } from "@/lib/supabase/server"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("director")
  const [academyName, setAcademyName] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/role")
      .then((r) => r.json())
      .then((data) => {
        if (data.role) setRole(data.role as UserRole)
        if (data.academyName) setAcademyName(data.academyName)
        if (data.displayName) setDisplayName(data.displayName)
      })
      .catch(() => { /* 기본값 유지 */ })
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: "#F0EFFB" }}>
      <AdminSidebar role={role} academyName={academyName} fullName={displayName} />
      <main className="flex-1 md:ml-64 px-4 pb-10 pt-20 md:px-10 md:pb-10 md:pt-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
