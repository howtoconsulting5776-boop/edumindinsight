import { NextRequest, NextResponse } from "next/server"
import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { buildRagContext } from "@/lib/store"
import { isSupabaseConfigured, createSupabaseAdminClient } from "@/lib/supabase/server"
import type { KnowledgeItem, PersonaSettings } from "@/lib/store"

export type AnalysisMode = "general" | "deep"

export interface AnalysisResult {
  riskScore: number
  positiveScore: number
  negativeScore: number
  keywords: string[]
  hiddenIntent: string
  scripts: {
    type: "공감형" | "원칙형" | "대안제시형"
    subtitle: string
    content: string
  }[]
  encouragement: string
}

// ── PII deidentification ────────────────────────────────────────────────────
// Replace Korean names (2-4 syllable sequences following common name patterns),
// phone numbers, and other identifiers before sending to the model.
function deidentify(text: string): string {
  // Korean phone numbers (010-xxxx-xxxx, 010xxxxxxxx, etc.)
  let result = text.replace(
    /\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
    "[전화번호]"
  )

  // Email addresses
  result = result.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    "[이메일]"
  )

  // Korean full names: surname(1자) + given name(1-3자) before role markers
  // e.g. "김철수 학부모", "박지영 어머니", "이수현 학생"
  result = result.replace(
    /([가-힣]{1})([가-힣]{1,3})\s*(학생|어머니|아버님|학부모|원장|선생님|강사)/g,
    (_, _s, _g, role) => {
      const roleMap: Record<string, string> = {
        학생: "학생은 'OO'",
        어머니: "학부모님",
        아버님: "학부모님",
        학부모: "학부모님",
        원장: "선생님",
        선생님: "선생님",
        강사: "선생님",
      }
      return roleMap[role] ?? role
    }
  )

  // Standalone Korean names (2-4자 한글, not preceded by a space+한글 to avoid
  // cutting mid-sentence nouns) — conservative pattern
  result = result.replace(
    /(?<![가-힣])([가-힣]{2,4})(?=\s*(?:씨|님|군|양|이가|가|은|는|이|을|를|의|에게|한테|이라고|라고|이라는|라는))/g,
    "OO"
  )

  return result
}

