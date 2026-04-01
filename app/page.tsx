"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  Alert02Icon,
  Analytics01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  BulbIcon,
  CheckmarkCircle01Icon,
  Comment01Icon,
  DashboardCircleIcon,
  FavouriteIcon,
  FileEditIcon,
  FlashIcon,
  LabelIcon,
  LockKeyIcon,
  MagicWand01Icon,
  AlertDiamondIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UsageMeter } from "@/components/UsageMeter"
import { ScoreLineChart } from "@/components/ScoreLineChart"
import type { AnalysisMode, AnalysisResult } from "@/app/api/analyze/route"

interface UsageData {
  used: number
  limit: number | null
  remaining: number | null
  percent: number
  plan: string
  signup_method?: "email" | "google" | "kakao"
}

interface StudentOption {
  id: string
  name: string
  grade?: string
  status: string
}

// ── Hugeicons wrapper — duotone brand colors ────────────────────────────────
function HIcon({
  icon,
  size = 20,
  primary = "#3E2D9B",
  secondary = "#C4BEF0",
  className = "",
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  size?: number
  primary?: string
  secondary?: string
  className?: string
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      primaryColor={primary}
      secondaryColor={secondary}
      className={className}
    />
  )
}

// ── Brand palette ───────────────────────────────────────────────────────────
// Primary  : #3E2D9B  deep purple
// Lime     : #94C21F  accent green
// Orange   : #F58753  warm orange
// BG       : #F0EFFB  lavender-gray page background
// Card     : #FFFFFF

// ── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({
  value,
  size = 130,
  strokeWidth = 12,
  color = "#3E2D9B",
  trackColor = "#E8E5FF",
  label,
  sublabel,
  valueSize = "text-3xl",
}: {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label: string
  sublabel?: string
  valueSize?: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(value, 100) / 100)

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
          overflow="visible"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.3, ease: [0.34, 1.06, 0.64, 1] }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={`font-extrabold leading-none tracking-tight text-slate-900 ${valueSize}`}>
            {value}%
          </span>
          {sublabel && (
            <span className="text-[10px] font-semibold text-slate-400">{sublabel}</span>
          )}
        </div>
      </div>
      <span className="text-sm font-bold text-slate-600">{label}</span>
    </div>
  )
}

type HugeIconData = Parameters<typeof HugeiconsIcon>[0]["icon"]

const STATUS_STEPS: Record<AnalysisMode, { icon: HugeIconData; message: string }[]> = {
  general: [
    { icon: LockKeyIcon, message: "데이터 비식별화 및 보안 처리 중..." },
    { icon: MagicWand01Icon, message: "AI 감정 분석 모델 가동 중..." },
    { icon: Analytics01Icon, message: "이탈 위험도 및 감정 수치 계산 중..." },
    { icon: FileEditIcon, message: "대응 스크립트 생성 중..." },
  ],
  deep: [
    { icon: LockKeyIcon, message: "데이터 비식별화 및 보안 처리 중..." },
    { icon: FlashIcon, message: "전문가 심층 분석 모델 가동 중..." },
    { icon: AiBrain01Icon, message: "5개 심리 레이어 행간 분석 중..." },
    { icon: Comment01Icon, message: "이탈 신호 패턴 추출 중..." },
    { icon: FileEditIcon, message: "전략적 대응 스크립트 생성 중..." },
  ],
}

const SCRIPT_META: Record<
  string,
  { bg: string; border: string; badgeBg: string; badgeText: string; primary: string; secondary: string; icon: HugeIconData }
> = {
  공감형: {
    bg: "bg-[#EEF0FF]",
    border: "border-[#C7CAFF]",
    badgeBg: "bg-[#3E2D9B]",
    badgeText: "text-white",
    primary: "#3E2D9B",
    secondary: "#C4BEF0",
    icon: FavouriteIcon,
  },
  원칙형: {
    bg: "bg-[#FFF5EF]",
    border: "border-[#FFD4B8]",
    badgeBg: "bg-[#F58753]",
    badgeText: "text-white",
    primary: "#F58753",
    secondary: "#FFD4B8",
    icon: BookOpen01Icon,
  },
  대안제시형: {
    bg: "bg-[#F2FAE6]",
    border: "border-[#C9E98B]",
    badgeBg: "bg-[#94C21F]",
    badgeText: "text-white",
    primary: "#94C21F",
    secondary: "#D4EDAA",
    icon: BulbIcon,
  },
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">매우 위험</span>
  if (score >= 45) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-600">주의 필요</span>
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-600">안정</span>
}

