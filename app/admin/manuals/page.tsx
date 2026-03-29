"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  PlusSignIcon,
  Delete01Icon,
  Tag01Icon,
  AlertDiamondIcon,
  Upload01Icon,
  FileIcon,
  CheckmarkCircle01Icon,
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

  // PDF upload state
  const [showPdfUpload, setShowPdfUpload] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPriority, setPdfPriority] = useState<"low" | "medium" | "high">("medium")
  const [pdfTags, setPdfTags] = useState("")
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [pdfSuccess, setPdfSuccess] = useState<{ fileName: string; chunks: number; characters: number; ocrUsed?: boolean } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handleFileChange(file: File | null) {
    setPdfError("")
    setPdfSuccess(null)
    if (!file) { setPdfFile(null); return }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("PDF 파일만 업로드 가능합니다.")
      setPdfFile(null)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setPdfError("파일 크기는 10MB 이하여야 합니다.")
      setPdfFile(null)
      return
    }
    setPdfFile(file)
  }

  async function handlePdfUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!pdfFile) { setPdfError("PDF 파일을 선택해주세요."); return }
    setPdfUploading(true)
    setPdfError("")
    setPdfSuccess(null)
    try {
      const fd = new FormData()
      fd.append("file", pdfFile)
      fd.append("priority", pdfPriority)
      fd.append("tags", pdfTags)
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setPdfError(data.error ?? "업로드에 실패했습니다."); return }
      setPdfSuccess({ fileName: data.fileName, chunks: data.chunks, characters: data.characters, ocrUsed: data.ocrUsed })
      setPdfFile(null)
      setPdfTags("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      fetchItems()
    } catch {
      setPdfError("업로드 중 오류가 발생했습니다.")
    } finally {
      setPdfUploading(false)
    }
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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setShowPdfUpload(!showPdfUpload); setShowForm(false) }}
            variant="outline"
            className="rounded-2xl shadow-sm flex items-center gap-2 border-[#3E2D9B] text-[#3E2D9B] hover:bg-purple-50"
          >
            <HIcon icon={Upload01Icon} size={16} primary="#3E2D9B" secondary="#C4BEF0" />
            <span className="hidden sm:inline">PDF 업로드</span>
          </Button>
          <Button
            onClick={() => { setShowForm(!showForm); setShowPdfUpload(false) }}
            className="rounded-2xl shadow-md flex items-center gap-2"
            style={{ background: "#3E2D9B" }}
          >
            <HIcon icon={PlusSignIcon} size={16} primary="white" secondary="rgba(255,255,255,0.5)" />
            <span className="hidden sm:inline">매뉴얼 추가</span>
          </Button>
        </div>
      </div>

      {/* PDF Upload form */}
      {showPdfUpload && (
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-8 border border-purple-100">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <HIcon icon={Upload01Icon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
            PDF 파일 업로드
          </h2>
          <p className="text-sm text-gray-500 mb-6">PDF를 업로드하면 텍스트를 자동 추출하여 AI 지식베이스에 등록합니다.</p>

          {pdfSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-green-50 border border-green-100 mb-5">
              <HIcon icon={CheckmarkCircle01Icon} size={18} primary="#10B981" secondary="#6EE7B7" />
              <div>
                <p className="text-green-700 text-sm font-semibold">{pdfSuccess.fileName} 업로드 완료!</p>
                <p className="text-green-600 text-xs mt-0.5">
                  {pdfSuccess.chunks}개 항목으로 분할 · {pdfSuccess.characters.toLocaleString()}자 추출
                  {pdfSuccess.ocrUsed && <span className="ml-1 text-blue-600 font-medium">(AI OCR 적용됨)</span>}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handlePdfUpload} className="space-y-5">
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFileChange(e.dataTransfer.files[0] ?? null)
              }}
              className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors ${
                dragOver
                  ? "border-[#3E2D9B] bg-purple-50"
                  : pdfFile
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 bg-slate-50 hover:border-[#3E2D9B] hover:bg-purple-50"
              }`}
            >
              <HIcon
                icon={pdfFile ? FileIcon : Upload01Icon}
                size={32}
                primary={pdfFile ? "#10B981" : "#3E2D9B"}
                secondary={pdfFile ? "#6EE7B7" : "#C4BEF0"}
              />
              {pdfFile ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">{pdfFile.name}</p>
                  <p className="text-xs text-gray-500">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-700">PDF 파일을 드래그하거나 클릭하여 선택</p>
                  <p className="text-xs text-gray-400">최대 10MB · PDF만 지원</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">우선순위</Label>
                <Select value={pdfPriority} onValueChange={(v) => setPdfPriority(v as typeof pdfPriority)}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus:border-[#3E2D9B]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="high" className="rounded-xl"><span className="font-semibold text-red-600">🔴 높음</span></SelectItem>
                    <SelectItem value="medium" className="rounded-xl"><span className="font-semibold text-amber-600">🟡 보통</span></SelectItem>
                    <SelectItem value="low" className="rounded-xl"><span className="font-semibold text-gray-600">⚪ 낮음</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">태그 (쉼표 구분)</Label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <HIcon icon={Tag01Icon} size={15} primary="#9CA3AF" secondary="#C4BEF0" />
                  </div>
                  <Input
                    value={pdfTags}
                    onChange={(e) => setPdfTags(e.target.value)}
                    placeholder="예: 규정, 원칙"
                    className="pl-9 h-11 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B]"
                  />
                </div>
              </div>
            </div>

            {pdfError && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
                <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
                <span className="text-red-600 text-sm">{pdfError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="submit"
                disabled={pdfUploading || !pdfFile}
                className="flex-1 h-11 rounded-2xl font-semibold"
                style={{ background: "#3E2D9B" }}
              >
                {pdfUploading ? "추출 중..." : "업로드 & 학습"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowPdfUpload(false); setPdfError(""); setPdfSuccess(null); setPdfFile(null) }}
                className="flex-1 h-11 rounded-2xl font-semibold border-slate-200"
              >
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

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
