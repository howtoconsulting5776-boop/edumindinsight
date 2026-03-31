"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
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
  Image01Icon,
  DatabaseIcon,
  Settings01Icon,
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

interface ManualItem {
  id: string
  title: string
  content: string
  priority: "low" | "medium" | "high" | "critical"
  tags: string[]
  subject?: string
  entryType?: string
  createdAt: string
  chunkCount?: number
}

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

const PRIORITY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "긴급", color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  high:     { label: "높음", color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
  medium:   { label: "보통", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  low:      { label: "낮음", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
}

export default function ManualsPage() {
  const [items, setItems] = useState<ManualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  // DB 설정 모달
  const [dbSetupNeeded, setDbSetupNeeded] = useState(false)
  const [dbSetupSql, setDbSetupSql] = useState("")
  const [sqlCopied, setSqlCopied] = useState(false)
  const [dbSetupRunning, setDbSetupRunning] = useState(false)
  const [dbSetupDone, setDbSetupDone] = useState(false)
  const [dbAccessToken, setDbAccessToken] = useState("")
  const [dbSetupError, setDbSetupError] = useState("")

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
  const [tags, setTags] = useState("")

  // 파일 업로드 state (PDF + 이미지 통합)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileType, setUploadFileType] = useState<"pdf" | "image" | null>(null)
  const [pdfPriority, setPdfPriority] = useState<"low" | "medium" | "high">("medium")
  const [pdfTags, setPdfTags] = useState("")
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [pdfSuccess, setPdfSuccess] = useState<{ fileName: string; chunks: number; characters: number; ocrUsed?: boolean; fileType?: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]
  function detectFileType(file: File): "pdf" | "image" | null {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext === "pdf") return "pdf"
    if (IMAGE_EXTS.includes(ext)) return "image"
    return null
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      // v3: /api/manuals 우선, 실패 시 /api/knowledge 폴백
      let res = await fetch("/api/manuals")
      if (!res.ok) {
        res = await fetch("/api/knowledge")
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const manuals = (data.items as any[]).filter((i) => i.category === "manual").map((i) => ({
          id: i.id, title: i.title, content: i.content, priority: i.priority,
          tags: i.tags ?? [], createdAt: i.createdAt,
        }))
        setItems(manuals)
        return
      }
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setItems((data.items as any[]).map((i) => ({
        id: i.id, title: i.title, content: i.content, priority: i.priority,
        tags: i.tags ?? [], subject: i.subject, entryType: i.entryType,
        createdAt: i.createdAt, chunkCount: i.chunkCount,
      })))
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
      // v3: /api/manuals 우선, 실패 시 /api/knowledge 폴백
      let res = await fetch("/api/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, priority, tags }),
      })
      if (!res.ok && res.status === 404) {
        res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "manual", title, content, priority, tags }),
        })
      }
      if (!res.ok) {
        const d = await res.json()
        if (d.error?.includes("스키마") || d.error?.includes("schema") || d.error?.includes("Could not find")) {
          const sqlRes = await fetch("/api/setup").catch(() => null)
          const sqlData = sqlRes ? await sqlRes.json().catch(() => ({})) : {}
          setDbSetupSql(sqlData.sql ?? "")
          setDbSetupNeeded(true)
          return
        }
        setError(d.error ?? "등록에 실패했습니다.")
        return
      }
      setTitle(""); setContent(""); setPriority("medium"); setTags("")
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
    // v3: /api/manuals/{id} 우선, 실패 시 /api/knowledge/{id} 폴백
    const r = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
    if (!r.ok) await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
    fetchItems()
  }

  function handleFileChange(file: File | null) {
    setPdfError(""); setPdfSuccess(null)
    if (!file) { setUploadFile(null); setUploadFileType(null); return }
    const ft = detectFileType(file)
    if (!ft) {
      setPdfError("PDF 또는 이미지 파일(JPG, PNG, WebP, GIF)만 업로드 가능합니다.")
      setUploadFile(null); setUploadFileType(null); return
    }
    if (file.size > 50 * 1024 * 1024) {
      setPdfError("파일 크기는 50MB 이하여야 합니다.")
      setUploadFile(null); setUploadFileType(null); return
    }
    setUploadFile(file); setUploadFileType(ft)
  }

  async function callUploadApi(formDataOrJson: FormData | object): Promise<boolean> {
    const isFormData = formDataOrJson instanceof FormData
    // v3: /api/manuals/upload 우선, 실패 시 /api/knowledge/upload 폴백
    let res = await fetch("/api/manuals/upload", {
      method: "POST",
      headers: isFormData ? undefined : { "Content-Type": "application/json" },
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson),
    })
    if (!res.ok && res.status === 404) {
      res = await fetch("/api/knowledge/upload", {
        method: "POST",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson),
      })
    }
    const data = await res.json()
    if (!res.ok) {
      if (data.error === "DB_SETUP_NEEDED" || res.status === 409) {
        const sqlRes = await fetch("/api/setup").catch(() => null)
        const sqlData = sqlRes ? await sqlRes.json().catch(() => ({})) : {}
        setDbSetupSql(sqlData.sql ?? "")
        setDbSetupNeeded(true)
        return false
      }
      setPdfError(data.error ?? "처리에 실패했습니다.")
      return false
    }
    setPdfSuccess({ fileName: data.fileName, chunks: data.chunks, characters: data.characters, ocrUsed: data.ocrUsed, fileType: data.fileType })
    setUploadFile(null); setUploadFileType(null); setPdfTags("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    fetchItems()
    return true
  }

  async function handlePdfUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) { setPdfError("파일을 선택해주세요."); return }
    setPdfUploading(true); setPdfError(""); setPdfSuccess(null)
    try {
      await fetch("/api/storage/ensure-bucket", { method: "POST" }).catch(() => {})

      let storageOk = false
      let storagePath = ""
      try {
        const supabase = createSupabaseBrowserClient()
        const isImage = uploadFileType === "image"
        const mimeType = isImage ? (uploadFile.type || "image/jpeg") : "application/pdf"
        const folder = isImage ? "images" : "pdfs"
        storagePath = `${folder}/${Date.now()}_${uploadFile.name.replace(/\s+/g, "_")}`
        const { error: uploadErr } = await supabase.storage
          .from("pdf-uploads").upload(storagePath, uploadFile, { contentType: mimeType, upsert: false })
        if (!uploadErr) storageOk = true
        else console.warn("[upload] storage error:", uploadErr.message)
      } catch (storageErr) { console.warn("[upload] storage exception:", storageErr) }

      if (storageOk) {
        await callUploadApi({ storagePath, originalName: uploadFile.name, priority: pdfPriority, tags: pdfTags, bucket: "pdf-uploads" })
      } else {
        if (uploadFile.size > 4 * 1024 * 1024) {
          setPdfError("파일이 너무 큽니다. Supabase Storage 설정을 확인해주세요.")
          return
        }
        const fd = new FormData()
        fd.append("file", uploadFile); fd.append("priority", pdfPriority); fd.append("tags", pdfTags)
        await callUploadApi(fd)
      }
    } catch {
      setPdfError("업로드 중 오류가 발생했습니다.")
    } finally {
      setPdfUploading(false)
    }
  }

  return (
    <>
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
            onClick={() => { setShowFileUpload(!showFileUpload); setShowForm(false) }}
            variant="outline"
            className="rounded-2xl shadow-sm flex items-center gap-2 border-[#3E2D9B] text-[#3E2D9B] hover:bg-purple-50"
          >
            <HIcon icon={Upload01Icon} size={16} primary="#3E2D9B" secondary="#C4BEF0" />
            <span className="hidden sm:inline">파일 업로드</span>
          </Button>
          <Button
            onClick={() => { setShowForm(!showForm); setShowFileUpload(false) }}
            className="rounded-2xl shadow-md flex items-center gap-2"
            style={{ background: "#3E2D9B" }}
          >
            <HIcon icon={PlusSignIcon} size={16} primary="white" secondary="rgba(255,255,255,0.5)" />
            <span className="hidden sm:inline">매뉴얼 추가</span>
          </Button>
        </div>
      </div>

      {/* 파일 업로드 폼 (PDF + 이미지) */}
      {showFileUpload && (
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-8 border border-purple-100">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <HIcon icon={Upload01Icon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
            파일 업로드 (PDF · 이미지)
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            PDF 또는 이미지를 업로드하면 AI가 내용을 분석하여 지식베이스에 자동 등록합니다.
          </p>

          {pdfSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-green-50 border border-green-100 mb-5">
              <HIcon icon={CheckmarkCircle01Icon} size={18} primary="#10B981" secondary="#6EE7B7" />
              <div>
                <p className="text-green-700 text-sm font-semibold">{pdfSuccess.fileName} 업로드 완료!</p>
                <p className="text-green-600 text-xs mt-0.5">
                  {pdfSuccess.chunks}개 항목 · {pdfSuccess.characters.toLocaleString()}자 추출
                  {pdfSuccess.ocrUsed && (
                    <span className="ml-1 text-blue-600 font-medium">
                      {pdfSuccess.fileType === "image" ? "(AI Vision 분석됨)" : "(AI OCR 적용됨)"}
                    </span>
                  )}
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
                  : uploadFile
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 bg-slate-50 hover:border-[#3E2D9B] hover:bg-purple-50"
              }`}
            >
              <HIcon
                icon={uploadFile ? (uploadFileType === "image" ? Image01Icon : FileIcon) : Upload01Icon}
                size={32}
                primary={uploadFile ? "#10B981" : "#3E2D9B"}
                secondary={uploadFile ? "#6EE7B7" : "#C4BEF0"}
              />
              {uploadFile ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">{uploadFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {uploadFileType === "image" ? "🖼️ 이미지" : "📄 PDF"} · {(uploadFile.size / 1024).toFixed(0)} KB
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-700">파일을 드래그하거나 클릭하여 선택</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <HIcon icon={FileIcon} size={13} primary="#9CA3AF" secondary="#D1D5DB" /> PDF
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <HIcon icon={Image01Icon} size={13} primary="#9CA3AF" secondary="#D1D5DB" /> JPG · PNG · WebP · GIF
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">최대 50MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic"
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
                disabled={pdfUploading || !uploadFile}
                className="flex-1 h-11 rounded-2xl font-semibold"
                style={{ background: "#3E2D9B" }}
              >
                {pdfUploading
                  ? (uploadFileType === "image" ? "이미지 분석 중..." : "텍스트 추출 중...")
                  : "업로드 & AI 학습"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowFileUpload(false); setPdfError(""); setPdfSuccess(null); setUploadFile(null); setUploadFileType(null) }}
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
              const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
              return (order[b.priority] ?? 1) - (order[a.priority] ?? 1)
            })
            .map((item) => {
              const ps = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.low
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
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                      {item.chunkCount != null && (
                        <span className="text-xs text-purple-400">{item.chunkCount}개 청크</span>
                      )}
                    </div>
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

    {/* ── DB 설정 필요 모달 ─────────────────────────────────────────────── */}
    {dbSetupNeeded && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-7 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-100">
              <HIcon icon={DatabaseIcon} size={20} primary="#D97706" secondary="#FDE68A" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">데이터베이스 초기 설정 필요</h2>
              <p className="text-xs text-gray-500">테이블 생성 후 파일 업로드가 가능합니다</p>
            </div>
          </div>

          {dbSetupDone ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200 mb-4">
              <HIcon icon={CheckmarkCircle01Icon} size={20} primary="#10B981" secondary="#6EE7B7" />
              <div>
                <p className="text-green-700 font-semibold text-sm">설정 완료!</p>
                <p className="text-green-600 text-xs">파일 업로드를 다시 시도해주세요.</p>
              </div>
            </div>
          ) : (
            <>
              {/* 방법 1: 토큰 자동 설정 */}
              <div className="border border-slate-100 rounded-2xl p-4 mb-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  ① Personal Access Token으로 자동 설정
                </p>
                <div className="bg-blue-50 rounded-xl p-3 mb-3 text-xs text-blue-700 leading-relaxed">
                  <a
                    href="https://supabase.com/dashboard/account/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold"
                  >
                    supabase.com/dashboard/account/tokens
                  </a>{" "}
                  에서 토큰 발급 후 아래 입력
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="password"
                    value={dbAccessToken}
                    onChange={(e) => { setDbAccessToken(e.target.value); setDbSetupError("") }}
                    placeholder="sbp_xxxxxxxx..."
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#3E2D9B]/30"
                  />
                </div>
                {dbSetupError && (
                  <p className="text-xs text-red-500 mb-2">{dbSetupError}</p>
                )}
                <button
                  onClick={async () => {
                    if (!dbAccessToken.trim()) { setDbSetupError("토큰을 입력해주세요."); return }
                    setDbSetupRunning(true)
                    setDbSetupError("")
                    try {
                      const res = await fetch("/api/setup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ accessToken: dbAccessToken.trim() }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setDbSetupDone(true)
                      } else {
                        setDbSetupError(data.message ?? "설정에 실패했습니다.")
                      }
                    } catch { setDbSetupError("연결 오류가 발생했습니다.") }
                    finally { setDbSetupRunning(false) }
                  }}
                  disabled={dbSetupRunning}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: "#3E2D9B" }}
                >
                  <HIcon icon={Settings01Icon} size={13} primary="white" secondary="rgba(255,255,255,0.5)" />
                  {dbSetupRunning ? "자동 설정 중..." : "자동 설정 실행"}
                </button>
              </div>

              {/* 방법 2: 수동 SQL */}
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  ② SQL Editor에서 직접 실행
                </p>

                <div className="relative mb-3">
                  <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-3 overflow-auto max-h-32 leading-relaxed whitespace-pre-wrap">
                    {dbSetupSql}
                  </pre>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(dbSetupSql)
                      setSqlCopied(true)
                      setTimeout(() => setSqlCopied(false), 2000)
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    {sqlCopied ? "✓ 복사됨" : "복사"}
                  </button>
                </div>

                {/* Supabase SQL Editor 직접 링크 */}
                {(() => {
                  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
                  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
                  const editorUrl = ref
                    ? `https://supabase.com/dashboard/project/${ref}/sql/new`
                    : "https://supabase.com/dashboard"
                  return (
                    <a
                      href={editorUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={async () => {
                        await navigator.clipboard.writeText(dbSetupSql).catch(() => {})
                        setSqlCopied(true)
                        setTimeout(() => setSqlCopied(false), 2000)
                      }}
                      className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-xs font-semibold border-2 border-[#3E2D9B] text-[#3E2D9B] hover:bg-[#3E2D9B] hover:text-white transition-all mb-2"
                    >
                      SQL 복사 후 Supabase SQL Editor 열기 →
                    </a>
                  )
                })()}

                <button
                  onClick={() => setDbSetupDone(true)}
                  className="w-full h-9 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  SQL 실행 완료 (업로드 재시도)
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => { setDbSetupNeeded(false); setDbSetupDone(false); setDbSetupError(""); setDbAccessToken("") }}
            className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    )}
    </>
  )
}
