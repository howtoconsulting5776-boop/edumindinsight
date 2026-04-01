"use client"

import { useState, useEffect } from "react"

function StorageBucketSetup() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [msg, setMsg] = useState("")

  async function handleCreate() {
    setStatus("loading")
    setMsg("")
    try {
      const res = await fetch("/api/storage/ensure-bucket", { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setStatus("error"); setMsg(data.error ?? "버킷 생성 실패"); return }
      setStatus("ok")
      setMsg(data.created ? "pdf-uploads 버킷이 생성되었습니다." : "pdf-uploads 버킷이 이미 존재합니다.")
    } catch {
      setStatus("error")
      setMsg("연결 오류가 발생했습니다.")
    }
  }

  return (
    <div>
      <button
        onClick={handleCreate}
        disabled={status === "loading"}
        className="w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all"
        style={{ background: "#3E2D9B" }}
      >
        {status === "loading" ? "생성 중..." : "Storage 버킷 자동 생성"}
      </button>
      {msg && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${status === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {status === "ok" ? "✓ " : "✗ "}{msg}
        </div>
      )}
    </div>
  )
}

export default function SetupPage() {
  const [sql, setSql] = useState("")
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [accessToken, setAccessToken] = useState("")
  const [showToken, setShowToken] = useState(false)

  // Supabase 프로젝트 ref 추출 (SQL 에디터 링크용)
  const [projectRef, setProjectRef] = useState("")
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ""
    setProjectRef(ref)

    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setSql(d.sql ?? ""))
      .catch(() => {})
  }, [])

  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : "https://supabase.com/dashboard"

  async function handleCopy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAutoSetup() {
    if (!accessToken.trim()) {
      alert("Personal Access Token을 입력해주세요.")
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      })
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">데이터베이스 초기 설정</h1>
        <p className="text-slate-500 text-sm">
          아래 방법 중 하나를 선택하여 데이터베이스 테이블을 생성하세요.
        </p>
      </div>

      {/* 방법 1: Personal Access Token 자동 설정 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-[#3E2D9B] text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-semibold text-slate-800">자동 설정 (Personal Access Token)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4 ml-8">
          Supabase Personal Access Token을 입력하면 자동으로 테이블을 생성합니다.
        </p>

        {/* Token 발급 안내 */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4 text-xs text-blue-700 leading-relaxed">
          <strong>토큰 발급 방법:</strong><br />
          1.{" "}
          <a
            href="https://supabase.com/dashboard/account/tokens"
            target="_blank"
            rel="noreferrer"
            className="underline font-semibold"
          >
            supabase.com/dashboard/account/tokens
          </a>{" "}
          접속<br />
          2. <strong>Generate new token</strong> 클릭 → 이름 입력 → 생성<br />
          3. 생성된 토큰을 아래에 붙여넣기
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type={showToken ? "text" : "password"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="sbp_xxxxxxxx..."
            className="flex-1 h-11 px-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3E2D9B]/30"
          />
          <button
            onClick={() => setShowToken((v) => !v)}
            className="px-4 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
          >
            {showToken ? "숨기기" : "보기"}
          </button>
        </div>

        <button
          onClick={handleAutoSetup}
          disabled={running || !accessToken.trim()}
          className="w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all"
          style={{ background: "#3E2D9B" }}
        >
          {running ? "설정 중..." : "자동 설정 실행"}
        </button>

        {result && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {result.success ? "✓ " : "⚠ "}{result.message}
            {result.success && (
              <div className="mt-1 text-xs">파일 업로드를 다시 시도해보세요.</div>
            )}
          </div>
        )}
      </div>

      {/* 방법 2: Supabase SQL Editor 직접 실행 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-[#3E2D9B] text-white text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="font-semibold text-slate-800">수동 설정 (SQL Editor 직접 실행)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4 ml-8">
          Supabase 대시보드에서 SQL을 직접 실행합니다.
        </p>

        {/* 직접 링크 */}
        <a
          href={sqlEditorUrl}
          target="_blank"
          rel="noreferrer"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-lg text-sm font-semibold border-2 border-[#3E2D9B] text-[#3E2D9B] hover:bg-[#3E2D9B] hover:text-white transition-all mb-4"
        >
          SQL 복사 후 Supabase SQL Editor 열기 →
        </a>

        <div className="bg-blue-50 rounded-lg p-4 mb-4 text-xs text-blue-700 leading-relaxed">
          <strong>실행 순서:</strong><br />
          1. 위 버튼 클릭 → SQL이 자동으로 클립보드에 복사됩니다<br />
          2. Supabase SQL Editor에서 <strong>Ctrl+V</strong> (붙여넣기)<br />
          3. 오른쪽 위 <strong>Run</strong> (또는 Ctrl+Enter) 클릭<br />
          4. "Success" 메시지 확인 → 파일 업로드 재시도
        </div>

        <div className="relative">
          <pre className="bg-gray-950 text-green-400 text-xs rounded-lg p-5 overflow-auto max-h-72 leading-relaxed whitespace-pre-wrap font-mono">
            {sql || "SQL을 불러오는 중..."}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-4 py-2 rounded-md text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {copied ? "✓ 복사됨!" : "전체 복사"}
          </button>
        </div>
      </div>

      {/* Storage 버킷 생성 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-[#3E2D9B] text-white text-xs font-bold flex items-center justify-center">3</span>
          <h2 className="font-semibold text-slate-800">Storage 버킷 생성 (파일 업로드용)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3 ml-8">
          PDF/이미지 파일 업로드를 위한 저장 공간입니다. 아래 버튼으로 자동 생성됩니다.
        </p>
        <StorageBucketSetup />
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        1~3단계 완료 후 매뉴얼 페이지에서 파일 업로드를 다시 시도하세요.
      </p>
    </div>
  )
}
