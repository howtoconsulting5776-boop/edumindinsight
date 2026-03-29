"use client"

import { useEffect, useState } from "react"
import AdminSidebar from "./AdminSidebar"
import type { UserRole } from "@/lib/supabase/server"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("director")
  const [academyName, setAcademyName] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/role")
      .then((r) => r.json())
      .then((data) => {
        if (data.role) setRole(data.role as UserRole)
        if (data.academyName) setAcademyName(data.academyName)
        if (data.fullName) setFullName(data.fullName)
      })
      .catch(() => { /* 기본값 유지 */ })
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: "#F0EFFB" }}>
      <AdminSidebar role={role} academyName={academyName} fullName={fullName} />
      <main className="flex-1 md:ml-64 p-6 md:p-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
