"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserGroupIcon,
  PlusSignIcon,
  Delete01Icon,
  Search01Icon,
  AlertDiamondIcon,
  CheckmarkCircle01Icon,
  UserIcon,
  FilterIcon,
  ChartHistogramIcon,
  Calendar01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

interface Student {
  id: string
  name: string
  grade?: string
  school?: string
  status: "active" | "inactive" | "prospect" | "withdrawn"
  latestRiskScore?: number
  lastContactedAt?: string
  counselingCount?: number
  assignedTeacherId?: string
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "재원 중", color: "#10B981", bg: "#F0FDF4" },
  prospect:  { label: "상담 중", color: "#F59E0B", bg: "#FFFBEB" },
  inactive:  { label: "휴원", color: "#6B7280", bg: "#F9FAFB" },
  withdrawn: { label: "퇴원", color: "#EF4444", bg: "#FEF2F2" },
}

function riskColor(score: number | undefined): string {
  if (score == null) return "#D1D5DB"
  if (score >= 70) return "#EF4444"
  if (score >= 40) return "#F59E0B"
  return "#10B981"
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState("")
  const [search, setSearch]     = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterRisk, setFilterRisk]     = useState<string>("all")

  // 신규 등록 폼
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState("")
  const [formName, setFormName]     = useState("")
  const [formGrade, setFormGrade]   = useState("")
  const [formSchool, setFormSchool] = useState("")
  const [formStatus, setFormStatus] = useState<Student["status"]>("active")

  // 상담 이력 모달
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [historyItems, setHistoryItems]     = useState<any[]>([])
  const [historyStats, setHistoryStats]     = useState<{ avgRiskScore?: number; maxRiskScore?: number; totalSessions?: number } | null>(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (filterRisk !== "all") params.set("risk", filterRisk)
      if (search.trim()) params.set("search", search.trim())
      const res  = await fetch(`/api/students?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "데이터를 불러오는 데 실패했습니다."); return }
      setStudents(data.students ?? [])
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterRisk, search])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)
    try {
      const res  = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, grade: formGrade, school: formSchool, status: formStatus }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? "등록에 실패했습니다."); return }
      setFormName(""); setFormGrade(""); setFormSchool(""); setFormStatus("active")
      setShowForm(false); fetchStudents()
    } catch {
      setFormError("등록 중 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} 학생을 퇴원 처리하시겠습니까?`)) return
    await fetch(`/api/students/${id}`, { method: "DELETE" })
    fetchStudents()
  }

  async function openHistory(s: Student) {
    setHistoryStudent(s)
    setHistoryLoading(true)
    setHistoryItems([])
    setHistoryStats(null)
    try {
      const res  = await fetch(`/api/students/${s.id}/history?limit=20`)
      const data = await res.json()
      if (!res.ok) {
        console.error("[openHistory] API error:", data.error)
        return
      }
      setHistoryItems(data.logs ?? [])
      setHistoryStats(data.stats ?? null)
    } catch (err) {
      console.error("[openHistory] fetch error:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const contactLabel: Record<string, string> = {
    student: "학생", father: "아버지", mother: "어머니", guardian: "보호자", other: "기타",
  }

  return (
    <>
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#3E2D9B" }}>
            <HIcon icon={UserGroupIcon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">학생 관리</h1>
            <p className="text-xs text-gray-500 leading-snug">학생별 상담 이력과 위험도 확인</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-2xl shadow-md flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white shrink-0"
          style={{ background: "#3E2D9B" }}
        >
          <HIcon icon={PlusSignIcon} size={16} primary="white" secondary="rgba(255,255,255,0.5)" />
          학생 등록
        </Button>
      </div>

      {/* 신규 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-8 border border-purple-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <HIcon icon={PlusSignIcon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
            새 학생 등록
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">이름 *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="홍길동"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">학년</Label>
                <Input
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  placeholder="예: 중3, 고1"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">학교</Label>
                <Input
                  value={formSchool}
                  onChange={(e) => setFormSchool(e.target.value)}
                  placeholder="예: 서울중학교"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">상태</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as Student["status"])}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:border-[#3E2D9B]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="active" className="rounded-xl">재원 중</SelectItem>
                    <SelectItem value="prospect" className="rounded-xl">상담 중</SelectItem>
                    <SelectItem value="inactive" className="rounded-xl">휴원</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
                <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
                <span className="text-red-600 text-sm">{formError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={submitting} className="flex-1 h-11 rounded-2xl font-semibold" style={{ background: "#3E2D9B" }}>
                {submitting ? "등록 중..." : "등록하기"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormError("") }} className="flex-1 h-11 rounded-2xl font-semibold border-slate-200">
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 검색 · 필터 */}
      <div className="bg-white rounded-3xl p-5 shadow-xl shadow-slate-200/60 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <HIcon icon={Search01Icon} size={16} primary="#9CA3AF" secondary="#C4BEF0" />
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 학교로 검색..."
            className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <HIcon icon={FilterIcon} size={14} primary="#9CA3AF" secondary="#C4BEF0" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 w-32">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="rounded-xl">전체 상태</SelectItem>
                <SelectItem value="active" className="rounded-xl">재원 중</SelectItem>
                <SelectItem value="prospect" className="rounded-xl">상담 중</SelectItem>
                <SelectItem value="inactive" className="rounded-xl">휴원</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 w-32">
              <SelectValue placeholder="위험도" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="rounded-xl">전체 위험도</SelectItem>
              <SelectItem value="high" className="rounded-xl">🔴 고위험</SelectItem>
              <SelectItem value="medium" className="rounded-xl">🟡 중위험</SelectItem>
              <SelectItem value="low" className="rounded-xl">🟢 저위험</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-100 mb-5">
          <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}

      {/* 학생 목록 */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-xl shadow-slate-200/60">
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/60">
            <HIcon icon={UserGroupIcon} size={36} primary="#C4BEF0" secondary="#E9E7F8" />
            <p className="text-gray-500 font-medium mt-4">등록된 학생이 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">위 버튼을 눌러 첫 번째 학생을 등록해보세요.</p>
          </div>
        ) : (
          students.map((s) => {
            const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.inactive
            return (
              <div key={s.id} className="bg-white rounded-3xl p-4 shadow-xl shadow-slate-200/60">
                {/* 상단: 아바타 + 이름·상태 + 삭제 */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#F0EFFB" }}>
                    <HIcon icon={UserIcon} size={20} primary="#3E2D9B" secondary="#C4BEF0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">{s.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                    </div>
                    {(s.grade || s.school) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[s.grade, s.school].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors shrink-0"
                  >
                    <HIcon icon={Delete01Icon} size={16} primary="#D1D5DB" secondary="#E5E7EB" />
                  </button>
                </div>

                {/* 중간: 위험도 · 상담 횟수 · 날짜 */}
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <HIcon icon={ChartHistogramIcon} size={13} primary={riskColor(s.latestRiskScore)} secondary={riskColor(s.latestRiskScore)} />
                    <span className="text-xs font-semibold" style={{ color: riskColor(s.latestRiskScore) }}>
                      {s.latestRiskScore != null ? `위험도 ${s.latestRiskScore}` : "분석 없음"}
                    </span>
                  </div>
                  {s.counselingCount != null && s.counselingCount > 0 && (
                    <span className="text-xs text-gray-400">{s.counselingCount}회 상담</span>
                  )}
                  {s.lastContactedAt && (
                    <div className="flex items-center gap-1">
                      <HIcon icon={Calendar01Icon} size={12} primary="#9CA3AF" secondary="#D1D5DB" />
                      <span className="text-xs text-gray-400">
                        {new Date(s.lastContactedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>

                {/* 하단: 이력 보기 버튼 */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openHistory(s)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl text-xs font-semibold border border-purple-100 text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    이력 보기
                    <HIcon icon={ArrowRight01Icon} size={13} primary="#7C3AED" secondary="#C4B5FD" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>

    {/* ── 상담 이력 모달 ─────────────────────────────────────────────────────── */}
    {historyStudent && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#F0EFFB" }}>
                <HIcon icon={UserIcon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{historyStudent.name} 상담 이력</h2>
                <p className="text-xs text-gray-400">
                  {historyStats ? `총 ${historyStats.totalSessions}건 · 최근 20건 표시` : "불러오는 중..."}
                </p>
              </div>
            </div>
            <button onClick={() => setHistoryStudent(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors text-lg font-bold">&times;</button>
          </div>

          {/* 통계 요약 */}
              {historyStats && (historyStats.totalSessions ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 mb-1">총 상담</p>
                <p className="text-lg font-bold text-gray-800">{historyStats.totalSessions ?? 0}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 mb-1">평균 위험도</p>
                <p className="text-lg font-bold" style={{ color: riskColor(historyStats.avgRiskScore) }}>
                  {historyStats.avgRiskScore != null ? historyStats.avgRiskScore.toFixed(0) : "-"}
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 mb-1">최고 위험도</p>
                <p className="text-lg font-bold" style={{ color: riskColor(historyStats.maxRiskScore) }}>
                  {historyStats.maxRiskScore != null ? historyStats.maxRiskScore.toFixed(0) : "-"}
                </p>
              </div>
            </div>
          )}

          {/* 이력 목록 */}
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-20 rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center py-10">
              <HIcon icon={CheckmarkCircle01Icon} size={32} primary="#C4BEF0" secondary="#E9E7F8" />
              <p className="text-gray-400 text-sm mt-3">아직 상담 이력이 없습니다</p>
              <p className="text-gray-300 text-xs mt-1">분석 페이지에서 학생을 선택하고 분석을 실행하면 이력이 저장됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((h, idx) => (
                <HistoryCard key={h.id ?? idx} h={h} contactLabel={contactLabel} riskColor={riskColor} />
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}

// ── 이력 카드 (접이식 상담 내용 포함) ──────────────────────────────────────────
function HistoryCard({
  h,
  contactLabel,
  riskColor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h: any
  contactLabel: Record<string, string>
  riskColor: (score: number | undefined) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = h.originalText && h.originalText.trim().length > 0
  const PREVIEW_LEN = 80
  const preview = hasContent && h.originalText.length > PREVIEW_LEN
    ? h.originalText.slice(0, PREVIEW_LEN) + "…"
    : h.originalText

  return (
    <div className="border border-slate-100 rounded-2xl p-4 hover:border-purple-100 transition-colors">
      {/* 날짜 · 대상 · 모드 · 위험도 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">
            {new Date(h.createdAt ?? h.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
          </span>
          {h.contactType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">
              {contactLabel[h.contactType] ?? h.contactType}
            </span>
          )}
          {h.analysisMode === "deep" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">심층</span>
          )}
        </div>
        {h.riskScore != null && (
          <span className="text-sm font-bold shrink-0" style={{ color: riskColor(h.riskScore) }}>
            위험도 {h.riskScore}
          </span>
        )}
      </div>

      {/* 긍정/부정 점수 */}
      {(h.positiveScore != null || h.negativeScore != null) && (
        <div className="flex gap-3 mb-2">
          {h.positiveScore != null && (
            <span className="text-xs text-emerald-600 font-medium">긍정 {h.positiveScore}</span>
          )}
          {h.negativeScore != null && (
            <span className="text-xs text-red-400 font-medium">부정 {h.negativeScore}</span>
          )}
        </div>
      )}

      {/* 상담 내용 (접이식) */}
      {hasContent && (
        <div className="mb-2">
          <div
            className="text-xs text-gray-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-wrap"
          >
            {expanded ? h.originalText : preview}
          </div>
          {h.originalText.length > PREVIEW_LEN && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[11px] text-purple-500 hover:text-purple-700 font-medium transition-colors"
            >
              {expanded ? "접기 ▲" : "전체 보기 ▼"}
            </button>
          )}
        </div>
      )}

      {/* 키워드 */}
      {h.keywords && h.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(h.keywords as string[]).slice(0, 8).map((k: string) => (
            <span key={k} className="text-xs px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-600">
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
