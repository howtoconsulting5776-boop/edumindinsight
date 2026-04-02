"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Legend,
} from "recharts"

interface ScorePoint {
  date: string
  riskScore: number
  positiveScore: number
  negativeScore: number
}

interface Props {
  academyId?: string | null
  studentId?: string | null
  /** key 변경 시 자동 re-mount(새로고침) */
  refreshToken?: number
}

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

const LINES = [
  { key: "positiveScore", label: "긍정 수치",   color: "#10B981", strokeWidth: 1,   dotR: 2 },
  { key: "negativeScore", label: "부정 수치",   color: "#F59E0B", strokeWidth: 1,   dotR: 2 },
  { key: "riskScore",     label: "이탈 위험도", color: "#EF4444", strokeWidth: 2.5, dotR: 4 },
] as const

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-bold text-slate-600 mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-slate-500">{item.name}</span>
          <span className="ml-auto font-bold" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      <div className="flex-1 rounded-lg bg-slate-100 h-[220px]" />
      <div className="w-32 shrink-0 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md bg-slate-100 h-16" />
        ))}
      </div>
    </div>
  )
}

export function ScoreLineChart({ studentId, refreshToken }: Props) {
  const [points, setPoints]   = useState<ScorePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: "7" })
    if (studentId && studentId !== "none") params.set("studentId", studentId)

    fetch(`/api/stats/scores?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: { points: ScorePoint[] }) => setPoints(d.points ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [studentId, refreshToken])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <p className="text-xs text-red-400 py-6 text-center">
        데이터를 불러오지 못했습니다.
      </p>
    )
  }

  if (points.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 rounded-full bg-slate-100 p-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-slate-300">
            <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-400">분석 기록이 쌓이면</p>
        <p className="text-xs text-slate-300 mt-0.5">추세를 확인할 수 있습니다</p>
      </div>
    )
  }

  const latest = points[points.length - 1]

  return (
    <div className="flex gap-4 items-start">
      {/* Chart */}
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ display: "none" }}
            />
            {LINES.map(({ key, label, color, strokeWidth, dotR }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={strokeWidth}
                dot={{ r: dotR, fill: color, strokeWidth: 0 }}
                activeDot={{ r: dotR + 2, strokeWidth: 2, stroke: "#fff" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Right legend panel */}
      <div className="w-[120px] shrink-0 space-y-2.5">
        {LINES.map(({ key, label, color }) => (
          <div
            key={key}
            className="rounded-lg bg-slate-50 px-3 py-3 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-semibold text-slate-500 leading-tight">{label}</span>
            </div>
            <p className="text-xl font-extrabold leading-none" style={{ color }}>
              {(latest as unknown as Record<string, number>)[key]}
            </p>
            <p className="text-[9px] text-slate-300 font-medium">최근 분석</p>
          </div>
        ))}
      </div>
    </div>
  )
}