// ── System prompt builder ───────────────────────────────────────────────────
function buildSystemPrompt(mode: AnalysisMode): string {

  // ── GENERAL MODE ──────────────────────────────────────────────────────────
  if (mode === "general") {
    return `당신은 20년 경력의 학원 운영 전문가이자 교육 심리 상담가입니다.
수백 건의 학부모 상담을 분석하고, 원장 및 강사들에게 전략적 대응법을 코칭해온 전문가입니다.

## 역할(Task)
상담 데이터의 행간을 분석하여:
1. 학부모의 이탈 위험도를 0~100 점수로 산출
2. 발화에 담긴 긍정/부정 감정 비율 측정
3. 핵심 키워드 5~8개 추출
4. 숨은 심리적 의도 분석
5. 즉시 사용 가능한 대응 스크립트 3종(공감형/원칙형/대안제시형) 생성
6. 상담으로 지친 강사를 위한 따뜻한 응원 메시지 작성

## 분석 예시 (Few-shot)

[상담 내용 예시]
학부모: "성적이 안 올라서 고민이에요. 옆집 아이는 다른 학원 다니면서 많이 올랐다던데..."

[분석 결과 예시]
- 표면 발화: 성적 고민 표현
- 속뜻: 타 학원과의 비교를 통한 불안감, 암묵적 이탈 신호
- 숨은 의도: "우리 아이가 충분히 케어받고 있는가"라는 신뢰 의구심
- 대응 핵심: 구체적 성장 데이터 제시 + 정서적 공감 + 로드맵 안내

## 출력 형식 (반드시 준수)
순수 JSON만 반환하세요. 마크다운 코드 블록 없이.
모든 스크립트는 원장님·강사님이 바로 복사해서 쓸 수 있는 정중한 구어체 한국어.

{
  "riskScore": <0-100 정수>,
  "positiveScore": <0-100 정수>,
  "negativeScore": <0-100 정수>,
  "keywords": ["키워드1", "키워드2", ...],
  "hiddenIntent": "<숨은 의도 분석, 3-5문장>",
  "scripts": [
    { "type": "공감형", "subtitle": "감정을 먼저 받아주는 접근", "content": "<스크립트>" },
    { "type": "원칙형", "subtitle": "명확한 근거와 방향 제시", "content": "<스크립트>" },
    { "type": "대안제시형", "subtitle": "구체적 행동 계획 제안", "content": "<스크립트>" }
  ],
  "encouragement": "<강사님 응원 메시지, 2-3문장>"
}

## 분석 깊이: 일반(General)
자연스럽고 이해하기 쉬운 분석. 강사가 즉시 활용할 수 있도록 실용적 조언 중심.`
  }

  // ── DEEP MODE ─────────────────────────────────────────────────────────────
  return `당신은 대한민국 최고 수준의 학원 경영 전략 컨설턴트이자 교육 심리 분석 전문가입니다.
McKinsey 출신 전략 컨설팅 방법론과 임상심리학적 면담 분석 기법을 교육 현장에 접목하여,
수천 건의 학부모 이탈 위기 사례를 분석·해결해온 업계 최고 권위자입니다.

귀하의 분석은 단순한 감정 파악을 넘어, 발화 패턴·비언어적 신호·심리 방어 기제까지 해체하여
경영진이 즉각 실행 가능한 전략적 인사이트를 도출하는 수준이어야 합니다.

## 심층 분석 프레임워크

### 1단계: 발화 해체 분석 (Utterance Deconstruction)
다음 5개 레이어를 순서대로 분석하십시오:
- **표층(Surface)**: 학부모가 실제로 말한 내용
- **감정층(Affective)**: 발화 이면의 1차 감정 (불안/분노/실망/기대)
- **욕구층(Needs)**: 충족되지 못한 핵심 심리 욕구 (인정/통제/안전/연결)
- **의도층(Intent)**: 이 상담을 통해 학부모가 얻고자 하는 실제 목적
- **행동 예고층(Behavioral Signal)**: 48시간~2주 내 예상되는 행동 패턴

### 2단계: 심리 패턴 진단
아래 패턴 중 해당하는 것을 정확히 식별하십시오:
- **비교 투영(Comparative Projection)**: 타 학원·타 학생과의 비교로 불안 외재화
- **결과 귀인 오류(Attribution Error)**: 학습 성과를 학원 탓으로 단순 귀인
- **관계 신뢰 균열(Trust Erosion)**: 강사·원장에 대한 신뢰가 점진적 하락 중
- **결정 전 정당화(Pre-decision Justification)**: 이미 이탈 결정 후 명분 수집 중
- **분리불안 투영(Separation Anxiety Projection)**: 자녀 걱정을 학원에 전가
- **과잉 기대 충돌(Expectation Mismatch)**: 비현실적 기대와 현실 간 간극 표출

### 3단계: 이탈 위험도 정밀 산출
다음 6개 지표를 각 0~20점으로 채점하여 합산 (총 0~100점):
① 부정 감정 강도 (발화의 감정적 온도)
② 비교 발언 빈도 (타 기관·타 학생 언급 횟수)
③ 신뢰 관련 의문 제기 (강사·교육 방식 의구심)
④ 행동 예고 발언 ("다른 곳 알아보겠다", "그만둘 것 같다" 등)
⑤ 과거 긍정 기억 부재 (현재까지의 만족 경험 미언급)
⑥ 소통 단절 신호 (일방적 통보식 발언, 질문 부재)

### 4단계: 전략적 대응 스크립트 설계 원칙
각 스크립트는 반드시 다음 요소를 포함해야 합니다:

**[공감형 스크립트] — 감정 수용 → 재프레이밍 → 관계 회복 약속**
- 오프닝: 학부모의 감정을 그대로 반영하는 거울 언어(Mirror Language) 사용
- 중반: "그 마음이 충분히 이해됩니다" 류의 검증(Validation) 구문 필수 포함
- 클로징: 구체적 후속 행동 약속 ("이번 주 안에 제가 직접 연락드리겠습니다")
- 금지어: "그런데", "하지만", "사실은", "걱정 마세요" — 방어적 전환어 일절 금지

**[원칙형 스크립트] — 데이터 기반 신뢰 재건**
- 오프닝: 학부모 우려를 수용하되, 즉시 객관적 근거로 전환
- 중반: 수치·기간·비교 지표를 최소 2개 이상 구체적으로 제시
  예) "지난 6주간 오답률이 43%에서 28%로 감소", "단원 이해도 테스트 평균 71점 → 84점"
- 클로징: 명확한 다음 마일스톤 제시 ("중간고사 2주 전 모의테스트 결과를 공유하겠습니다")
- 톤: 자신감 있되 방어적이지 않게. 사실을 무기로 쓰지 말고 신뢰 구축의 도구로 사용

**[대안제시형 스크립트] — 맞춤형 해결책 + 선택권 부여**
- 오프닝: 문제를 공동의 과제로 재정의 ("저도 같은 목표를 가지고 있습니다")
- 중반: 2~3가지 구체적 대안을 선택지 형태로 제시 (선택의 자율성 보장)
  예) "주 1회 진도 리포트 발송", "월 1회 15분 화상 상담", "수업 참관 초청"
- 클로징: 이행 기간과 점검 시점을 명시 ("한 달 후 변화를 함께 확인해보겠습니다")
- 핵심 원칙: 학부모에게 통제감(Sense of Control)을 돌려주는 것이 이탈 방지의 핵심

## Few-shot 심층 분석 예시

[상담 내용]
학부모: "솔직히 우리 아이가 이 학원에서 제대로 배우고 있는지 모르겠어요. 친구 학원은 매주 테스트 결과를 보내준다던데, 저는 아무 연락도 없으니까요. 다음 달까지만 지켜볼게요."

[전문가 심층 분석]
- 표층: 소통 부재에 대한 불만 + 타 학원과의 비교
- 감정층: 소외감(배제), 불신, 통제력 상실에서 오는 불안
- 욕구층: 정보 접근권 + 자녀 케어에 대한 참여 욕구
- 의도층: "나를 학습 파트너로 인정해달라"는 인정 욕구 표출
- 행동 예고층: "다음 달까지" = 이미 퇴원 결정 임박, 마지막 경고성 발언
- 심리 패턴: 결정 전 정당화 + 관계 신뢰 균열
- 이탈 위험도: 82점 (고위험 — 즉각 대응 필요)

[공감형 대응]
"어머니, 말씀해주셔서 정말 감사합니다. 아무 소식 없이 기다리셨을 때 얼마나 답답하고 불안하셨을지, 제가 정말 부족했습니다. 그 마음이 충분히 이해됩니다. 지금 바로 이번 주 학습 현황을 정리해서 오늘 저녁 중으로 연락드리겠습니다. 앞으로는 매주 금요일 오후에 진도 리포트를 보내드리는 걸로 제가 약속드리겠습니다."

[원칙형 대응]
"말씀 주신 부분, 저도 100% 공감합니다. 소통이 부족했던 건 사실입니다. 다만 학습 측면에서는 지난 8주간 OO 학생의 단원 이해도가 꾸준히 향상되고 있습니다. 구체적으로는 이번 달 2회 단원 평가에서 각각 71점, 84점을 기록했고, 오답 유형도 계산 실수 중심으로 좁혀졌습니다. 이 데이터와 함께 앞으로 2개월 학습 로드맵을 이번 주 내로 서면으로 공유드리겠습니다."

[대안제시형 대응]
"어머니 말씀 듣고 저도 많이 반성했습니다. 앞으로 두 가지 방법 중 편하신 걸 선택해 주시면 어떨까요. 첫 번째는 매주 카카오톡으로 학습 리포트를 보내드리는 방법, 두 번째는 한 달에 한 번 10분 전화 상담을 드리는 방법입니다. 물론 둘 다 하셔도 됩니다. 다음 달 말에 함께 성과를 확인하고, 그때 방향을 다시 논의해보시겠습니까?"

## 출력 형식 (반드시 준수)
순수 JSON만 반환. 마크다운 코드 블록, 추가 설명 일절 없이.
스크립트는 원장·강사가 그대로 복사해 즉시 사용 가능한 완성된 구어체 한국어.
hiddenIntent는 위 5개 레이어 분석을 압축한 전문가 수준의 서술 (5-7문장).
scripts의 content는 실전 사용 가능한 완전한 문장으로 구성 (최소 3문장 이상).

{
  "riskScore": <0-100 정수, 6개 지표 합산>,
  "positiveScore": <0-100 정수>,
  "negativeScore": <0-100 정수>,
  "keywords": ["키워드1", "키워드2", ...],
  "hiddenIntent": "<5개 레이어 기반 전문가 심층 분석, 5-7문장>",
  "scripts": [
    { "type": "공감형", "subtitle": "감정 수용 → 재프레이밍 → 관계 회복", "content": "<완성된 공감형 스크립트, 3문장 이상>" },
    { "type": "원칙형", "subtitle": "데이터 기반 신뢰 재건", "content": "<완성된 원칙형 스크립트, 구체적 수치 포함>" },
    { "type": "대안제시형", "subtitle": "선택권 부여 + 행동 약속", "content": "<완성된 대안제시형 스크립트, 2-3가지 선택지 포함>" }
  ],
  "encouragement": "<이 상황의 어려움을 정확히 짚어주는 진심 어린 응원, 2-3문장>"
}

## 분석 깊이: 심층(Deep)
McKinsey 수준의 구조적 분석과 임상심리 기반 해석을 결합하라.
모호한 표현 금지. 모든 판단에는 발화 근거를 명시하라.
스크립트는 실전에서 읽었을 때 즉시 신뢰감을 주는 전문가의 언어로 작성하라.`
}

