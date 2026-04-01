"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Group01Icon,
  CopyLinkIcon,
  Delete01Icon,
  School01Icon,
  AlertDiamondIcon,
  CheckmarkCircle01Icon,
  ReloadIcon,
} from "@hugeicons/core-free-icons"

function HIcon({
  icon, size = 20, primary = "currentColor", secondary = "currentColor",
}: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; size?: number; primary?: string; secondary?: string }) {
  return (
    <HugeiconsIcon icon={icon} size={size} color={primary} strokeWidth={1.8}
      style={{ "--tw-icon-secondary-color": secondary } as React.CSSProperties} />
  )
}

interface Teacher {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

interface AcademyInfo {
  id: string
  name: string
  code: string
}

export default function ManagePage() {
  const [academy, setAcademy] = useState<AcademyInfo | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copiedCode, setCopiedCode] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/manage/teachers")
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setError(`서버 응답 오류 (HTTP ${res.status}). 잠시 후 다시 시도해주세요.`)
        return
      }
      if (!res.ok) { setError((data.error as string) ?? "데이터를 불러오는 중 오류가 발생했습니다."); return }
      setAcademy(data.academy as AcademyInfo)
      setTeachers((data.teachers as Teacher[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function removeTeacher(teacherId: string) {
    if (!confirm("이 선생님을 학원에서 제외하시겠습니까?")) return
    setRemovingId(teacherId)
    try {
      const res = await fetch("/api/manage/teachers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? "제외에 실패했습니다."); return }
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId))
    } catch {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setRemovingId(null)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#3E2D9B" }}>
            <HIcon icon={Group01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">선생님 관리</h1>
            <p className="text-sm text-gray-500">소속 선생님 목록과 초대 코드를 관리합니다</p>
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-red-50 border border-red-100">
          <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 학원 정보 + 초대 코드 */}
      {academy && (
        <div className="bg-white rounded-xl p-7 shadow-xl shadow-slate-200/60 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <HIcon icon={School01Icon} size={20} primary="#3E2D9B" secondary="#C4BEF0" />
            <h2 className="text-lg font-bold text-gray-900">학원 정보</h2>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#F5F3FF] border border-[#3E2D9B]/15">
            <div>
              <p className="text-xs text-[#6B5BC4] font-semibold mb-1">선생님 초대 코드</p>
              <p className="font-mono font-bold text-2xl text-[#3E2D9B] tracking-widest">{academy.code}</p>
              <p className="text-xs text-gray-400 mt-1">이 코드를 선생님들에게 공유하세요</p>
            </div>
            <button
              onClick={() => copyCode(academy.code)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: copiedCode ? "#10B981" : "#3E2D9B",
                color: "white",
              }}
            >
              <HIcon
                icon={copiedCode ? CheckmarkCircle01Icon : CopyLinkIcon}
                size={16} primary="white" secondary="rgba(255,255,255,0.5)"
              />
              {copiedCode ? "복사됨!" : "코드 복사"}
            </button>
          </div>
        </div>
      )}

      {/* 선생님 목록 */}
      <div className="bg-white rounded-xl p-7 shadow-xl shadow-slate-200/60">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <HIcon icon={Group01Icon} size={20} primary="#3E2D9B" secondary="#C4BEF0" />
            <h2 className="text-lg font-bold text-gray-900">선생님 목록</h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5F3FF] text-[#3E2D9B]">
            {teachers.length}명
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-[#3E2D9B]/20 border-t-[#3E2D9B] rounded-full animate-spin" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#F5F3FF" }}>
              <HIcon icon={Group01Icon} size={26} primary="#3E2D9B" secondary="#C4BEF0" />
            </div>
            <p className="text-sm font-medium text-gray-500">아직 합류한 선생님이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">위의 초대 코드를 선생님들에게 공유해주세요.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {teachers.map((teacher) => (
              <li key={teacher.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#3E2D9B]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#3E2D9B]">
                    {(teacher.full_name ?? teacher.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {teacher.full_name ?? "이름 미설정"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{teacher.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">
                    {new Date(teacher.created_at).toLocaleDateString("ko-KR")}
                  </span>
                  <button
                    onClick={() => removeTeacher(teacher.id)}
                    disabled={removingId === teacher.id}
                    className="p-2 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                    title="학원에서 제외"
                  >
                    <HIcon icon={Delete01Icon} size={16} primary="currentColor" secondary="currentColor" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
