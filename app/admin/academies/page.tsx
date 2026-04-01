"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  School01Icon,
  Group01Icon,
  Analytics01Icon,
  BookOpen01Icon,
  AlertDiamondIcon,
  ReloadIcon,
  Search01Icon,
  Crown02Icon,
} from "@hugeicons/core-free-icons"

function HIcon({
  icon, size = 20, primary = "currentColor", secondary = "currentColor",
}: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; size?: number; primary?: string; secondary?: string }) {
  return (
    <HugeiconsIcon icon={icon} size={size} color={primary} strokeWidth={1.8}
      style={{ "--tw-icon-secondary-color": secondary } as React.CSSProperties} />
  )
}

interface AcademyRow {
  id: string
  name: string
  code: string
  owner_email: string | null
  teacher_count: number
  manual_count: number
  log_count: number
  created_at: string
}

export default function AcademiesMonitorPage() {
  const [academies, setAcademies] = useState<AcademyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/admin/academies")
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setError(`서버 응답 오류 (HTTP ${res.status}). 잠시 후 다시 시도해주세요.`)
        return
      }
      if (!res.ok) { setError((data.error as string) ?? "데이터를 불러오는 중 오류가 발생했습니다."); return }
      setAcademies((data.academies as AcademyRow[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = academies.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#3E2D9B" }}>
            <HIcon icon={School01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">학원 전체 모니터링</h1>
            <p className="text-sm text-gray-500">슈퍼 어드민 전용 — 모든 학원의 현황을 확인합니다</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-all"
        >
          <HIcon icon={ReloadIcon} size={14} primary="#9CA3AF" secondary="#C4BEF0" />
          새로고침
        </button>
      </div>

      {/* 요약 카드 */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "전체 학원 수", value: academies.length, icon: School01Icon, color: "#3E2D9B" },
            {
              label: "전체 선생님 수",
              value: academies.reduce((s, a) => s + a.teacher_count, 0),
              icon: Group01Icon,
              color: "#7C3AED",
            },
            {
              label: "전체 분석 로그",
              value: academies.reduce((s, a) => s + a.log_count, 0),
              icon: Analytics01Icon,
              color: "#0EA5E9",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-6 shadow-xl shadow-slate-200/60">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: card.color + "1A" }}>
                <HIcon icon={card.icon} size={20} primary={card.color} secondary={card.color + "80"} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-red-50 border border-red-100">
          <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-4">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <HIcon icon={Search01Icon} size={16} primary="#9CA3AF" secondary="#C4BEF0" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학원 이름 또는 코드로 검색..."
          className="w-full pl-11 pr-4 h-12 rounded-lg border border-slate-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#3E2D9B] transition-all"
        />
      </div>

      {/* 학원 목록 */}
      <div className="bg-white rounded-xl shadow-xl shadow-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#3E2D9B]/20 border-t-[#3E2D9B] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F5F3FF" }}>
              <HIcon icon={School01Icon} size={26} primary="#3E2D9B" secondary="#C4BEF0" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {search ? "검색 결과가 없습니다." : "등록된 학원이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left text-xs font-semibold text-slate-500 px-6 py-4">학원</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-4">초대 코드</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-4">선생님</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-4">매뉴얼</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-4">분석 로그</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-4">개설일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((academy, i) => (
                  <tr key={academy.id}
                    className={`border-b border-slate-50 hover:bg-[#F5F3FF]/40 transition-colors ${
                      i === filtered.length - 1 ? "border-0" : ""
                    }`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#3E2D9B]/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-[#3E2D9B]">
                            {academy.name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{academy.name}</p>
                          {academy.owner_email && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <HIcon icon={Crown02Icon} size={11} primary="#F59E0B" secondary="#FDE68A" />
                              {academy.owner_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-sm font-bold text-[#3E2D9B] bg-[#F5F3FF] px-3 py-1 rounded-md tracking-wider">
                        {academy.code}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                        <HIcon icon={Group01Icon} size={14} primary="#7C3AED" secondary="#C4BEF0" />
                        {academy.teacher_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                        <HIcon icon={BookOpen01Icon} size={14} primary="#0EA5E9" secondary="#7DD3FC" />
                        {academy.manual_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                        <HIcon icon={Analytics01Icon} size={14} primary="#10B981" secondary="#A7F3D0" />
                        {academy.log_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs text-gray-400">
                        {new Date(academy.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
