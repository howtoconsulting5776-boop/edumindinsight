"use client"

import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
  AlertDiamondIcon,
  UserGroupIcon,
  Calendar01Icon,
  ChartHistogramIcon,
  ArrowRight01Icon,
  Tag01Icon,
  ArrowLeft01Icon,
  Group01Icon,
} from "@hugeicons/core-free-icons"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts"

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

// ── 타입 ────────────────────────────────────────────────────────────────────
interface RiskStudent {
  id: string
  name: string
  grade: string | null
  school: string | null
  riskScore: number
  lastContactedAt: string | null
  daysAgo: number | null
  riskTrend: "상승" | "하락" | "유지" | "첫기록"
  recentKeywords: string[]
  recentContactType: string | null
}

interface ReportData {
  period:   { from: string; to: string; days: number }
  summary: {
    totalStudents:      number
    thisMonthSessions:  number
    avgRiskScore:       number
    highRiskCount:      number
    longAbsentCount:    number
  }
  riskStudents: {
    high:       RiskStudent[]
    medium:     RiskStudent[]
    longAbsent: RiskStudent[]
  }
  trend: { date: string; count: number; avgRisk: number }[]
  keywords: { word: string; count: number }[]
  contactTypeStats: Record<string, number>
  studentStatusStats: { active: number; prospect: number; inactive: number; withdrawn: number }
  teacherStats: {
    teacherId: string; email: string; sessionCount: number; studentCount: number; avgRisk: number
  }[]
}

// ── 색상 ────────────────────────────────────────────────────────────────────
const RISK_BG:  Record<string, string> = {
  "상승":  "#FEF2F2",
  "하락":  "#F0FDF4",
  "유지":  "#FAFAF9",
  "첫기록": "#EFF6FF",
}
const RISK_TEXT: Record<string, string> = {
  "상승":  "#DC2626",
  "하락":  "#16A34A",
  "유지":  "#6B7280",
  "첫기록": "#2563EB",
}

const CONTACT_LABEL: Record<string, string> = {
  student: "학생",
  father:  "아버지",
  mother:  "어머니",
  other:   "기타",
  unknown: "미분류",
}
const CONTACT_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#6B7280"]

// ── 위험도 뱃지 ──────────────────────────────────────────────────────────────
function RiskBadge({ score }: { score: number }) {
  const { label, bg, text } =
    score >= 70 ? { label: "고위험", bg: "#FEF2F2", text: "#DC2626" }
    : score >= 40 ? { label: "주의",   bg: "#FFFBEB", text: "#D97706" }
    : { label: "안정",   bg: "#F0FDF4", text: "#16A34A" }

  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  )
}

