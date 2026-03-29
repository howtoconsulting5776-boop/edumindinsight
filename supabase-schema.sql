-- ============================================================
-- EduMind Insight — Supabase Schema
-- Run this entire script in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Paste → Run)
-- ============================================================

-- ── 1. Knowledge Base ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  category     TEXT        NOT NULL CHECK (category IN ('manual', 'case')),
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  priority     TEXT        NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low', 'medium', 'high')),
  tags         TEXT[]      DEFAULT '{}',
  situation    TEXT,
  response     TEXT,
  outcome      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Counseling Logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counseling_logs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  original_text   TEXT        NOT NULL,
  sanitized_text  TEXT        NOT NULL,
  analysis_mode   TEXT        NOT NULL,
  risk_score      INTEGER,
  positive_score  INTEGER,
  negative_score  INTEGER,
  keywords        TEXT[]      DEFAULT '{}',
  result          JSONB       NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Persona Settings (single-row config) ──────────────────
CREATE TABLE IF NOT EXISTS persona_settings (
  id                   INTEGER     DEFAULT 1 PRIMARY KEY,
  tone                 TEXT        DEFAULT 'empathetic'
                                   CHECK (tone IN ('empathetic', 'logical', 'assertive')),
  empathy_level        INTEGER     DEFAULT 70,
  formality            INTEGER     DEFAULT 65,
  custom_instructions  TEXT        DEFAULT '',
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default persona row
INSERT INTO persona_settings (id, tone, empathy_level, formality, custom_instructions)
VALUES (1, 'empathetic', 70, 65, '')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE knowledge_base    ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_settings  ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (admin check is done in app layer)
CREATE POLICY "Authenticated full access to knowledge_base"
  ON knowledge_base FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to counseling_logs"
  ON counseling_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to persona_settings"
  ON persona_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service-role key bypasses RLS entirely — used for server-side admin ops.

-- ── 5. Seed sample knowledge items ───────────────────────────
INSERT INTO knowledge_base (category, title, content, priority, tags) VALUES
  ('manual', '환불 정책 절대 원칙',
   '수업 시작 후 2주 이내에는 미수강 횟수에 비례하여 환불이 가능합니다. 단, 교재비는 환불 불가합니다. 2주 초과 시에는 원장의 재량에 따라 특별 환불 절차를 진행할 수 있습니다.',
   'high', ARRAY['환불', '정책', '수강료']),
  ('manual', '학부모 상담 응대 기본 원칙',
   '모든 학부모 상담은 반드시 ''공감 우선 원칙''으로 시작해야 합니다. 학부모의 불만 또는 우려 사항을 먼저 충분히 청취하고, 즉각적인 해명이나 반박은 절대 하지 않습니다. 상담 내용은 반드시 상담일지에 기록하고 원장에게 공유합니다.',
   'high', ARRAY['상담', '응대', '원칙'])
ON CONFLICT DO NOTHING;
