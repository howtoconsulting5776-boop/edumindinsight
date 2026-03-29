"use client"

import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  CheckmarkCircle01Icon,
  AlertDiamondIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import type { PersonaSettings } from "@/lib/store"

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

const TONES = [
  {
    value: "empathetic",
    label: "공감형",
    sub: "감정을 먼저 받아주고 정서적 유대를 형성하는 따뜻한 접근",
    emoji: "💜",
    color: "#3E2D9B",
    bg: "#F5F3FF",
    border: "#C4BEF0",
  },
  {
    value: "logical",
    label: "논리형",
    sub: "데이터와 근거로 신뢰를 쌓는 분석적·객관적 접근",
    emoji: "📊",
    color: "#0EA5E9",
    bg: "#F0F9FF",
    border: "#BAE6FD",
  },
  {
    value: "assertive",
    label: "단호형",
    sub: "명확한 방향과 리더십으로 상황을 주도하는 결단력 있는 접근",
    emoji: "⚡",
    color: "#10B981",
    bg: "#F0FDF4",
    border: "#A7F3D0",
  },
] as const

export default function PersonaPage() {
  const [settings, setSettings] = useState<PersonaSettings>({
    tone: "empathetic",
    empathyLevel: 70,
    formality: 65,
    customInstructions: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/persona")
      .then((r) => r.json())
      .then((data: PersonaSettings) => setSettings(data))
      .catch(() => setError("설정을 불러오는 중 오류가 발생했습니다."))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/persona", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/60">
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    )
  }

  const activeTone = TONES.find((t) => t.value === settings.tone)!

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#3E2D9B" }}>
          <HIcon icon={AiBrain01Icon} size={20} primary="white" secondary="rgba(255,255,255,0.5)" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 페르소나 설정</h1>
          <p className="text-sm text-gray-500">AI의 분석 톤과 접근 방식을 설정하세요</p>
        </div>
      </div>

      {/* Tone selector */}
      <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <HIcon icon={Settings01Icon} size={18} primary="#3E2D9B" secondary="#C4BEF0" />
          <h2 className="text-lg font-bold text-gray-900">분석 톤 선택</h2>
        </div>

        <RadioGroup
          value={settings.tone}
          onValueChange={(v) => setSettings((s) => ({ ...s, tone: v as PersonaSettings["tone"] }))}
          className="space-y-3"
        >
          {TONES.map((tone) => {
            const isActive = settings.tone === tone.value
            return (
              <div key={tone.value}>
                <RadioGroupItem value={tone.value} id={tone.value} className="sr-only" />
                <label
                  htmlFor={tone.value}
                  className="block cursor-pointer"
                >
                  <div
                    className="flex items-center gap-4 p-5 rounded-2xl border-2 transition-all"
                    style={{
                      borderColor: isActive ? tone.border : "#E5E7EB",
                      background: isActive ? tone.bg : "white",
                    }}
                  >
                    <span className="text-2xl">{tone.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900" style={{ color: isActive ? tone.color : undefined }}>
                        {tone.label}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">{tone.sub}</p>
                    </div>
                    {isActive && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: tone.color }}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )
          })}
        </RadioGroup>
      </div>

      {/* Sliders */}
      <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">세부 조정</h2>

        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-gray-700">공감 강도</Label>
              <span
                className="text-sm font-bold px-3 py-1 rounded-xl"
                style={{ color: "#3E2D9B", background: "#F5F3FF" }}
              >
                {settings.empathyLevel}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[settings.empathyLevel]}
              onValueChange={([v]) => setSettings((s) => ({ ...s, empathyLevel: v }))}
              className="w-full"
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">차갑고 객관적</span>
              <span className="text-xs text-gray-400">매우 따뜻하고 공감적</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-gray-700">격식 수준</Label>
              <span
                className="text-sm font-bold px-3 py-1 rounded-xl"
                style={{ color: "#0EA5E9", background: "#F0F9FF" }}
              >
                {settings.formality}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[settings.formality]}
              onValueChange={([v]) => setSettings((s) => ({ ...s, formality: v }))}
              className="w-full"
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">친근하고 캐주얼</span>
              <span className="text-xs text-gray-400">공식적이고 격식체</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom instructions */}
      <div className="bg-white rounded-3xl p-7 shadow-xl shadow-slate-200/60 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-bold text-gray-900">추가 지침</h2>
          <span className="text-xs text-gray-400 font-normal">(선택사항)</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          AI가 분석 시 반드시 따라야 할 특별한 지침이나 이 학원 고유의 철학을 입력하세요.
        </p>
        <Textarea
          value={settings.customInstructions}
          onChange={(e) => setSettings((s) => ({ ...s, customInstructions: e.target.value }))}
          placeholder="예: 이 학원은 '학생 성장 중심'을 핵심 가치로 합니다. 모든 스크립트에 학생의 발전 가능성을 반드시 언급해주세요."
          className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:border-[#3E2D9B] resize-none"
        />
      </div>

      {/* Preview card */}
      <div
        className="rounded-3xl p-6 mb-8 border border-white/10"
        style={{ background: "linear-gradient(135deg, #2A1F7A 0%, #3E2D9B 100%)" }}
      >
        <p className="text-white/60 text-xs font-medium mb-2">현재 설정 미리보기</p>
        <p className="text-white font-bold text-base">
          {activeTone.emoji} {activeTone.label} 페르소나
        </p>
        <p className="text-white/70 text-sm mt-1 leading-relaxed">
          공감 강도 {settings.empathyLevel}% · 격식 {settings.formality}%
          {settings.customInstructions ? " · 추가 지침 설정됨" : ""}
        </p>
        <p className="text-white/50 text-xs mt-2">{activeTone.sub}</p>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-100 mb-4">
          <HIcon icon={AlertDiamondIcon} size={16} primary="#EF4444" secondary="#FCA5A5" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-green-50 border border-green-100 mb-4">
          <HIcon icon={CheckmarkCircle01Icon} size={16} primary="#10B981" secondary="#A7F3D0" />
          <span className="text-green-700 text-sm font-medium">설정이 저장되었습니다. 다음 분석부터 즉시 반영됩니다.</span>
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-2xl font-semibold text-base shadow-lg shadow-purple-200"
        style={{ background: saving ? "#9CA3AF" : "#3E2D9B" }}
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            저장 중...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <HIcon icon={AiBrain01Icon} size={18} primary="white" secondary="rgba(255,255,255,0.5)" />
            페르소나 저장하기
          </span>
        )}
      </Button>
    </div>
  )
}