// ── 위험 학생 카드 ───────────────────────────────────────────────────────────
function RiskStudentCard({ s, rank }: { s: RiskStudent; rank: number }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-red-100 transition-colors">
      {/* 순위 */}
      <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 text-xs font-bold mt-0.5">
        {rank}
      </span>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800">{s.name}</span>
          {s.grade && <span className="text-xs text-slate-500">{s.grade}</span>}
          {s.school && <span className="text-xs text-slate-400 truncate max-w-[100px]">{s.school}</span>}
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <RiskBadge score={s.riskScore} />
          <span className="text-xs font-semibold text-slate-700">{s.riskScore}점</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: RISK_BG[s.riskTrend], color: RISK_TEXT[s.riskTrend] }}
          >
            {s.riskTrend}
          </span>
          {s.daysAgo !== null && (
            <span className="text-xs text-slate-400">
              {s.daysAgo === 0 ? "오늘" : `${s.daysAgo}일 전`} 상담
            </span>
          )}
          {s.recentContactType && (
            <span className="text-xs text-slate-400">
              ({CONTACT_LABEL[s.recentContactType] ?? s.recentContactType})
            </span>
          )}
        </div>

        {s.recentKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {s.recentKeywords.map((kw) => (
              <span key={kw} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 섹션 카드 ────────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children, accent }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div
      className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/60"
      style={accent ? { borderTop: `4px solid ${accent}` } : {}}
    >
      <div className="flex items-center gap-2 mb-5">
        {icon}
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── 스켈레톤 ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
type RiskTab = "high" | "medium" | "longAbsent"

export default function AcademyReportPage() {
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [days,    setDays]    = useState(30)
  const [riskTab, setRiskTab] = useState<RiskTab>("high")

  const fetchReport = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/report/academy?days=${d}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "서버 오류")
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport(days) }, [days, fetchReport])

  // ── 연락 유형 차트 데이터 ──────────────────────────────────────────────
  const contactPieData = data
    ? Object.entries(data.contactTypeStats).map(([k, v]) => ({
        name:  CONTACT_LABEL[k] ?? k,
        value: v,
      }))
    : []

  const riskStudentList = data?.riskStudents[riskTab] ?? []
  const riskTabLabel: Record<RiskTab, string> = {
    high:       `고위험 (${data?.riskStudents.high.length ?? 0})`,
    medium:     `주의 (${data?.riskStudents.medium.length ?? 0})`,
    longAbsent: `장기 미상담 (${data?.riskStudents.longAbsent.length ?? 0})`,
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">학원장 보고서</h1>
          <p className="text-sm text-slate-500 mt-1">
            학원 전체 상담 현황과 위험 학생 명단을 확인할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 기간 선택 */}
          <div className="flex gap-1.5">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                style={
                  days === d
                    ? { background: "#3E2D9B", color: "#fff", borderColor: "#3E2D9B" }
                    : { background: "#fff", color: "#64748B", borderColor: "#E2E8F0" }
                }
              >
                {d}일
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchReport(days)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <HIcon icon={ArrowLeft01Icon} size={13} primary="#64748B" />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 요약 카드 ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : data ? ([
          {
            label:  "전체 활성 학생",
            value:  `${data.summary.totalStudents}명`,
            icon:   <HIcon icon={UserGroupIcon} size={20} primary="#3E2D9B" />,
            color:  "#EDE9FE",
          },
          {
            label:  `${days}일 상담 건수`,
            value:  `${data.summary.thisMonthSessions}건`,
            icon:   <HIcon icon={Calendar01Icon} size={20} primary="#0EA5E9" />,
            color:  "#E0F2FE",
          },
          {
            label:  "평균 위험도",
            value:  `${data.summary.avgRiskScore}점`,
            icon:   <HIcon icon={ChartHistogramIcon} size={20} primary="#F59E0B" />,
            color:  "#FEF3C7",
          },
          {
            label:  "고위험 학생",
            value:  `${data.summary.highRiskCount}명`,
            icon:   <HIcon icon={AlertDiamondIcon} size={20} primary="#EF4444" />,
            color:  "#FEE2E2",
          },
          {
            label:  "장기 미상담",
            value:  `${data.summary.longAbsentCount}명`,
            icon:   <HIcon icon={ArrowRight01Icon} size={20} primary="#6B7280" />,
            color:  "#F1F5F9",
          },
        ] as const).map((item) => (
          <div
            key={item.label}
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: item.color }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">{item.label}</span>
              {item.icon}
            </div>
            <span className="text-2xl font-extrabold text-slate-800">{item.value}</span>
          </div>
        )) : null}
      </div>

      {/* ── 위험 학생 명단 (메인 강조 섹션) ────────────────────────────────── */}
      <SectionCard
        title="위험 학생 명단"
        icon={<HIcon icon={AlertDiamondIcon} size={20} primary="#DC2626" />}
        accent="#EF4444"
      >
        {/* 탭 */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(["high", "medium", "longAbsent"] as RiskTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setRiskTab(tab)}
              className="text-xs px-4 py-1.5 rounded-full border font-semibold transition-colors"
              style={
                riskTab === tab
                  ? { background: "#EF4444", color: "#fff", borderColor: "#EF4444" }
                  : { background: "#fff", color: "#64748B", borderColor: "#E2E8F0" }
              }
            >
              {riskTabLabel[tab]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : riskStudentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <HIcon icon={UserGroupIcon} size={40} primary="#CBD5E1" />
            <p className="mt-3 text-sm">
              {riskTab === "high"       ? "고위험 학생이 없습니다. 잘 유지되고 있어요!" :
               riskTab === "medium"     ? "주의 학생이 없습니다." :
               "30일 이상 미상담 학생이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {riskStudentList.map((s, i) => (
              <RiskStudentCard key={s.id} s={s} rank={i + 1} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── 중간 2열 ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 상담 추이 */}
        <SectionCard
          title="상담 추이"
          icon={<HIcon icon={Analytics01Icon} size={20} primary="#3E2D9B" />}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : (data?.trend ?? []).length < 2 ? (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">
              상담 기록이 쌓이면 추이를 확인할 수 있습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data!.trend} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ReTooltip
                  contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                  formatter={(val, name) =>
                    [val, name === "count" ? "상담 건수" : "평균 위험도"] as [typeof val, string]}
                />
                <Line dataKey="count"   stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} name="count"   />
                <Line dataKey="avgRisk" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="avgRisk" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-end">
            {[{ color: "#8B5CF6", label: "상담 건수" }, { color: "#EF4444", label: "평균 위험도" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: l.color }} />
                <span className="text-[11px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 상담 대상별 분포 */}
        <SectionCard
          title="상담 대상 분포"
          icon={<HIcon icon={UserGroupIcon} size={20} primary="#3E2D9B" />}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : contactPieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">
              데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contactPieData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ReTooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                <Bar dataKey="value" name="건수" radius={[6, 6, 0, 0]}>
                  {contactPieData.map((_, i) => (
                    <Cell key={i} fill={CONTACT_COLORS[i % CONTACT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* ── 하단 2열 ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 키워드 순위 */}
        <SectionCard
          title="상위 키워드"
          icon={<HIcon icon={Tag01Icon} size={20} primary="#3E2D9B" />}
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7" />)}
            </div>
          ) : (data?.keywords ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              키워드 데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {(data!.keywords).slice(0, 10).map((kw, i) => {
                const max   = data!.keywords[0].count
                const width = Math.max(Math.round((kw.count / max) * 100), 4)
                return (
                  <div key={kw.word} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-slate-400 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700">{kw.word}</span>
                        <span className="text-xs text-slate-400">{kw.count}회</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, background: "#8B5CF6" }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* 선생님별 현황 */}
        <SectionCard
          title="선생님별 상담 현황"
          icon={<HIcon icon={Group01Icon} size={20} primary="#3E2D9B" />}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : (data?.teacherStats ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              선생님 데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="text-left py-2 font-medium">선생님</th>
                    <th className="text-right py-2 font-medium">상담수</th>
                    <th className="text-right py-2 font-medium">학생수</th>
                    <th className="text-right py-2 font-medium">평균위험도</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.teacherStats.map((t) => (
                    <tr key={t.teacherId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 font-medium text-slate-700 max-w-[140px] truncate">
                        {t.email}
                      </td>
                      <td className="py-2 text-right text-slate-700">{t.sessionCount}건</td>
                      <td className="py-2 text-right text-slate-700">{t.studentCount}명</td>
                      <td className="py-2 text-right">
                        <span
                          className="font-semibold"
                          style={{ color: t.avgRisk >= 70 ? "#DC2626" : t.avgRisk >= 40 ? "#D97706" : "#16A34A" }}
                        >
                          {t.avgRisk}점
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
