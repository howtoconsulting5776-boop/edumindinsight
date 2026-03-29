"use client"

import { useState, useEffect } from "react"

export default function SetupPage() {
  const [sql, setSql] = useState("")
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setSql(d.sql ?? ""))
      .catch(() => {})
  }, [])

  async function handleCopy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAutoSetup() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/setup", { method: "POST" })
      const data = await res.json()
      setResult({ success: !!data.success, message: data.message ?? data.error ?? "완료" })
    } catch {
      setResult({ success: false, message: "연결 오류가 발생했습니다." })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">데이터베이스 초기 설정</h1>
        <p className="text-slate-500 text-sm">
          아래 SQL을 Supabase SQL Editor에서 실행하면 모든 테이블이 자동으로 생성됩니다.
        </p>
      </div>

      {/* Step 1 — Auto setup */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-[#3E2D9B] text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-semibold text-slate-800">자동 설정 (권장)</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Vercel과 Supabase가 연동된 경우 자동으로 설정됩니다.
        </p>
        <button
          onClick={handleAutoSetup}
          disabled={running}
          className="w-full h-11 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: "#3E2D9B" }}
        >
          {running ? "설정 중..." : "자동 설정 실행"}
        </button>
        {result && (
          <div className={`mt-3 p-3 rounded-2xl text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {result.success ? "✓ " : "⚠ "}{result.message}
          </div>
        )}
      </div>

      {/* Step 2 — Manual SQL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-[#3E2D9B] text-white text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="font-semibold text-slate-800">수동 설정 (Supabase SQL Editor)</h2>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 mb-4 text-xs text-blue-700 leading-relaxed">
          <strong>실행 순서:</strong><br />
          1. <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-semibold">supabase.com/dashboard</a> 접속<br />
          2. 프로젝트 선택<br />
          3. 왼쪽 메뉴 → <strong>SQL Editor</strong> 클릭<br />
          4. <strong>New query</strong> 클릭<br />
          5. 아래 SQL을 전체 복사 → 붙여넣기<br />
          6. 오른쪽 위 <strong>Run</strong> (또는 Ctrl+Enter) 클릭
        </div>

        <div className="relative">
          <pre className="bg-gray-950 text-green-400 text-xs rounded-2xl p-5 overflow-auto max-h-96 leading-relaxed whitespace-pre-wrap font-mono">
            {sql || "SQL을 불러오는 중..."}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {copied ? "✓ 복사됨!" : "전체 복사"}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        SQL 실행 후 지식베이스 등록을 다시 시도하세요.
      </p>
    </div>
  )
}
