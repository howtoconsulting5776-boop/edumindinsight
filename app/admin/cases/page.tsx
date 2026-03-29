"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkBadge01Icon,
  PlusSignIcon,
  Delete01Icon,
  Search01Icon,
  Tag01Icon,
  AlertDiamondIcon,
  FilterIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { KnowledgeItem } from "@/lib/store"

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

const STEP_STYLE = [
  { label: "상황", color: "#3E2D9B", bg: "#F5F3FF", field: "situation" as const },
  { label: "대응", color: "#0EA5E9", bg: "#F0F9FF", field: "response" as const },
  { label: "결과", color: "#10B981", bg: "#F0FDF4", field: "outcome" as const },
]

export default function CasesPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [filtered, setFiltered] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [filterPriority, setFilterPriority] = useState<"all" | "high" | "medium" | "low">("all")

  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("high")
  const [tags, setTags] = useState("")
  const [situation, setSituation] = useState("")
  const [response, setResponse] = useState("")
  const [outcome, setOutcome] = useState("")

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/knowledge")
      const data = await res.json()
      const cases = (data.items as KnowledgeItem[]).filter((i) => i.category === "case")
      setItems(cases)
      setFiltered(cases)
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    let result = items
    if (filterPriority !== "all") result = result.filter((i) => i.priority === filterPriority)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q) ||
          i.tags?.some((t) => t.toLowerCase().includes(q)) ||
          i.situation?.toLowerCase().includes(q) ||
          i.response?.toLowerCase().includes(q) ||
          i.outcome?.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [items, search, filterPriority])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "case",
          title,
          content: `상황: ${situation}\n대응: ${response}\n결과: ${outcome}`,
          priority,
          tags,
          situation,
          response,
          outcome,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "등록에 실패했습니다.")
        return
      }
      setTitle("")
      setPriority("high")
      setTags("")
      setSituation("")
      setResponse("")
      setOutcome("")
      setShowForm(false)
      fetchItems()
    } catch {
      setError("등록 중 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 사례를 삭제하시겠습니까?")) return
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
    fetchItems()
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#3E2D9B" }}>
            <HIcon icon={CheckmarkBadge01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">모범 사례 학습</h1>
            <p className="text-sm text-gray-500">성공 상담 사례를 등록하여 AI가 참고하도록 학습시키세요</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-2xl shadow-md flex items-center gap-2"
          style={{ background: "#3E2D9B" }}
        >
          <HIcon icon={PlusSignIcon} size={16} primary="white" secondary="rgba(255,255,255,0.5)" />
          <span className="hidden sm:inline">사례 추가</span>
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-8 border border-purple-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <HIcon icon={PlusSignIcon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
            새 성공 사례 등록
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">사례 제목 *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 성적 정체기 이탈 방지 성공 사례"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">우선순위 *</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="high" className="rounded-xl">🔴 높음</SelectItem>
                    <SelectItem value="medium" className="rounded-xl">🟡 보통</SelectItem>
                    <SelectItem value="low" className="rounded-xl">⚪ 낮음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 3-step form */}
            <div className="space-y-4">
              {STEP_STYLE.map((step, idx) => (
                <div key={step.field} className="rounded-2xl overflow-hidden border border-slate-100">
                  <div
                    className="flex items-center gap-2 px-4 py-2.5"
                    style={{ background: step.bg }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: step.color }}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-sm font-bold" style={{ color: step.color }}>{step.label}</span>
                    <span className="text-xs text-gray-400">
                      {step.field === "situation" ? "어떤 상황이었나요?" : step.field === "response" ? "어떻게 대응했나요?" : "어떤 결과를 얻었나요?"}
                    </span>
                  </div>
                  <Textarea
                    value={step.field === "situation" ? situation : step.field === "response" ? response : outcome}
                    onChange={(e) => {
                      if (step.field === "situation") setSituation(e.target.value)
                      else if (step.field === "response") setResponse(e.target.value)
                      else setOutcome(e.target.value)
                    }}
                    placeholder={
                      step.field === "situation"
                        ? "예: 학부모가 성적이 3개월째 제자리라며 이달 말 퇴원을 통보..."
                        : step.field === "response"
                        ? "예: 오답 패턴 분석 자료를 출력하여 학부모와 함께 검토..."
                        : "예: '이렇게 세심하게 관리하는 줄 몰랐다'며 6개월 장기 등록으로 전환..."
                    }
                    className="min-h-[80px] rounded-none border-0 border-t border-slate-100 bg-white focus:ring-0 resize-none text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">태그 (쉼표 구분)</Label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <HIcon icon={Tag01Icon} size={15} primary="#9CA3AF" secondary="#C4BEF0" />
                </div>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="예: 성적, 이탈방지, 데이터"
                  className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
                <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={submitting} className="flex-1 h-11 rounded-2xl font-semibold" style={{ background: "#3E2D9B" }}>
                {submitting ? "등록 중..." : "사례 등록"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setError("") }} className="flex-1 h-11 rounded-2xl font-semibold border-slate-200">
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-3xl p-5 shadow-xl shadow-slate-200/60 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <HIcon icon={Search01Icon} size={16} primary="#9CA3AF" secondary="#C4BEF0" />
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 내용, 태그로 검색..."
            className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
          />
        </div>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <HIcon icon={FilterIcon} size={15} primary="#9CA3AF" secondary="#C4BEF0" />
          </div>
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as typeof filterPriority)}>
            <SelectTrigger className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="rounded-xl">전체</SelectItem>
              <SelectItem value="high" className="rounded-xl">🔴 높음</SelectItem>
              <SelectItem value="medium" className="rounded-xl">🟡 보통</SelectItem>
              <SelectItem value="low" className="rounded-xl">⚪ 낮음</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Case list */}
      <div className="space-y-5">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-xl shadow-slate-200/60">
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/60">
            <HIcon icon={CheckmarkBadge01Icon} size={36} primary="#C4BEF0" secondary="#E9E7F8" />
            <p className="text-gray-500 font-medium mt-4">
              {search || filterPriority !== "all" ? "검색 결과가 없습니다" : "등록된 사례가 없습니다"}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/60">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                    item.priority === "high" ? "text-red-600 bg-red-50 border border-red-100" :
                    item.priority === "medium" ? "text-amber-600 bg-amber-50 border border-amber-100" :
                    "text-gray-600 bg-gray-50 border border-gray-100"
                  }`}>
                    {item.priority === "high" ? "높음" : item.priority === "medium" ? "보통" : "낮음"}
                  </span>
                  <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-red-50 transition-colors"
                >
                  <HIcon icon={Delete01Icon} size={18} primary="#D1D5DB" secondary="#E5E7EB" />
                </button>
              </div>

              {/* 3-step display */}
              <div className="space-y-2">
                {STEP_STYLE.map((step) => {
                  const val = item[step.field]
                  if (!val) return null
                  return (
                    <div key={step.field} className="flex gap-3">
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ background: step.color }}
                        >
                          {STEP_STYLE.indexOf(step) + 1}
                        </div>
                        <span className="text-xs font-bold" style={{ color: step.color }}>{step.label}</span>
                        <HIcon icon={ArrowRight01Icon} size={12} primary="#D1D5DB" secondary="#E5E7EB" />
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{val}</p>
                    </div>
                  )
                })}
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
