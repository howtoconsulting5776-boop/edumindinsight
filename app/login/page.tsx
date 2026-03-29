"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LockKeyIcon,
  Login01Icon,
  ShieldKeyIcon,
  Alert02Icon,
  UserAdd01Icon,
  Mail01Icon,
  CheckmarkCircle01Icon,
  School01Icon,
  Search01Icon,
  CopyLinkIcon,
  UserGroupIcon,
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

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Mode = "login" | "signup" | "signup_done"
type SignupRole = "director" | "teacher"

interface FoundAcademy {
  id: string
  name: string
  code: string
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")

  // common fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // signup role + academy
  const [signupRole, setSignupRole] = useState<SignupRole>("director")
  const [academyName, setAcademyName] = useState("")       // director: new academy name
  const [academyCode, setAcademyCode] = useState("")       // teacher: invite code input
  const [foundAcademy, setFoundAcademy] = useState<FoundAcademy | null>(null)
  const [searching, setSearching] = useState(false)

  // result
  const [createdAcademy, setCreatedAcademy] = useState<FoundAcademy | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function resetFields() {
    setEmail(""); setPassword(""); setName(""); setConfirmPassword("")
    setAcademyName(""); setAcademyCode(""); setFoundAcademy(null)
    setCreatedAcademy(null); setError(""); setCopiedCode(false)
  }

  function switchMode(next: Mode) {
    resetFields()
    setMode(next)
  }

  // ── 학원 코드 검색 ──────────────────────────────────────────────────────
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

