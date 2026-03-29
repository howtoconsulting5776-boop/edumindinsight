"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  DashboardCircleIcon,
  BookOpen01Icon,
  CheckmarkBadge01Icon,
  Settings01Icon,
  Logout01Icon,
  Menu01Icon,
  ArrowLeft01Icon,
  Home01Icon,
  Group01Icon,
  School01Icon,
  Crown02Icon,
} from "@hugeicons/core-free-icons"
import type { UserRole } from "@/lib/supabase/server"

function HIcon({
  icon,
  size = 20,
  primary = "currentColor",
  secondary = "currentColor",
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  size?: number
  primary?: string
  secondary?: string
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color={primary}
      strokeWidth={1.8}
      style={{ "--tw-icon-secondary-color": secondary } as React.CSSProperties}
    />
  )
}

// ── Role-aware nav items ────────────────────────────────────────────────────
function getNavItems(role: UserRole) {
  const common = [
    { href: "/admin",           label: "지식 대시보드",   icon: DashboardCircleIcon },
    { href: "/admin/manuals",   label: "상담 매뉴얼 관리", icon: BookOpen01Icon },
    { href: "/admin/cases",     label: "모범 사례 학습",   icon: CheckmarkBadge01Icon },
    { href: "/admin/persona",   label: "AI 페르소나 설정", icon: AiBrain01Icon },
    { href: "/admin/manage",    label: "선생님 관리",      icon: Group01Icon },
  ]

  if (role === "admin") {
    return [
      ...common,
      { href: "/admin/academies", label: "학원 전체 모니터링", icon: AiBrain01Icon },
    ]
  }

  return common
}

const roleLabel: Record<UserRole, { label: string; color: string }> = {
  admin:    { label: "슈퍼 어드민", color: "#F59E0B" },
  director: { label: "학원장",      color: "#10B981" },
  teacher:  { label: "선생님",      color: "#60A5FA" },
}

interface Props {
  role: UserRole
  academyName: string | null
  fullName: string | null
}

export default function AdminSidebar({ role, academyName, fullName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = getNavItems(role)
  const rl = roleLabel[role]

  async function handleLogout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + 역할 뱃지 */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
            <img src="/logo.png" alt="에듀마인 인사이트 로고" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-medium tracking-wider uppercase">
              {role === "admin" ? "Super Admin" : "Admin"}
            </p>
            <p className="text-white text-sm font-bold leading-none">에듀마인 인사이트</p>
          </div>
        </div>

        {/* 역할 + 학원 정보 */}
        <div className="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/15">
          <div className="flex items-center gap-1.5 mb-0.5">
            <HIcon
              icon={role === "admin" ? Crown02Icon : role === "director" ? School01Icon : Group01Icon}
              size={12}
              primary={rl.color}
              secondary={rl.color + "80"}
            />
            <span className="text-xs font-bold" style={{ color: rl.color }}>{rl.label}</span>
          </div>
          {(academyName || fullName) && (
            <p className="text-white/50 text-xs truncate">
              {academyName ?? fullName ?? ""}
            </p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all group ${
                isActive
                  ? "bg-white/15 text-white shadow-sm border border-white/10"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
              }`}
            >
              <HIcon
                icon={item.icon}
                size={18}
                primary={isActive ? "white" : "rgba(255,255,255,0.6)"}
                secondary={isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.3)"}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-1 border-t border-white/10 pt-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-all"
        >
          <HIcon icon={Home01Icon} size={18} primary="rgba(255,255,255,0.6)" secondary="rgba(255,255,255,0.3)" />
          분석 페이지로
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-white/60 hover:bg-red-500/15 hover:text-red-300 transition-all text-left"
        >
          <HIcon icon={Logout01Icon} size={18} primary="rgba(255,255,255,0.6)" secondary="rgba(255,255,255,0.3)" />
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col z-50"
        style={{ background: "linear-gradient(180deg, #2A1F7A 0%, #3E2D9B 100%)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile header + drawer */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 border-b border-white/10"
        style={{ background: "#3E2D9B" }}
      >
        <div className="flex items-center gap-2">
          <HIcon icon={AiBrain01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          <span className="text-white font-bold text-sm">에듀마인 Admin</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1" style={{ background: rl.color + "30", color: rl.color }}>
            {rl.label}
          </span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
        >
          <HIcon
            icon={open ? ArrowLeft01Icon : Menu01Icon}
            size={22}
            primary="white"
            secondary="rgba(255,255,255,0.5)"
          />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <aside
            className="md:hidden fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col"
            style={{ background: "linear-gradient(180deg, #2A1F7A 0%, #3E2D9B 100%)" }}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Mobile top spacer */}
      <div className="md:hidden h-16" />
    </>
  )
}