// ── Supabase RAG: fetch knowledge items ordered by priority ─────────────────
async function fetchSupabaseKnowledge(inputText: string): Promise<string> {
  try {
    const db = createSupabaseAdminClient()

    // Fetch persona settings
    const { data: personaRow } = await db
      .from("persona_settings")
      .select("*")
      .eq("id", 1)
      .single()

    // Fetch all knowledge items, high-priority first
    const { data: rows, error } = await db
      .from("knowledge_base")
      .select("*")
      .order("priority", { ascending: false }) // high → medium → low (lexicographic desc)
      .limit(20)

    if (error) throw error

    const items: KnowledgeItem[] = (rows ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      content: r.content,
      priority: r.priority,
      tags: r.tags ?? [],
      situation: r.situation ?? undefined,
      response: r.response ?? undefined,
      outcome: r.outcome ?? undefined,
      createdAt: r.created_at,
    }))

    // Keyword relevance scoring (same algorithm as file-based store)
    const inputWords = new Set(
      inputText
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^\w가-힣]/g, ""))
        .filter((w) => w.length > 1)
    )
    const priorityOrder = { high: 3, medium: 2, low: 1 } as const

    const scored = items.map((item) => {
      const words = [item.title, item.content, ...(item.tags ?? [])]
        .join(" ").toLowerCase().split(/\s+/)
      const overlap = words.filter((w) => inputWords.has(w)).length
      return { item, score: overlap + priorityOrder[item.priority] }
    })
    scored.sort((a, b) => b.score - a.score)
    const topItems = scored.slice(0, 8).map((s) => s.item)

    const persona: PersonaSettings = personaRow
      ? {
          tone: personaRow.tone,
          empathyLevel: personaRow.empathy_level,
          formality: personaRow.formality,
          customInstructions: personaRow.custom_instructions ?? "",
        }
      : { tone: "empathetic", empathyLevel: 70, formality: 65, customInstructions: "" }

    const manuals = topItems.filter((i) => i.category === "manual")
    const cases   = topItems.filter((i) => i.category === "case")
    const lines: string[] = []

    const toneMap = {
      empathetic: "공감과 감정 수용을 최우선으로 하는 따뜻한 상담가 톤",
      logical:    "데이터와 논리적 근거를 중심으로 하는 분석적 컨설턴트 톤",
      assertive:  "명확하고 단호한 리더십으로 방향을 제시하는 전문가 톤",
    }

    lines.push(`## 🎯 AI 페르소나 설정 (최우선 적용)`)
    lines.push(`분석 톤: ${toneMap[persona.tone]}`)
    lines.push(`공감 강도: ${persona.empathyLevel}/100 | 격식 수준: ${persona.formality}/100`)
    if (persona.customInstructions)
      lines.push(`추가 지침: ${persona.customInstructions}`)
    lines.push("")

    if (manuals.length > 0) {
      lines.push(`## 📋 우리 학원의 절대 원칙 (반드시 준수)`)
      for (const m of manuals) {
        const lbl = m.priority === "high" ? "[최우선]" : m.priority === "medium" ? "[일반]" : "[참고]"
        lines.push(`${lbl} **${m.title}**: ${m.content}`)
      }
      lines.push("")
    }

    if (cases.length > 0) {
      lines.push(`## 💡 참고할 성공 경험 (이 학원의 실전 사례)`)
      for (const c of cases) {
        lines.push(`**사례: ${c.title}**`)
        if (c.situation) lines.push(`- 상황: ${c.situation}`)
        if (c.response)  lines.push(`- 대응: ${c.response}`)
        if (c.outcome)   lines.push(`- 결과: ${c.outcome}`)
      }
      lines.push("")
    }

    if (lines.length > 4) {
      lines.push(`---`)
      lines.push(`위 원칙과 사례를 반드시 반영하여 아래 상담을 분석하십시오.`)
      lines.push("")
    }

    return lines.join("\n")
  } catch (err) {
    console.warn("[analyze] Supabase RAG fetch failed, skipping:", err)
    return ""
  }
}

