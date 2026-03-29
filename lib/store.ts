/**
 * Simple JSON file-based store for local development.
 *
 * For production, migrate to Supabase with the following schema:
 *
 * CREATE TABLE knowledge_base (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   category TEXT NOT NULL CHECK (category IN ('manual', 'case')),
 *   title TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
 *   tags TEXT[] DEFAULT '{}',
 *   situation TEXT,
 *   response TEXT,
 *   outcome TEXT,
 *   embedding VECTOR(1536),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE persona_settings (
 *   id INTEGER DEFAULT 1 PRIMARY KEY,
 *   tone TEXT DEFAULT 'empathetic',
 *   empathy_level INTEGER DEFAULT 70,
 *   formality INTEGER DEFAULT 65,
 *   custom_instructions TEXT DEFAULT ''
 * );
 */

import fs from "fs"
import path from "path"

export interface KnowledgeItem {
  id: string
  category: "manual" | "case"
  title: string
  content: string
  priority: "low" | "medium" | "high"
  tags: string[]
  situation?: string
  response?: string
  outcome?: string
  createdAt: string
}

export interface PersonaSettings {
  tone: "empathetic" | "logical" | "assertive"
  empathyLevel: number
  formality: number
  customInstructions: string
}

const DATA_DIR = path.join(process.cwd(), "data")
const KNOWLEDGE_PATH = path.join(DATA_DIR, "knowledge.json")
const PERSONA_PATH = path.join(DATA_DIR, "persona.json")

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ── Knowledge Base ──────────────────────────────────────────────────────────

export function readKnowledge(): KnowledgeItem[] {
  ensureDataDir()
  if (!fs.existsSync(KNOWLEDGE_PATH)) return []
  try {
    const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf-8")
    return (JSON.parse(raw) as { items: KnowledgeItem[] }).items ?? []
  } catch {
    return []
  }
}

export function writeKnowledge(items: KnowledgeItem[]): void {
  ensureDataDir()
  fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify({ items }, null, 2), "utf-8")
}

export function addKnowledgeItem(item: Omit<KnowledgeItem, "id" | "createdAt">): KnowledgeItem {
  const items = readKnowledge()
  const newItem: KnowledgeItem = {
    ...item,
    id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  writeKnowledge([...items, newItem])
  return newItem
}

export function deleteKnowledgeItem(id: string): boolean {
  const items = readKnowledge()
  const filtered = items.filter((i) => i.id !== id)
  if (filtered.length === items.length) return false
  writeKnowledge(filtered)
  return true
}

// ── Persona ─────────────────────────────────────────────────────────────────

export function readPersona(): PersonaSettings {
  ensureDataDir()
  if (!fs.existsSync(PERSONA_PATH)) {
    return { tone: "empathetic", empathyLevel: 70, formality: 65, customInstructions: "" }
  }
  try {
    return JSON.parse(fs.readFileSync(PERSONA_PATH, "utf-8")) as PersonaSettings
  } catch {
    return { tone: "empathetic", empathyLevel: 70, formality: 65, customInstructions: "" }
  }
}

export function writePersona(settings: PersonaSettings): void {
  ensureDataDir()
  fs.writeFileSync(PERSONA_PATH, JSON.stringify(settings, null, 2), "utf-8")
}

// ── RAG Context Builder ──────────────────────────────────────────────────────

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 }

export function buildRagContext(inputText: string): string {
  const persona = readPersona()
  const items = readKnowledge()

  if (items.length === 0 && !persona.customInstructions) return ""

  // Simple keyword-based relevance: score each item by word overlap
  const inputWords = new Set(
    inputText
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\w가-힣]/g, ""))
      .filter((w) => w.length > 1)
  )

  const scored = items.map((item) => {
    const words = [item.title, item.content, ...(item.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
    const overlap = words.filter((w) => inputWords.has(w)).length
    return { item, score: overlap + PRIORITY_ORDER[item.priority] }
  })

  scored.sort((a, b) => b.score - a.score)
  const topItems = scored.slice(0, 8).map((s) => s.item)

  const manuals = topItems.filter((i) => i.category === "manual")
  const cases = topItems.filter((i) => i.category === "case")

  const lines: string[] = []

  // Persona directive
  const toneMap = {
    empathetic: "공감과 감정 수용을 최우선으로 하는 따뜻한 상담가 톤",
    logical: "데이터와 논리적 근거를 중심으로 하는 분석적 컨설턴트 톤",
    assertive: "명확하고 단호한 리더십으로 방향을 제시하는 전문가 톤",
  }

  lines.push(`## 🎯 AI 페르소나 설정 (최우선 적용)`)
  lines.push(`분석 톤: ${toneMap[persona.tone]}`)
  if (persona.empathyLevel !== undefined) {
    lines.push(`공감 강도: ${persona.empathyLevel}/100 | 격식 수준: ${persona.formality}/100`)
  }
  if (persona.customInstructions) {
    lines.push(`추가 지침: ${persona.customInstructions}`)
  }
  lines.push("")

  if (manuals.length > 0) {
    lines.push(`## 📋 우리 학원의 절대 원칙 (반드시 준수)`)
    for (const m of manuals) {
      const priorityLabel = m.priority === "high" ? "[최우선]" : m.priority === "medium" ? "[일반]" : "[참고]"
      lines.push(`${priorityLabel} **${m.title}**: ${m.content}`)
    }
    lines.push("")
  }

  if (cases.length > 0) {
    lines.push(`## 💡 참고할 성공 경험 (이 학원의 실전 사례)`)
    for (const c of cases) {
      lines.push(`**사례: ${c.title}**`)
      if (c.situation) lines.push(`- 상황: ${c.situation}`)
      if (c.response) lines.push(`- 대응: ${c.response}`)
      if (c.outcome) lines.push(`- 결과: ${c.outcome}`)
    }
    lines.push("")
  }

  lines.push(`---`)
  lines.push(`위 원칙과 사례를 반드시 반영하여 아래 상담을 분석하십시오.`)
  lines.push("")

  return lines.join("\n")
}
