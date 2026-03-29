"use client"

import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Database01Icon,
  BookOpen01Icon,
  CheckmarkBadge01Icon,
  AiBrain01Icon,
  ArrowRight01Icon,
  Clock01Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"

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

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
  color,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  label: string
  value: number | string
  sub: string
  href: string
  color: string
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 hover:shadow-2xl hover:-translate-y-1 transition-all group"
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: color + "1A" }}
        >
          <HIcon icon={icon} size={22} primary={color} secondary={color + "80"} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <HIcon icon={ArrowRight01Icon} size={18} primary="#9CA3AF" secondary="#C4BEF0" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </Link>
  )
}

interface KnowledgeItem {
  id: string
  category: string
  title: string
  content: string
  priority: string
  tags: string[]
  createdAt: string
}

export default function AdminDashboard() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [logsCount, setLogsCount] = useState(0)
  const [toneLabel, setToneLabel] = useState("공감형")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/knowledge")
        if (res.ok) {
          const data = await res.json()
          setItems(data.items ?? [])
        }
      } catch { /* ignore */ }

      try {
        const res = await fetch("/api/persona")
        if (res.ok) {
          const data = await res.json()
          const map: Record<string, string> = { empathetic: "공감형", logical: "논리형", assertive: "단호형" }
          setToneLabel(map[data.tone] ?? "공감형")
        }
      } catch { /* ignore */ }

      setLoading(false)
    }
    load()
  }, [])

  const manuals = items.filter((i) => i.category === "manual")
  const cases   = items.filter((i) => i.category === "case")
  const highPriority = items.filter((i) => i.priority === "high")

  const recentItems = [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#3E2D9B" }}>
            <HIcon icon={Analytics01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">지식 대시보드</h1>
            <p className="text-sm text-gray-500">지식베이스 현황을 한눈에 확인하세요</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard icon={Database01Icon}        label="전체 지식 항목"    value={loading ? "…" : items.length}   sub="학습된 총 데이터"    href="/admin/manuals" color="#3E2D9B" />
        <StatCard icon={BookOpen01Icon}         label="학원 운영 매뉴얼"  value={loading ? "…" : manuals.length} sub="Hard Rules 등록"    href="/admin/manuals" color="#7C3AED" />
        <StatCard icon={CheckmarkBadge01Icon}   label="모범 사례"         value={loading ? "…" : cases.length}   sub="성공 경험 학습"     href="/admin/cases"   color="#0EA5E9" />
        <StatCard icon={AiBrain01Icon}          label="분석 로그"         value={loading ? "…" : logsCount}      sub={`페르소나: ${toneLabel}`} href="/admin/persona" color="#10B981" />
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent items */}
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <HIcon icon={Clock01Icon} size={20} primary="#3E2D9B" secondary="#C4BEF0" />
              <h2 className="text-lg font-bold text-gray-900">최근 등록 항목</h2>
            </div>
            <Link href="/admin/manuals" className="text-xs font-medium text-[#3E2D9B] hover:underline">전체 보기</Link>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
          ) : recentItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">등록된 지식 항목이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {recentItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: item.category === "manual" ? "#7C3AED1A" : "#0EA5E91A" }}>
                    <HIcon
                      icon={item.category === "manual" ? BookOpen01Icon : CheckmarkBadge01Icon}
                      size={14}
                      primary={item.category === "manual" ? "#7C3AED" : "#0EA5E9"}
                      secondary={item.category === "manual" ? "#A78BFA" : "#7DD3FC"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.category === "manual" ? "매뉴얼" : "사례"} ·{" "}
                      <span className={item.priority === "high" ? "text-red-500" : item.priority === "medium" ? "text-amber-500" : "text-gray-400"}>
                        {item.priority === "high" ? "높음" : item.priority === "medium" ? "보통" : "낮음"}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60">
          <div className="flex items-center gap-2 mb-6">
            <HIcon icon={Analytics01Icon} size={20} primary="#3E2D9B" secondary="#C4BEF0" />
            <h2 className="text-lg font-bold text-gray-900">우선순위 현황</h2>
          </div>

          <div className="space-y-4">
            {[
              { label: "높음 (High)",  count: highPriority.length,                              color: "#EF4444", bg: "#FEF2F2" },
              { label: "보통 (Medium)", count: items.filter((i) => i.priority === "medium").length, color: "#F59E0B", bg: "#FFFBEB" },
              { label: "낮음 (Low)",   count: items.filter((i) => i.priority === "low").length,    color: "#6B7280", bg: "#F9FAFB" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4">
                <div className="px-3 py-1.5 rounded-xl text-xs font-semibold min-w-[110px]"
                  style={{ color: row.color, background: row.bg }}>
                  {row.label}
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: items.length > 0 ? `${(row.count / items.length) * 100}%` : "0%", background: row.color }} />
                </div>
                <span className="text-sm font-bold text-gray-700 w-6 text-right">{row.count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl border border-purple-100" style={{ background: "#F5F3FF" }}>
            <p className="text-xs text-purple-600 leading-relaxed">
              {highPriority.length}개의 고우선순위 항목이 AI 분석에 우선 반영됩니다.
              현재 페르소나: <strong>{toneLabel}</strong> 모드
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