function ScriptCard({ script }: { script: AnalysisResult["scripts"][0] }) {
  const meta = SCRIPT_META[script.type] ?? SCRIPT_META["공감형"]
  return (
    <div className={`rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <HIcon icon={meta.icon} size={22} primary={meta.primary} secondary={meta.secondary} />
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.badgeBg} ${meta.badgeText}`}>
          {script.type}
        </span>
        <span className="text-xs text-slate-400">{script.subtitle}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{script.content}</p>
    </div>
  )
}

// ── Section card wrapper ────────────────────────────────────────────────────
function SectionCard({
  icon,
  primary = "#3E2D9B",
  secondary = "#C4BEF0",
  title,
  children,
}: {
  icon: HugeIconData
  primary?: string
  secondary?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl bg-white p-7 shadow-xl shadow-slate-200/60">
      <div className="mb-6 flex items-center gap-3">
        <HIcon icon={icon} size={28} primary={primary} secondary={secondary} />
        <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [text, setText] = useState("")
  const [mode, setMode] = useState<AnalysisMode>("general")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [statusStep, setStatusStep] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [chartRefreshToken, setChartRefreshToken] = useState(0)
  const [usedModel, setUsedModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // 학생 선택 + 상담대상 선택
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>("none")
  const [contactType, setContactType] = useState<string>("student")

  useEffect(() => {
    if (!isAnalyzing) return
    setStatusStep(0)
    const steps = STATUS_STEPS[mode]
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % steps.length
      setStatusStep(idx)
    }, 900)
    return () => clearInterval(interval)
  }, [isAnalyzing, mode])

  useEffect(() => {
    if (retryCountdown === null) return
    if (retryCountdown <= 0) { setRetryCountdown(null); return }
    const t = setTimeout(() => setRetryCountdown((n) => (n ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [retryCountdown])

  useEffect(() => {
    if (result) setTimeout(() => rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100)
  }, [result])

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((data: UsageData | null) => { if (data) setUsageData(data) })
      .catch(() => {/* 사용량 조회 실패 시 UI를 차단하지 않음 */})

    // 학생 목록 조회 (에러 시 무시 — 로그인 전 or 권한 없는 경우)
    fetch("/api/students?status=active&limit=100")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.students) {
          setStudents(data.students.map((s: StudentOption) => ({ id: s.id, name: s.name, grade: s.grade, status: s.status })))
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const handleAnalyze = async () => {
    if (!text.trim() || isAnalyzing || (retryCountdown !== null && retryCountdown > 0)) return
    setIsAnalyzing(true)
    setResult(null)
    setError(null)
    setUsedModel(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          mode,
          studentId: selectedStudentId !== "none" ? selectedStudentId : null,
          contactType,
        }),
        signal: controller.signal,
      })

      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setError(`응답 파싱 오류 (HTTP ${res.status}). 서버 응답이 올바르지 않습니다.`)
        return
      }

      if (res.status === 429) {
        setError(data.error as string ?? "잠시 후 다시 시도해주세요.")
        setRetryCountdown((data.retryAfter as number) ?? 30)
      } else if (res.status === 503) {
        setError(data.error as string ?? "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.")
      } else if (!res.ok) {
        setError(data.error as string ?? "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      } else {
        setResult(data.result as AnalysisResult)
        setUsedModel(data.model as string)
        setChartRefreshToken((t) => t + 1)
        // 분석 성공 후 사용량 미터 갱신
        fetch("/api/usage")
          .then((r) => r.ok ? r.json() : null)
          .then((d: UsageData | null) => { if (d) setUsageData(d) })
          .catch(() => {})
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("분석 시간이 초과되었습니다 (2분). 잠시 후 다시 시도해주세요.")
      } else {
        setError("네트워크 오류가 발생했습니다. Wi-Fi 연결을 확인해주세요.")
      }
    } finally {
      clearTimeout(timeoutId)
      setIsAnalyzing(false)
    }
  }

  const currentSteps = STATUS_STEPS[mode]

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden font-sans"
      style={{ backgroundColor: "#F0EFFB" }}>

      {/* ════════════════════════════════════════════
          LEFT PANEL — Input (white)
      ════════════════════════════════════════════ */}
      <div className="flex flex-col border-b border-slate-200/60 bg-white md:w-[40%] md:border-b-0 md:border-r md:h-screen md:overflow-y-auto">
        <div className="flex flex-1 flex-col p-6 md:p-10">

          {/* Brand */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-[1.75rem] md:leading-snug">
                  에듀마인 인사이트<br /><span className="text-[#3E2D9B]">EduMind Insight</span>
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  데이터로 읽는 학부모의 마음,<br className="hidden md:block" /> 더 정교한 교육 로드맵의 시작.
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-1 flex flex-col gap-2 shrink-0">
                <a
                  href="/admin"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "6px", borderRadius: "16px", border: "1px solid #C4BEF0", background: "#F0EFFB", padding: "8px 12px", fontSize: "12px", fontWeight: 500, color: "#3E2D9B", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
                >
                  <HIcon icon={DashboardCircleIcon} size={14} primary="#3E2D9B" secondary="#C4BEF0" />
                  지식 대시보드
                </a>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="로그아웃"
                  className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <HIcon
                    icon={Logout01Icon}
                    size={14}
                    primary={loggingOut ? "#9CA3AF" : "#EF4444"}
                    secondary={loggingOut ? "#D1D5DB" : "#FCA5A5"}
                  />
                  {loggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            </div>
          </div>

          {usageData && (
            <div className="mb-5">
              <UsageMeter
                used={usageData.used}
                limit={usageData.limit}
                remaining={usageData.remaining}
                percent={usageData.percent}
                plan={usageData.plan}
                signupMethod={usageData.signup_method}
              />
            </div>
          )}

          <div className="flex flex-1 flex-col gap-5">
            {/* 학생 선택 + 상담대상 선택 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">학생 선택</label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-[#F8F8FF] text-xs focus:border-[#3E2D9B]">
                    <SelectValue placeholder="학생 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="none" className="rounded-xl text-xs">선택 안 함</SelectItem>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="rounded-xl text-xs">
                        {s.name}{s.grade ? ` (${s.grade})` : ""}
                      </SelectItem>
                    ))}
                    {students.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">
                        등록된 학생이 없습니다
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">상담 대상</label>
                <Select value={contactType} onValueChange={setContactType}>
                  <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-[#F8F8FF] text-xs focus:border-[#3E2D9B]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="student" className="rounded-xl text-xs">학생</SelectItem>
                    <SelectItem value="father"  className="rounded-xl text-xs">아버지</SelectItem>
                    <SelectItem value="mother"  className="rounded-xl text-xs">어머니</SelectItem>
                    <SelectItem value="guardian" className="rounded-xl text-xs">보호자</SelectItem>
                    <SelectItem value="other"   className="rounded-xl text-xs">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <HIcon icon={FileEditIcon} size={14} primary="#64748b" secondary="#C4BEF0" />
                상담 내용
              </label>
              <Textarea
                placeholder={`학부모와 나눈 상담 내용을 입력하세요.\n예) "우리 아이 성적이 왜 이렇게 안 오르죠? 다른 학원 친구들은 다 올랐다던데..."`}
                className="min-h-40 resize-none rounded-2xl border-slate-200 bg-[#F8F8FF] text-sm leading-relaxed shadow-none focus-visible:border-[#3E2D9B] focus-visible:ring-[#3E2D9B]/20 md:min-h-52"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            {/* Mode selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500">분석 모드</label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as AnalysisMode)}>
                <TabsList className="w-full rounded-xl bg-[#F0EFFB]">
                  <TabsTrigger value="general" className="flex-1 gap-1.5 text-xs data-active:bg-white data-active:text-[#3E2D9B] data-active:font-bold">
                    <HIcon icon={MagicWand01Icon} size={13} primary="#3E2D9B" secondary="#C4BEF0" />일반 상담
                  </TabsTrigger>
                  <TabsTrigger value="deep" className="flex-1 gap-1.5 text-xs data-active:bg-white data-active:text-[#3E2D9B] data-active:font-bold">
                    <HIcon icon={FlashIcon} size={13} primary="#3E2D9B" secondary="#C4BEF0" />심층 분석
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                  <p className="mt-2 text-xs text-slate-400">빠르고 실용적인 분석 — temperature 0.7</p>
                </TabsContent>
                <TabsContent value="deep">
                  <p className="mt-2 text-xs text-slate-400">McKinsey급 심리 프레임워크 — temperature 0.3</p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !text.trim() || (retryCountdown !== null && retryCountdown > 0)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#3E2D9B", boxShadow: "0 8px 24px rgba(62,45,155,0.30)" }}
            >
              {isAnalyzing ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {currentSteps[statusStep]?.message}
                </>
              ) : retryCountdown !== null && retryCountdown > 0 ? (
                <>{retryCountdown}초 후 재시도 가능</>
              ) : (
                <>
                  <HIcon icon={Analytics01Icon} size={18} primary="white" secondary="rgba(255,255,255,0.5)" />
                  상담 내용 분석하기
                </>
              )}
            </button>

            {/* Loading steps */}
            {isAnalyzing && (
              <div className="space-y-2 rounded-2xl bg-[#F0EFFB] p-4">
                {currentSteps.map((step, i) => {
                  const done = i < statusStep
                  const active = i === statusStep
                  return (
                    <div key={i} className={`flex items-center gap-2 text-xs transition-all ${
                      active ? "font-bold text-[#3E2D9B]" : done ? "text-[#94C21F]" : "text-slate-300"
                    }`}>
                      {done ? (
                        <HIcon icon={CheckmarkCircle01Icon} size={14} primary="#94C21F" secondary="#D4EDAA" />
                      ) : active ? (
                        <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#3E2D9B]/20 border-t-[#3E2D9B]" />
                      ) : (
                        <HIcon icon={step.icon} size={14} primary="#cbd5e1" secondary="#e2e8f0" />
                      )}
                      {step.message}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          RIGHT PANEL — Results (lavender bg)
      ════════════════════════════════════════════ */}
      <div
        ref={rightPanelRef}
        className="flex-1 p-5 md:h-screen md:overflow-y-auto md:p-10"
        style={{ backgroundColor: "#F0EFFB" }}
      >
        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-8 rounded-3xl border-0 shadow-xl">
            <HIcon icon={AlertDiamondIcon} size={16} primary="#dc2626" secondary="#fecaca" />
            <AlertTitle>분석 실패</AlertTitle>
            <AlertDescription className="space-y-1.5">
              <p className="whitespace-pre-line">{error}</p>
              {retryCountdown !== null && retryCountdown > 0 && (
                <p className="font-bold">{retryCountdown}초 후 재시도하실 수 있습니다.</p>
              )}
              {retryCountdown === 0 && (
                <button className="font-bold underline" onClick={handleAnalyze}>
                  지금 다시 분석하기 →
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {!result && !isAnalyzing && !error && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#C4BEF0] p-10 text-center md:min-h-[calc(100vh-80px)]">
            <div className="mb-4 rounded-full p-5" style={{ backgroundColor: "#E8E5FF" }}>
              <HIcon icon={AiBrain01Icon} size={40} primary="#3E2D9B" secondary="#C4BEF0" />
            </div>
            <p className="text-base font-bold text-slate-600">상담 내용을 입력하고</p>
            <p className="mt-1 text-sm text-slate-400">분석 버튼을 눌러주세요</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-800">분석 결과</h2>
              <div className="flex items-center gap-2">
                {usedModel && (
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-slate-400 shadow-sm">
                    {usedModel}
                  </span>
                )}
                <span className="rounded-full px-3 py-1 text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: "#3E2D9B" }}>
                  {mode === "deep" ? "심층" : "일반"} 분석
                </span>
              </div>
            </div>

            {/* ── 1. 감정 온도계 ── */}
            <SectionCard icon={Analytics01Icon} title="감정 온도계">
              <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-6">

                {/* Left — big risk ring */}
                <div className="flex flex-col items-center gap-3">
                  <CircularProgress
                    value={result.riskScore}
                    size={158}
                    strokeWidth={14}
                    color={result.riskScore >= 70 ? "#e53e3e" : result.riskScore >= 45 ? "#d97706" : "#94C21F"}
                    trackColor={result.riskScore >= 70 ? "#fee2e2" : result.riskScore >= 45 ? "#fef3c7" : "#EAF5C8"}
                    label="이탈 위험도"
                    sublabel={result.riskScore >= 70 ? "매우 위험" : result.riskScore >= 45 ? "주의 필요" : "안정"}
                    valueSize="text-4xl"
                  />
                  {result.riskScore >= 70 && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-red-500">
                      <HIcon icon={Alert02Icon} size={14} primary="#dc2626" secondary="#fecaca" />
                      즉각 대응 필요
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden h-40 w-px bg-slate-100 sm:block self-center" />
                <div className="h-px w-full bg-slate-100 sm:hidden" />

                {/* Right — two small rings */}
                <div className="flex flex-1 items-center justify-center gap-8 sm:gap-6 sm:justify-start">
                  <div className="flex flex-col items-center gap-1">
                    <CircularProgress
                      value={result.positiveScore}
                      size={110}
                      strokeWidth={11}
                      color="#94C21F"
                      trackColor="#EAF5C8"
                      label="긍정 수치"
                      sublabel="Positive"
                      valueSize="text-2xl"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <CircularProgress
                      value={result.negativeScore}
                      size={110}
                      strokeWidth={11}
                      color="#718096"
                      trackColor="#E2E8F0"
                      label="부정 수치"
                      sublabel="Negative"
                      valueSize="text-2xl"
                    />
                  </div>
                </div>

              </div>
            </SectionCard>

            {/* ── 2. 분석 추세 ── */}
            <SectionCard icon={Analytics01Icon} title="분석 추세">
              <ScoreLineChart
                studentId={selectedStudentId !== "none" ? selectedStudentId : null}
                refreshToken={chartRefreshToken}
              />
            </SectionCard>

            {/* ── 3. 핵심 키워드 ── */}
            <SectionCard icon={LabelIcon} title="핵심 키워드">
              <div className="flex flex-wrap gap-2.5">
                {result.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                    style={{ backgroundColor: "#3E2D9B" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </SectionCard>

            {/* ── 4. AI 심리 분석 ── */}
            <SectionCard icon={AiBrain01Icon} title="AI 심리 분석">
              <div className="rounded-2xl p-5" style={{ backgroundColor: "#EEF0FF" }}>
                <div className="mb-2 flex items-center gap-2">
                  <HIcon icon={Comment01Icon} size={16} primary="#3E2D9B" secondary="#C4BEF0" />
                  <span className="text-sm font-bold" style={{ color: "#3E2D9B" }}>학부모 숨은 의도</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{result.hiddenIntent}</p>
              </div>
            </SectionCard>

            {/* ── 5. 대응 스크립트 ── */}
            <SectionCard icon={BulbIcon} title="대응 스크립트 3종">
              <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <HIcon icon={ArrowRight01Icon} size={13} primary="#94a3b8" secondary="#cbd5e1" />
                바로 복사해서 사용할 수 있는 구어체 스크립트
              </p>

              {/* Mobile: Tabs */}
              <div className="md:hidden">
                <Tabs defaultValue="공감형">
                  <TabsList className="mb-4 w-full rounded-xl bg-[#F0EFFB]">
                    {result.scripts.map((s) => (
                      <TabsTrigger key={s.type} value={s.type} className="flex-1 text-xs">
                        {s.type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {result.scripts.map((s) => (
                    <TabsContent key={s.type} value={s.type}>
                      <ScriptCard script={s} />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Desktop: stacked */}
              <div className="hidden space-y-4 md:flex md:flex-col">
                {result.scripts.map((s) => (
                  <ScriptCard key={s.type} script={s} />
                ))}
              </div>
            </SectionCard>

            {/* ── 6. 강사 위로 한마디 ── */}
            <div
              className="relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-2xl"
              style={{
                backgroundColor: "#3E2D9B",
                boxShadow: "0 20px 60px rgba(62,45,155,0.40)",
              }}
            >
              {/* Decorative circles */}
              <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-10"
                style={{ backgroundColor: "#94C21F" }} />
              <div className="pointer-events-none absolute -bottom-8 -left-8 size-36 rounded-full opacity-10"
                style={{ backgroundColor: "#F58753" }} />

              <div className="relative">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full p-4" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <HIcon icon={FavouriteIcon} size={24} primary="white" secondary="rgba(255,255,255,0.5)" />
                  </div>
                </div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
                  강사님께 드리는 응원
                </p>
                <p className="mt-3 text-base font-bold leading-relaxed">
                  오늘 하루도 정말 수고 많으셨습니다 💙
                </p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {result.encouragement}
                </p>
                <div className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold"
                  style={{ color: "rgba(255,255,255,0.50)" }}>
                  <HIcon icon={CheckmarkCircle01Icon} size={14} primary="rgba(255,255,255,0.6)" secondary="rgba(255,255,255,0.2)" />
                  이 상담도 잘 해내실 수 있습니다
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