  // ── Supabase 로그인 ──────────────────────────────────────────────────────
  async function loginWithSupabase() {
    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : authError.message
      )
      return
    }
    const res = await fetch("/api/auth/role")
    const data = await res.json()
    const role = data.role ?? "teacher"
    router.push(role === "admin" || role === "director" ? "/admin" : "/")
    router.refresh()
  }

  // ── Supabase 회원가입 ───────────────────────────────────────────────────
  async function signUpWithSupabase() {
    if (password !== confirmPassword) { setError("비밀번호가 일치하지 않습니다."); return }
    if (password.length < 6) { setError("비밀번호는 최소 6자 이상이어야 합니다."); return }

    let academyId = ""
    let resolvedAcademyName = ""

    if (signupRole === "director") {
      // 1. 학원 생성
      if (!academyName.trim()) { setError("학원 이름을 입력해주세요."); return }
      const res = await fetch("/api/academies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: academyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "학원 생성에 실패했습니다."); return }
      academyId = data.academy.id
      resolvedAcademyName = data.academy.name
      setCreatedAcademy(data.academy)
    } else {
      // 2. 학원 코드로 가입
      if (!foundAcademy) { setError("먼저 학원 코드를 검색하여 학원을 확인해주세요."); return }
      academyId = foundAcademy.id
      resolvedAcademyName = foundAcademy.name
    }

    // 서버 API를 통해 이메일 인증 없이 즉시 가입
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: name,
        role: signupRole,
        academy_id: academyId,
        academy_name: resolvedAcademyName,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "회원가입에 실패했습니다."); return }

    if (data.autoLogin) {
      // 자동 로그인 성공 → 역할에 따라 이동
      router.push(signupRole === "director" ? "/admin" : "/")
      return
    }

    setMode("signup_done")
  }

  // ── Legacy 로그인 (Supabase 미설정 시) ──────────────────────────────────
  async function loginWithLegacy() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "로그인에 실패했습니다."); return }
    router.push(data.role === "admin" ? "/admin" : "/")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (mode === "signup") {
        await signUpWithSupabase()
      } else if (SUPABASE_CONFIGURED) {
        await loginWithSupabase()
      } else {
        await loginWithLegacy()
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex md:w-1/2 flex-col items-center justify-center p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #2A1F7A 0%, #3E2D9B 50%, #5A44C4 100%)" }}
      >
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/3 right-8 w-32 h-32 rounded-full opacity-5 bg-white" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0">
              <img src="/logo.png" alt="에듀마인 인사이트 로고" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <p className="text-white text-lg font-bold leading-tight">
                에듀마인 인사이트
                <br />
                <span className="text-white/80 text-sm font-medium tracking-wide">EduMind Insight</span>
              </p>
            </div>
          </div>

          <h1 className="text-white text-3xl font-bold leading-relaxed mb-4">
            상담의 데이터화,<br />학원의 자산이 됩니다
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm mx-auto">
            AI 기반 학부모 상담 감정 분석으로<br />이탈을 방지하고 신뢰를 쌓으세요.
          </p>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#F8F8FF] overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
              <img src="/logo.png" alt="에듀마인 인사이트 로고" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-gray-800">에듀마인 인사이트</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 p-8 border border-slate-100/50">

            {/* ── 회원가입 완료 ─────────────────────────────────────── */}
            {mode === "signup_done" ? (
              <div className="flex flex-col items-center text-center py-4 gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #3E2D9B, #5A44C4)" }}>
                  <HIcon icon={CheckmarkCircle01Icon} size={32} primary="white" secondary="rgba(255,255,255,0.6)" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">가입 완료!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-700">{email}</span>으로
                  <br />인증 메일을 발송했습니다.
                  <br />메일 링크를 클릭하면 계정이 활성화됩니다.
                </p>

                {/* 학원장: 생성된 학원 코드 표시 */}
                {createdAcademy && (
                  <div className="w-full p-4 rounded-2xl border-2 border-[#3E2D9B]/20 bg-[#F5F3FF] text-left">
                    <p className="text-xs font-semibold text-[#3E2D9B] mb-2">
                      🎉 {createdAcademy.name} 이(가) 생성되었습니다
                    </p>
                    <p className="text-xs text-gray-600 mb-3">선생님들에게 아래 초대 코드를 공유하세요:</p>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-[#3E2D9B]/20">
                      <span className="font-mono font-bold text-xl text-[#3E2D9B] tracking-widest">
                        {createdAcademy.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCode(createdAcademy.code)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#3E2D9B] hover:opacity-70 transition-opacity"
                      >
                        <HIcon icon={CopyLinkIcon} size={15} primary="#3E2D9B" secondary="#C4BEF0" />
                        {copiedCode ? "복사됨!" : "복사"}
                      </button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => switchMode("login")}
                  className="w-full h-12 rounded-2xl font-semibold text-base mt-2"
                  style={{ background: "#3E2D9B" }}
                >
                  <span className="flex items-center gap-2">
                    <HIcon icon={Login01Icon} size={18} primary="white" secondary="rgba(255,255,255,0.5)" />
                    로그인으로 돌아가기
                  </span>
                </Button>
              </div>
            ) : (
              <>
                {/* 카드 헤더 */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#3E2D9B" }}>
                    <HIcon
                      icon={mode === "signup" ? UserAdd01Icon : ShieldKeyIcon}
                      size={18} primary="white" secondary="rgba(255,255,255,0.5)"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {mode === "signup" ? "회원가입" : "로그인"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {mode === "signup" ? "새 계정을 만드세요" : "이메일로 접속하세요"}
                    </p>
                  </div>
                </div>

                {/* 로그인 / 회원가입 탭 */}
                <div className="flex rounded-2xl bg-slate-100 p-1 mb-6">
                  {(["login", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                        mode === m ? "bg-white text-[#3E2D9B] shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m === "login" ? "로그인" : "회원가입"}
                    </button>
                  ))}
                </div>

                {/* ── 회원가입 역할 선택 ─────────────────────────── */}
                {mode === "signup" && (
                  <div className="mb-5">
                    <Label className="text-sm font-semibold text-gray-700 block mb-2">역할 선택</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["director", "teacher"] as SignupRole[]).map((r) => {
                        const isActive = signupRole === r
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setSignupRole(r)
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
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 이름 (회원가입 전용) */}
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
                        이름 <span className="text-gray-400 font-normal">(선택)</span>
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <HIcon icon={Alert02Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                        </div>
                        <Input
                          id="name" type="text" value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="이름을 입력하세요"
                          className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                          autoComplete="name"
                        />
                      </div>
                    </div>
                  )}

                  {/* 이메일 */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-700">이메일</Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <HIcon icon={Mail01Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                      </div>
                      <Input
                        id="email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="이메일 주소를 입력하세요"
                        className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                        autoComplete="email" required
                      />
                    </div>
                  </div>

                  {/* 비밀번호 */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-700">비밀번호</Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <HIcon icon={LockKeyIcon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                      </div>
                      <Input
                        id="password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === "signup" ? "6자 이상 입력하세요" : "비밀번호를 입력하세요"}
                        className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                      />
                    </div>
                  </div>

                  {/* 비밀번호 확인 (회원가입 전용) */}
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                        비밀번호 확인
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <HIcon icon={LockKeyIcon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                        </div>
                        <Input
                          id="confirmPassword" type="password" value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="비밀번호를 다시 입력하세요"
                          className={`pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all ${
                            confirmPassword && password !== confirmPassword ? "border-red-300 bg-red-50" : ""
                          }`}
                          autoComplete="new-password" required
                        />
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-500 pl-1">비밀번호가 일치하지 않습니다.</p>
                      )}
                    </div>
                  )}

                  {/* ── 학원장: 학원 이름 ─────────────────────────── */}
                  {mode === "signup" && signupRole === "director" && (
                    <div className="space-y-2">
                      <Label htmlFor="academyName" className="text-sm font-semibold text-gray-700">
                        학원 이름 <span className="text-red-400">*</span>
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <HIcon icon={School01Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                        </div>
                        <Input
                          id="academyName" type="text" value={academyName}
                          onChange={(e) => setAcademyName(e.target.value)}
                          placeholder="예) 에듀마인 학원"
                          className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-400 pl-1">
                        가입 후 선생님에게 공유할 초대 코드가 자동 생성됩니다.
                      </p>
                    </div>
                  )}

                  {/* ── 선생님: 학원 코드 검색 ───────────────────── */}
                  {mode === "signup" && signupRole === "teacher" && (
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
                            id="academyCode" type="text" value={academyCode}
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

                      {/* 학원 검색 결과 */}
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

                  {/* 에러 메시지 */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
                      <HIcon icon={Alert02Icon} size={16} primary="#EF4444" secondary="#FCA5A5" />
                      <span className="text-red-600 text-sm leading-relaxed">{error}</span>
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
                        {mode === "signup" ? "가입 중..." : "로그인 중..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <HIcon
                          icon={mode === "signup" ? UserAdd01Icon : Login01Icon}
                          size={18} primary="white" secondary="rgba(255,255,255,0.5)"
                        />
                        {mode === "signup"
                          ? signupRole === "director" ? "학원 개설 & 가입" : "학원 합류 & 가입"
                          : "로그인"}
                      </span>
                    )}
                  </Button>
                </form>

                {/* 하단 링크 */}
                <p className="mt-5 text-xs text-center text-gray-400">
                  {mode === "signup" ? (
                    <>이미 계정이 있으신가요?{" "}
                      <button type="button" onClick={() => switchMode("login")}
                        className="font-semibold text-[#3E2D9B] hover:underline">로그인</button>
                    </>
                  ) : (
                    <>계정이 없으신가요?{" "}
                      <button type="button" onClick={() => switchMode("signup")}
                        className="font-semibold text-[#3E2D9B] hover:underline">회원가입</button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
