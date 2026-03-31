"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  School01Icon,
  UserGroupIcon,
  Search01Icon,
  CheckmarkCircle01Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

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

type Role = "director" | "teacher"

interface FoundAcademy {
  id: string
  name: string
  code: string
}

export default function SocialOnboardingPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>("director")
  const [academyName, setAcademyName] = useState("")
  const [academyCode, setAcademyCode] = useState("")
  const [foundAcademy, setFoundAcademy] = useState<FoundAcademy | null>(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? ""
      setUserName(name)
    })
  }, [router])

  async function searchAcademy() {
    const code = academyCode.trim().toUpperCase()
    if (!code) { setError("학원 코드를 입력해주세요."); return }
    setSearching(true); setError(""); setFoundAcademy(null)
    try {
      const res = await fetch(`/api/academies?code=${code}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "학원을 찾을 수 없습니다."); return }
      setFoundAcademy(data.academy)
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const body =
        role === "director"
          ? { role, academy_name: academyName.trim() }
          : { role, academy_id: foundAcademy?.id }

      if (role === "director" && !academyName.trim()) {
        setError("학원 이름을 입력해주세요."); return
      }
      if (role === "teacher" && !foundAcademy) {
        setError("먼저 학원 코드를 검색하여 학원을 확인해주세요."); return
      }

      const res = await fetch("/api/auth/social-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "설정에 실패했습니다.")
        return
      }

      const dest = data.role === "director" ? "/admin" : "/"
      window.location.href = dest
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F8FF] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #3E2D9B, #5A44C4)" }}
          >
            <HIcon icon={School01Icon} size={28} primary="white" secondary="rgba(255,255,255,0.5)" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">거의 다 됐어요!</h1>
          {userName && (
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{userName}</span>님, 학원 정보를 설정해주세요.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">Free 플랜으로 바로 시작합니다 (월 10회 무료)</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 p-8 border border-slate-100/50">
          {/* 역할 선택 */}
          <div className="mb-6">
            <Label className="text-sm font-semibold text-gray-700 block mb-3">직책을 선택해주세요</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["director", "teacher"] as Role[]).map((r) => {
                const isActive = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r)
                      setAcademyName("")
                      setAcademyCode("")
                      setFoundAcademy(null)
                      setError("")
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-sm font-semibold ${
                      isActive
                        ? "border-[#3E2D9B] bg-[#F5F3FF] text-[#3E2D9B]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <HIcon
                      icon={r === "director" ? School01Icon : UserGroupIcon}
                      size={22}
                      primary={isActive ? "#3E2D9B" : "#9CA3AF"}
                      secondary={isActive ? "#C4BEF0" : "#D1D5DB"}
                    />
                    {r === "director" ? "학원장" : "선생님"}
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === "director" ? (
              <div className="space-y-2">
                <Label htmlFor="academyName" className="text-sm font-semibold text-gray-700">
                  학원 이름 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <HIcon icon={School01Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                  </div>
                  <Input
                    id="academyName"
                    type="text"
                    value={academyName}
                    onChange={(e) => setAcademyName(e.target.value)}
                    placeholder="예) 에듀마인 학원"
                    className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 pl-1">가입 후 선생님을 초대할 코드가 자동 생성됩니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="academyCode" className="text-sm font-semibold text-gray-700">
                  학원 초대 코드 <span className="text-red-400">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <HIcon icon={School01Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                    </div>
                    <Input
                      id="academyCode"
                      type="text"
                      value={academyCode}
                      onChange={(e) => {
                        setAcademyCode(e.target.value.toUpperCase())
                        setFoundAcademy(null)
                      }}
                      placeholder="학원장에게 받은 코드 입력"
                      className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all font-mono tracking-wider"
                      maxLength={8}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={searchAcademy}
                    disabled={searching || !academyCode.trim()}
                    className="h-12 px-4 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all shrink-0"
                    style={{ background: "#3E2D9B" }}
                  >
                    {searching ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                    ) : (
                      <HIcon icon={Search01Icon} size={17} primary="white" secondary="rgba(255,255,255,0.5)" />
                    )}
                  </button>
                </div>
                {foundAcademy && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 border border-green-100">
                    <HIcon icon={CheckmarkCircle01Icon} size={18} primary="#10B981" secondary="#A7F3D0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">{foundAcademy.name}</p>
                      <p className="text-xs text-green-600">이 학원에 선생님으로 합류합니다</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
                <HIcon icon={Alert02Icon} size={16} primary="#EF4444" secondary="#FCA5A5" />
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl font-semibold text-base shadow-lg shadow-purple-200 transition-all"
              style={{ background: loading ? "#9CA3AF" : "#3E2D9B" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  설정 중...
                </span>
              ) : (
                role === "director" ? "학원 개설 & 시작하기" : "학원 합류 & 시작하기"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
