"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Plan = "free" | "pro" | "enterprise"

const PLANS: {
  key: Plan
  name: string
  price: string
  subPrice?: string
  limit: string
  features: string[]
  cta: string
  highlight: boolean
}[] = [
  {
    key: "free",
    name: "Free",
    price: "무료",
    limit: "월 10회",
    features: [
      "월 10회 상담 분석",
      "일반/심층 분석 모드",
      "AI 대응 스크립트 3종",
      "감정 온도계",
    ],
    cta: "현재 플랜",
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "₩29,000",
    subPrice: "/ 월",
    limit: "월 150회",
    features: [
      "월 150회 상담 분석",
      "일반/심층 분석 모드",
      "AI 대응 스크립트 3종",
      "감정 온도계",
      "우선 지원",
    ],
    cta: "Pro로 업그레이드",
    highlight: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "문의",
    limit: "무제한",
    features: [
      "무제한 상담 분석",
      "전용 AI 페르소나 설정",
      "RAG 지식 베이스 고도화",
      "전담 계정 관리자",
      "SLA 보장",
    ],
    cta: "문의하기",
    highlight: false,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.plan) setCurrentPlan(d.plan as Plan) })
      .catch(() => {})
  }, [])

  async function handleUpgrade(targetPlan: Plan) {
    if (targetPlan === "enterprise") {
      window.open("mailto:support@edumindinsight.com?subject=Enterprise%20플랜%20문의", "_blank")
      return
    }
    if (targetPlan === currentPlan) return

    setUpgrading(true)
    setMessage(null)

    try {
      // 서버 API를 통해 플랜 변경 (클라이언트 직접 수정 차단)
      const res  = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return }
        setMessage({ type: "error", text: data.error ?? "업그레이드에 실패했습니다. 잠시 후 다시 시도해주세요." })
        return
      }

      setCurrentPlan(targetPlan)
      setMessage({ type: "success", text: data.message ?? `${targetPlan === "pro" ? "Pro" : "Free"} 플랜으로 변경되었습니다! 🎉` })
    } catch {
      setMessage({ type: "error", text: "서버에 연결할 수 없습니다." })
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0EFFB] px-4 py-16 font-sans">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 mx-auto max-w-4xl"
        style={{ display: "block" }}
      >
        ← 뒤로가기
      </button>

      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            합리적인 요금제
          </h1>
          <p className="mt-3 text-slate-500">
            학원 규모에 맞는 플랜을 선택하세요. 언제든지 변경 가능합니다.
          </p>
        </div>

        {/* 결과 메시지 */}
        {message && (
          <div
            className={`mb-8 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 플랜 카드 */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key
            const isCurrentLoaded = currentPlan !== null

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-3xl p-7 shadow-xl transition-all ${
                  plan.highlight
                    ? "border-2 border-[#3E2D9B] bg-[#3E2D9B] text-white shadow-[0_20px_60px_rgba(62,45,155,0.30)]"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[#94C21F] px-4 py-1 text-xs font-bold text-white shadow-sm">
                      추천
                    </span>
                  </div>
                )}

                {/* 현재 플랜 뱃지 */}
                {isCurrent && (
                  <div className="absolute right-4 top-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        plan.highlight ? "bg-white/20 text-white" : "bg-[#3E2D9B]/10 text-[#3E2D9B]"
                      }`}
                    >
                      현재 플랜
                    </span>
                  </div>
                )}

                {/* 플랜 이름 */}
                <p className={`text-sm font-bold ${plan.highlight ? "text-white/70" : "text-[#3E2D9B]"}`}>
                  {plan.name}
                </p>

                {/* 가격 */}
                <div className="mt-3 flex items-end gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-900"}`}>
                    {plan.price}
                  </span>
                  {plan.subPrice && (
                    <span className={`mb-1 text-sm ${plan.highlight ? "text-white/60" : "text-slate-400"}`}>
                      {plan.subPrice}
                    </span>
                  )}
                </div>

                {/* 한도 */}
                <p className={`mt-1 text-xs font-semibold ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
                  {plan.limit}
                </p>

                {/* 구분선 */}
                <div className={`my-6 h-px ${plan.highlight ? "bg-white/20" : "bg-slate-100"}`} />

                {/* 기능 목록 */}
                <ul className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="shrink-0"
                      >
                        <circle cx="8" cy="8" r="8" fill={plan.highlight ? "rgba(255,255,255,0.2)" : "#E8E5FF"} />
                        <path
                          d="M5 8l2 2 4-4"
                          stroke={plan.highlight ? "#fff" : "#3E2D9B"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className={plan.highlight ? "text-white/90" : "text-slate-700"}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA 버튼 */}
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={
                    upgrading ||
                    (isCurrentLoaded && isCurrent && plan.key !== "enterprise") ||
                    (!isCurrentLoaded && plan.key !== "enterprise")
                  }
                  className={`mt-8 w-full rounded-2xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-white text-[#3E2D9B] hover:bg-white/90 shadow-lg"
                      : isCurrent
                        ? "border border-slate-200 bg-slate-50 text-slate-400"
                        : "border-2 border-[#3E2D9B] bg-transparent text-[#3E2D9B] hover:bg-[#3E2D9B] hover:text-white"
                  }`}
                >
                  {upgrading && !isCurrent
                    ? "처리 중..."
                    : isCurrent
                      ? "현재 플랜"
                      : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          결제 관련 문의: support@edumindinsight.com
        </p>
      </div>
    </div>
  )
}