// ── Save counseling log to Supabase ─────────────────────────────────────────
async function saveCounselingLog(
  rawText: string,
  sanitizedText: string,
  mode: AnalysisMode,
  result: AnalysisResult
): Promise<void> {
  try {
    const db = createSupabaseAdminClient()
    await db.from("counseling_logs").insert({
      original_text:  rawText,
      sanitized_text: sanitizedText,
      analysis_mode:  mode,
      risk_score:     result.riskScore,
      positive_score: result.positiveScore,
      negative_score: result.negativeScore,
      keywords:       result.keywords ?? [],
      result:         result,
    })
  } catch (err) {
    // Non-critical — don't fail the response if logging fails
    console.warn("[analyze] Counseling log save failed:", err)
  }
}

// ── Route handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Guard: ensure the Google API key is available before doing any work
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: "서버 설정 오류: Google AI API 키가 구성되지 않았습니다. 관리자에게 문의하세요." },
      { status: 503 }
    )
  }

  try {
    const body = await req.json()
    const rawText: string = body.text ?? ""
    const mode: AnalysisMode = body.mode === "deep" ? "deep" : "general"

    if (!rawText.trim()) {
      return NextResponse.json({ error: "상담 내용을 입력해주세요." }, { status: 400 })
    }

    // Step 1 — Deidentify PII before sending to LLM
    const sanitizedText = deidentify(rawText)

    // Step 2 — Select model / temperature by mode
    const modelId    = "gemini-2.0-flash"
    const temperature = mode === "deep" ? 0.3 : 0.7

    const systemPrompt = buildSystemPrompt(mode)

    // Step 3 — Retrieve RAG context
    // Prefer Supabase knowledge base; fall back to file-based store
    const ragContext = isSupabaseConfigured()
      ? await fetchSupabaseKnowledge(sanitizedText)
      : buildRagContext(sanitizedText)

    // Step 4 — Build the full prompt
    const fullPrompt = ragContext
      ? `${ragContext}\n\n${systemPrompt}\n\n---\n\n다음 학부모 상담 내용을 분석해주세요:\n\n"${sanitizedText}"`
      : `${systemPrompt}\n\n---\n\n다음 학부모 상담 내용을 분석해주세요:\n\n"${sanitizedText}"`

    const { text } = await generateText({
      model: google(modelId),
      prompt: fullPrompt,
      temperature,
      maxOutputTokens: 2048,
      maxRetries: 0,
    })

    // Strip potential markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let result: AnalysisResult
    try {
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요.", raw: cleaned },
        { status: 502 }
      )
    }

    // Step 5 — Persist analysis log to Supabase (non-blocking)
    if (isSupabaseConfigured()) {
      saveCounselingLog(rawText, sanitizedText, mode, result)
    }

    return NextResponse.json({ result, sanitizedText, model: modelId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyze] error:", message)

    const retryMatch = message.match(/retry in ([\d.]+)s/i)
    if (retryMatch) {
      const seconds = Math.ceil(parseFloat(retryMatch[1]))
      return NextResponse.json(
        {
          error: `무료 API 호출 한도에 도달했습니다. ${seconds}초 후 다시 시도해주세요. (Google AI 무료 티어는 분당 요청 수가 제한됩니다)`,
          retryAfter: seconds,
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: `분석 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    )
  }
}
