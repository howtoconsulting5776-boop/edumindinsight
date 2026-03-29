"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  LockKeyIcon,
  Login01Icon,
  ShieldKeyIcon,
  AiBrain01Icon,
  Alert02Icon,
  UserAdd01Icon,
  Mail01Icon,
  CheckmarkCircle01Icon,
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

// Detect whether Supabase env vars are available at build time.
// NEXT_PUBLIC_ vars are inlined by the bundler.
const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Mode = "login" | "signup" | "signup_done"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")

  // login fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // signup extra fields
  const [name, setName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function resetFields() {
    setEmail("")
    setPassword("")
    setName("")
    setConfirmPassword("")
    setError("")
  }

  function switchMode(next: Mode) {
    resetFields()
    setMode(next)
  }

  // ── Supabase login ──────────────────────────────────────────────────────
  async function loginWithSupabase() {
    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : authError.message
      )
      return
    }

    const roleRes = await fetch("/api/auth/role")
    const { isAdmin } = await roleRes.json()
    router.push(isAdmin ? "/admin" : "/")
    router.refresh()
  }

  // ── Supabase sign-up ────────────────────────────────────────────────────
  async function signUpWithSupabase() {
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.")
      return
    }

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    if (authError) {
      setError(
        authError.message === "User already registered"
          ? "이미 등록된 이메일입니다. 로그인을 시도해보세요."
          : authError.message
      )
      return
    }

    setMode("signup_done")
  }

  // ── Legacy (username/password) login ────────────────────────────────────
  async function loginWithLegacy() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "로그인에 실패했습니다.")
      return
    }
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

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex md:w-1/2 flex-col items-center justify-center p-16 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #2A1F7A 0%, #3E2D9B 50%, #5A44C4 100%)",
        }}
      >
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/3 right-8 w-32 h-32 rounded-full opacity-5 bg-white" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <HIcon
                icon={AiBrain01Icon}
                size={28}
                primary="white"
                secondary="rgba(255,255,255,0.5)"
              />
            </div>
            <div className="text-left">
              <p className="text-white/70 text-xs font-medium tracking-widest uppercase">
                하우투영어수학전문학원
              </p>
              <p className="text-white text-lg font-bold leading-tight">
                에듀마인 인사이트
                <br />
                <span className="text-white/80 text-sm font-medium tracking-wide">
                  EduMind Insight
                </span>
              </p>
            </div>
          </div>

          <h1 className="text-white text-3xl font-bold leading-relaxed mb-4">
            상담의 데이터화,
            <br />
            학원의 자산이 됩니다
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm mx-auto">
            AI 기반 학부모 상담 감정 분석으로
            <br />
            이탈을 방지하고 신뢰를 쌓으세요.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {["감정 분석", "이탈 위험도", "대응 스크립트", "RAG 지식베이스"].map(
              (f) => (
                <span
                  key={f}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/15"
                >
                  {f}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#F8F8FF]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#3E2D9B" }}
            >
              <HIcon
                icon={AiBrain01Icon}
                size={20}
                primary="white"
                secondary="rgba(255,255,255,0.5)"
              />
            </div>
            <span className="font-bold text-gray-800">에듀마인 인사이트</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 p-8 border border-slate-100/50 backdrop-blur-xl">

            {/* ── 회원가입 완료 화면 ───────────────────────────── */}
            {mode === "signup_done" ? (
              <div className="flex flex-col items-center text-center py-6 gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #3E2D9B, #5A44C4)" }}
                >
                  <HIcon
                    icon={CheckmarkCircle01Icon}
                    size={32}
                    primary="white"
                    secondary="rgba(255,255,255,0.6)"
                  />
                </div>
                <h2 className="text-xl font-bold text-gray-900">가입 완료!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-700">{email}</span>로
                  <br />
                  인증 메일을 발송했습니다.
                  <br />
                  메일의 링크를 클릭하면 계정이 활성화됩니다.
                </p>
                <div className="w-full mt-2 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-left">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    📌 관리자 권한이 필요하면 <span className="font-semibold">.env.local</span>의{" "}
                    <span className="font-mono font-semibold">ADMIN_EMAIL</span>에 이 이메일을 등록해주세요.
                  </p>
                </div>
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
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "#3E2D9B" }}
                  >
                    <HIcon
                      icon={mode === "signup" ? UserAdd01Icon : ShieldKeyIcon}
                      size={18}
                      primary="white"
                      secondary="rgba(255,255,255,0.5)"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {mode === "signup" ? "회원가입" : "로그인"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {mode === "signup"
                        ? "새 계정을 만드세요"
                        : SUPABASE_CONFIGURED
                        ? "이메일로 접속하세요"
                        : "계정으로 접속하세요"}
                    </p>
                  </div>
                </div>

                {/* 탭 토글 (Supabase 모드에서만) */}
                {SUPABASE_CONFIGURED && (
                  <div className="flex rounded-2xl bg-slate-100 p-1 mb-6">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                        mode === "login"
                          ? "bg-white text-[#3E2D9B] shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      로그인
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                        mode === "signup"
                          ? "bg-white text-[#3E2D9B] shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      회원가입
                    </button>
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
                          id="name"
                          type="text"
                          value={name}
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
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                      {SUPABASE_CONFIGURED ? "이메일" : "아이디"}
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <HIcon icon={Mail01Icon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                      </div>
                      <Input
                        id="email"
                        type={SUPABASE_CONFIGURED ? "email" : "text"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={SUPABASE_CONFIGURED ? "이메일 주소를 입력하세요" : "아이디를 입력하세요"}
                        className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all"
                        autoComplete={SUPABASE_CONFIGURED ? "email" : "username"}
                        required
                      />
                    </div>
                  </div>

                  {/* 비밀번호 */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                      비밀번호
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <HIcon icon={LockKeyIcon} size={17} primary="#9CA3AF" secondary="#C4BEF0" />
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
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
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="비밀번호를 다시 입력하세요"
                          className={`pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] transition-all ${
                            confirmPassword && password !== confirmPassword
                              ? "border-red-300 bg-red-50"
                              : ""
                          }`}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-500 pl-1">비밀번호가 일치하지 않습니다.</p>
                      )}
                    </div>
                  )}

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
                          size={18}
                          primary="white"
                          secondary="rgba(255,255,255,0.5)"
                        />
                        {mode === "signup" ? "계정 만들기" : "로그인"}
                      </span>
                    )}
                  </Button>
                </form>

                {/* 하단 보조 링크 */}
                {SUPABASE_CONFIGURED ? (
                  <p className="mt-5 text-xs text-center text-gray-400">
                    {mode === "signup" ? (
                      <>
                        이미 계정이 있으신가요?{" "}
                        <button
                          type="button"
                          onClick={() => switchMode("login")}
                          className="font-semibold text-[#3E2D9B] hover:underline"
                        >
                          로그인
                        </button>
                      </>
                    ) : (
                      <>
                        계정이 없으신가요?{" "}
                        <button
                          type="button"
                          onClick={() => switchMode("signup")}
                          className="font-semibold text-[#3E2D9B] hover:underline"
                        >
                          회원가입
                        </button>
                      </>
                    )}
                  </p>
                ) : (
                  <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">테스트 계정</p>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">관리자</span> — admin / edumind2024
                      </p>
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">강사</span> — teacher / howto2024
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
