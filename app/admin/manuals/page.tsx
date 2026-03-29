"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  PlusSignIcon,
  Delete01Icon,
  Tag01Icon,
  AlertDiamondIcon,
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

const PRIORITY_STYLE = {
  high: { label: "높음", color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
  medium: { label: "보통", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  low: { label: "낮음", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
}

export default function ManualsPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
  const [tags, setTags] = useState("")

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/knowledge")
      const data = await res.json()
      setItems((data.items as KnowledgeItem[]).filter((i) => i.category === "manual"))
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "manual", title, content, priority, tags }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "등록에 실패했습니다.")
        return
      }
      setTitle("")
      setContent("")
      setPriority("medium")
      setTags("")
      setShowForm(false)
      fetchItems()
    } catch {
      setError("등록 중 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
    fetchItems()
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#3E2D9B" }}>
            <HIcon icon={BookOpen01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">상담 매뉴얼 관리</h1>
            <p className="text-sm text-gray-500">학원 운영 Hard Rules를 등록하여 AI 분석에 반영하세요</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-2xl shadow-md flex items-center gap-2"
          style={{ background: "#3E2D9B" }}
        >
          <HIcon icon={PlusSignIcon} size={16} primary="white" secondary="rgba(255,255,255,0.5)" />
          <span className="hidden sm:inline">매뉴얼 추가</span>
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-8 border border-purple-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <HIcon icon={PlusSignIcon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
            새 매뉴얼 등록
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">제목 *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 환불 정책 절대 원칙"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">우선순위 *</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:border-[#3E2D9B]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="high" className="rounded-xl">
                      <span className="font-semibold text-red-600">🔴 높음 (High)</span>
                    </SelectItem>
                    <SelectItem value="medium" className="rounded-xl">
                      <span className="font-semibold text-amber-600">🟡 보통 (Medium)</span>
                    </SelectItem>
                    <SelectItem value="low" className="rounded-xl">
                      <span className="font-semibold text-gray-600">⚪ 낮음 (Low)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">내용 *</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="AI가 반드시 따라야 할 학원 운영 지침 및 원칙을 상세히 작성해주세요."
                className="min-h-[120px] rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] resize-none"
                required
              />
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
                  placeholder="예: 환불, 정책, 수강료"
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
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 rounded-2xl font-semibold"
                style={{ background: "#3E2D9B" }}
              >
                {submitting ? "등록 중..." : "등록하기"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowForm(false); setError("") }}
                className="flex-1 h-11 rounded-2xl font-semibold border-slate-200"
              >
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-xl shadow-slate-200/60">
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/60">
            <HIcon icon={BookOpen01Icon} size={36} primary="#C4BEF0" secondary="#E9E7F8" />
            <p className="text-gray-500 font-medium mt-4">등록된 매뉴얼이 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">위 버튼을 눌러 첫 번째 매뉴얼을 추가해보세요.</p>
          </div>
        ) : (
          items
            .sort((a, b) => {
              const order = { high: 3, medium: 2, low: 1 }
              return order[b.priority] - order[a.priority]
            })
            .map((item) => {
              const ps = PRIORITY_STYLE[item.priority]
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/60 flex gap-5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className="px-2.5 py-1 rounded-xl text-xs font-bold border"
                        style={{ color: ps.color, background: ps.bg, borderColor: ps.border }}
                      >
                        {ps.label}
                      </span>
                      <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.content}</p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
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
                    <p className="text-xs text-gray-400 mt-3">
                      {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-red-50 transition-colors group"
                  >
                    <HIcon
                      icon={Delete01Icon}
                      size={18}
                      primary="#D1D5DB"
                      secondary="#E5E7EB"
                    />
                  </button>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
