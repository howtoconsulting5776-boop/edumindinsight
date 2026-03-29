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
} from "@hugeicons/core-free-icons"

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

const navItems = [
  { href: "/admin", label: "지식 대시보드", icon: DashboardCircleIcon },
  { href: "/admin/manuals", label: "상담 매뉴얼 관리", icon: BookOpen01Icon },
  { href: "/admin/cases", label: "모범 사례 학습", icon: CheckmarkBadge01Icon },
  { href: "/admin/persona", label: "AI 페르소나 설정", icon: AiBrain01Icon },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
            <HIcon icon={AiBrain01Icon} size={18} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-medium tracking-wider uppercase">Admin</p>
            <p className="text-white text-sm font-bold leading-none">에듀마인 인사이트</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
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
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
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
