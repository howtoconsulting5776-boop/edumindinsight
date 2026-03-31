-- ══════════════════════════════════════════════════════════════════════════════
-- EduMind Insight — Schema v3: 학생 상담 이력 기반 DB 완전 재설계
-- 실행: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- 멱등성 보장: 여러 번 실행해도 안전합니다.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 0. pgvector 확장 (향후 벡터 검색 대비, 없으면 무시) ──────────────────────
-- CREATE EXTENSION IF NOT EXISTS vector;  ← 벡터 검색 도입 시 주석 해제


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: 기존 테이블 보완 (academies, profiles, counseling_logs, persona_settings)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1-1. academies: 누락 컬럼 안전 추가 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academies (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  code       TEXT        UNIQUE,
  owner_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS code       TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- code UNIQUE 제약 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academies_code_key' AND conrelid = 'public.academies'::regclass
  ) THEN
    ALTER TABLE public.academies ADD CONSTRAINT academies_code_key UNIQUE (code);
  END IF;
END $$;

-- code NULL 행에 자동 코드 부여
UPDATE public.academies
SET code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE code IS NULL OR code = '';

-- ── 1-2. profiles: 요금제 + 가입 방법 + 만료일 컬럼 추가 ─────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  role        TEXT        NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'director', 'teacher')),
  academy_id  UUID        REFERENCES public.academies(id) ON DELETE SET NULL,
  plan        TEXT        NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  plan_started_at  TIMESTAMPTZ,
  plan_expires_at  TIMESTAMPTZ,
  signup_method    TEXT        DEFAULT 'email' CHECK (signup_method IN ('email', 'google')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블 대응: 누락 컬럼 안전 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan             TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_started_at  TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at  TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_method    TEXT DEFAULT 'email';

-- plan CHECK 제약 보완 (없으면 추가)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_plan_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
      CHECK (plan IN ('free', 'pro', 'enterprise'));
  END IF;
END $$;

-- 기존 rows 백필
UPDATE public.profiles SET plan          = 'free'  WHERE plan IS NULL OR plan = '';
UPDATE public.profiles SET signup_method = 'email' WHERE signup_method IS NULL;

-- ── 1-3. persona_settings: UUID PK로 완전 재설계 ────────────────────────────
-- v3부터 id=1 방식 폐기 → academy_id IS NULL = 전역 기본 페르소나
-- 기존 테이블이 INTEGER pk이든 UUID pk이든 안전하게 처리합니다.

-- 기존 테이블 삭제 후 재생성 (데이터 없으면 안전, 있으면 아래 백업 구문 사용)
DO $$
BEGIN
  -- persona_settings 테이블이 존재하면 기존 스키마 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'persona_settings'
  ) THEN
    -- id 컬럼 타입이 integer든 uuid든 새 컬럼만 안전하게 추가
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'empathetic';
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS empathy_level INTEGER NOT NULL DEFAULT 70;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS formality INTEGER NOT NULL DEFAULT 65;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS custom_instructions TEXT NOT NULL DEFAULT '';
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS response_length TEXT NOT NULL DEFAULT 'medium';
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSE
    -- 테이블이 없으면 새로 생성 (UUID PK)
    CREATE TABLE public.persona_settings (
      id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      academy_id          UUID        REFERENCES public.academies(id) ON DELETE CASCADE,
      tone                TEXT        NOT NULL DEFAULT 'empathetic'
                                      CHECK (tone IN ('empathetic', 'logical', 'assertive')),
      empathy_level       INTEGER     NOT NULL DEFAULT 70 CHECK (empathy_level BETWEEN 0 AND 100),
      formality           INTEGER     NOT NULL DEFAULT 65 CHECK (formality BETWEEN 0 AND 100),
      custom_instructions TEXT        NOT NULL DEFAULT '',
      response_length     TEXT        NOT NULL DEFAULT 'medium'
                                      CHECK (response_length IN ('short', 'medium', 'long')),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- 전역 기본 페르소나 행 보장 (academy_id IS NULL = 모든 학원 공용)
-- id 타입에 관계없이 academy_id IS NULL인 행이 없을 때만 삽입
INSERT INTO public.persona_settings (tone, empathy_level, formality, custom_instructions, response_length)
SELECT 'empathetic', 70, 65, '', 'medium'
WHERE NOT EXISTS (
  SELECT 1 FROM public.persona_settings WHERE academy_id IS NULL
);

-- ── 1-4. counseling_logs: 학생 연결 + 확장 컬럼 추가 ─────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_logs (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id      UUID        REFERENCES public.academies(id) ON DELETE CASCADE,
  analyzed_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id      UUID,       -- REFERENCES public.students(id) — 아래에서 추가
  contact_type    TEXT        NOT NULL DEFAULT 'student'
                              CHECK (contact_type IN ('student','father','mother','guardian','other')),
  original_text   TEXT        NOT NULL,
  sanitized_text  TEXT        NOT NULL,
  analysis_mode   TEXT        NOT NULL DEFAULT 'general'
                              CHECK (analysis_mode IN ('general','deep')),
  risk_score      INTEGER     CHECK (risk_score BETWEEN 0 AND 100),
  positive_score  INTEGER     CHECK (positive_score BETWEEN 0 AND 100),
  negative_score  INTEGER     CHECK (negative_score BETWEEN 0 AND 100),
  neutral_score   INTEGER     CHECK (neutral_score BETWEEN 0 AND 100),
  keywords        TEXT[]      NOT NULL DEFAULT '{}',
  subject         TEXT        NOT NULL DEFAULT 'general',
  ai_response     TEXT,
  result          JSONB       NOT NULL DEFAULT '{}',
  history_summary TEXT,
  history_used    BOOLEAN     NOT NULL DEFAULT FALSE,
  history_count   INTEGER     NOT NULL DEFAULT 0,
  chunks_used     INTEGER     NOT NULL DEFAULT 0,
  cases_used      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 counseling_logs에 누락 컬럼 안전 추가 (원본 컬럼 포함 — 멱등성 보장)
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS original_text   TEXT NOT NULL DEFAULT '';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS sanitized_text  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS analysis_mode   TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS risk_score      INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS positive_score  INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS negative_score  INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS keywords        TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS result          JSONB  NOT NULL DEFAULT '{}';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- v3 신규 컬럼
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS academy_id      UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS analyzed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS student_id      UUID;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS contact_type    TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS neutral_score   INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS subject         TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS ai_response     TEXT;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_summary TEXT;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_used    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS chunks_used     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS cases_used      INTEGER NOT NULL DEFAULT 0;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: 신규 테이블 생성
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 2-1. plan_history: 요금제 변경 이력 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_history (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id  UUID        REFERENCES public.academies(id) ON DELETE SET NULL,
  from_plan   TEXT        CHECK (from_plan IN ('free','pro','enterprise')),
  to_plan     TEXT        NOT NULL CHECK (to_plan IN ('free','pro','enterprise')),
  changed_by  TEXT        NOT NULL DEFAULT 'user'
              CHECK (changed_by IN ('user','admin','system','webhook')),
  reason      TEXT        NOT NULL DEFAULT 'upgrade'
              CHECK (reason IN ('signup','upgrade','downgrade','expired','admin_grant','refund')),
  payment_ref TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2-2. students: 학생 정보 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id          UUID        NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  grade               TEXT,
  school              TEXT,
  memo                TEXT,
  status              TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','withdrawn','prospect')),
  assigned_teacher_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  latest_risk_score   INTEGER     NOT NULL DEFAULT 0 CHECK (latest_risk_score BETWEEN 0 AND 100),
  last_contacted_at   TIMESTAMPTZ,
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2-3. counseling_contacts: 학생 보호자 연락처 ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_contacts (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academy_id    UUID        NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  contact_type  TEXT        NOT NULL
                CHECK (contact_type IN ('father','mother','guardian','other')),
  name          TEXT        NOT NULL DEFAULT '미등록',
  phone         TEXT,
  relationship  TEXT,
  is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  memo          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, contact_type)
);

-- ── 2-4. manual_sources: 매뉴얼 소스 문서 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_sources (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id        UUID        REFERENCES public.academies(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  priority          TEXT        NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
  subject           TEXT        NOT NULL DEFAULT 'general'
                    CHECK (subject IN (
                      'general','churn_risk','complaint','achievement',
                      'fee','schedule','refund'
                    )),
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  entry_type        TEXT        NOT NULL DEFAULT 'text'
                    CHECK (entry_type IN ('text','pdf','image')),
  original_filename TEXT,
  storage_path      TEXT,
  file_size_bytes   BIGINT,
  ocr_used          BOOLEAN     NOT NULL DEFAULT FALSE,
  total_characters  INTEGER     NOT NULL DEFAULT 0,
  total_chunks      INTEGER     NOT NULL DEFAULT 1,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2-5. knowledge_chunks: RAG 검색 단위 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id   UUID        NOT NULL REFERENCES public.manual_sources(id) ON DELETE CASCADE,
  academy_id  UUID        REFERENCES public.academies(id) ON DELETE CASCADE,
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  content     TEXT        NOT NULL,
  priority    TEXT        NOT NULL DEFAULT 'medium',
  subject     TEXT        NOT NULL DEFAULT 'general',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  -- embedding VECTOR(768),  ← pgvector 활성화 후 주석 해제
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2-6. counseling_cases: 모범 사례 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_cases (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id    UUID        REFERENCES public.academies(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  priority      TEXT        NOT NULL DEFAULT 'high'
                CHECK (priority IN ('high','medium','low')),
  subject       TEXT        NOT NULL DEFAULT 'general'
                CHECK (subject IN (
                  'general','churn_risk','complaint','achievement',
                  'fee','schedule','refund'
                )),
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  situation     TEXT        NOT NULL,
  response      TEXT        NOT NULL,
  outcome       TEXT        NOT NULL,
  outcome_type  TEXT        NOT NULL DEFAULT 'success'
                CHECK (outcome_type IN ('success','failure','neutral')),
  log_id        UUID        REFERENCES public.counseling_logs(id) ON DELETE SET NULL,
  risk_score    INTEGER,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: 외래 키 지연 추가 (students 테이블이 생긴 후)
-- ══════════════════════════════════════════════════════════════════════════════

-- counseling_logs.student_id → students.id FK (students 테이블 생성 이후 추가 가능)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'counseling_logs_student_id_fkey'
      AND conrelid = 'public.counseling_logs'::regclass
  ) THEN
    ALTER TABLE public.counseling_logs
      ADD CONSTRAINT counseling_logs_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: 인덱스
-- ══════════════════════════════════════════════════════════════════════════════

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_academy_role      ON public.profiles(academy_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires       ON public.profiles(plan, plan_expires_at);

-- plan_history
CREATE INDEX IF NOT EXISTS idx_plan_history_user           ON public.plan_history(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_history_academy        ON public.plan_history(academy_id, changed_at DESC);

-- students
CREATE INDEX IF NOT EXISTS idx_students_academy_status     ON public.students(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_students_risk_score         ON public.students(academy_id, latest_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_students_teacher            ON public.students(assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_last_contacted     ON public.students(academy_id, last_contacted_at DESC);

-- counseling_contacts
CREATE INDEX IF NOT EXISTS idx_contacts_student            ON public.counseling_contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_contacts_academy            ON public.counseling_contacts(academy_id);

-- manual_sources
CREATE INDEX IF NOT EXISTS idx_manual_sources_academy      ON public.manual_sources(academy_id, is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_manual_sources_subject      ON public.manual_sources(academy_id, subject);

-- knowledge_chunks (핵심 RAG 쿼리)
CREATE INDEX IF NOT EXISTS idx_chunks_academy_subject      ON public.knowledge_chunks(academy_id, subject, priority DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_source               ON public.knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_academy_created      ON public.knowledge_chunks(academy_id, created_at DESC);

-- counseling_cases
CREATE INDEX IF NOT EXISTS idx_cases_academy_outcome       ON public.counseling_cases(academy_id, is_active, outcome_type);
CREATE INDEX IF NOT EXISTS idx_cases_subject_priority      ON public.counseling_cases(academy_id, subject, priority DESC);

-- counseling_logs
CREATE INDEX IF NOT EXISTS idx_logs_academy_created        ON public.counseling_logs(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_student_created        ON public.counseling_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_analyzed_by            ON public.counseling_logs(analyzed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_risk_score             ON public.counseling_logs(academy_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_logs_student_contact        ON public.counseling_logs(student_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_logs_subject                ON public.counseling_logs(academy_id, subject, created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: 헬퍼 함수 (RLS에서 사용)
-- ══════════════════════════════════════════════════════════════════════════════

-- 현재 유저의 academy_id 반환
CREATE OR REPLACE FUNCTION public.get_user_academy_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academy_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 현재 유저의 role 반환
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 초대 코드 생성 헬퍼
CREATE OR REPLACE FUNCTION public.generate_academy_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: 트리거
-- ══════════════════════════════════════════════════════════════════════════════

-- ── T1: 신규 유저 생성 시 profiles 자동 생성 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider     TEXT;
  v_signup_method TEXT;
BEGIN
  -- OAuth provider 확인
  v_provider := NEW.raw_app_meta_data->>'provider';
  v_signup_method := CASE
    WHEN v_provider = 'google' THEN 'google'
    ELSE 'email'
  END;

  BEGIN
    INSERT INTO public.profiles (
      id, email, role, academy_id,
      plan, plan_started_at, signup_method
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
      NULLIF(NULLIF(NEW.raw_user_meta_data->>'academy_id', ''), 'null')::UUID,
      'free',
      NOW(),
      v_signup_method
    )
    ON CONFLICT (id) DO UPDATE
      SET email         = EXCLUDED.email,
          role          = EXCLUDED.role,
          academy_id    = EXCLUDED.academy_id,
          updated_at    = NOW();
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 트리거 실패 시에도 유저 생성 계속 진행
  END;

  -- 학원장(director)이면 academies.owner_id 업데이트
  BEGIN
    IF NEW.raw_user_meta_data->>'role' = 'director'
       AND NEW.raw_user_meta_data->>'academy_id' IS NOT NULL
       AND NEW.raw_user_meta_data->>'academy_id' != ''
    THEN
      UPDATE public.academies
        SET owner_id   = NEW.id,
            updated_at = NOW()
      WHERE id = (NEW.raw_user_meta_data->>'academy_id')::UUID
        AND owner_id IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── T2: 상담 로그 INSERT 시 학생 위험도 자동 갱신 ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_student_after_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- student_id가 없으면 (prospect/익명) 아무것도 하지 않음
  IF NEW.student_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- risk_score가 NULL이면 갱신하지 않음
  IF NEW.risk_score IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.students
  SET
    latest_risk_score = NEW.risk_score,
    last_contacted_at = NEW.created_at,
    updated_at        = NOW()
  WHERE id = NEW.student_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_student_after_log ON public.counseling_logs;
CREATE TRIGGER trg_update_student_after_log
  AFTER INSERT ON public.counseling_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_student_after_log();


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════════════════════

-- RLS 활성화
ALTER TABLE public.academies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_cases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_logs     ENABLE ROW LEVEL SECURITY;

-- ── academies ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "academies_select" ON public.academies;
CREATE POLICY "academies_select" ON public.academies
  FOR SELECT USING (
    id = public.get_user_academy_id()
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "academies_insert" ON public.academies;
CREATE POLICY "academies_insert" ON public.academies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "academies_update" ON public.academies;
CREATE POLICY "academies_update" ON public.academies
  FOR UPDATE USING (
    id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      academy_id = public.get_user_academy_id()
      AND public.get_user_role() IN ('admin', 'director')
    )
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ── plan_history ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "plan_history_select" ON public.plan_history;
CREATE POLICY "plan_history_select" ON public.plan_history
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- ── students: 역할별 차등 접근 ──────────────────────────────────────────────
DROP POLICY IF EXISTS "students_select" ON public.students;
CREATE POLICY "students_select" ON public.students
  FOR SELECT USING (
    academy_id = public.get_user_academy_id()
    AND (
      public.get_user_role() IN ('admin', 'director')
      OR assigned_teacher_id = auth.uid()
      OR assigned_teacher_id IS NULL
    )
  );

DROP POLICY IF EXISTS "students_insert" ON public.students;
CREATE POLICY "students_insert" ON public.students
  FOR INSERT WITH CHECK (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

DROP POLICY IF EXISTS "students_update" ON public.students;
CREATE POLICY "students_update" ON public.students
  FOR UPDATE USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

DROP POLICY IF EXISTS "students_delete" ON public.students;
CREATE POLICY "students_delete" ON public.students
  FOR DELETE USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── counseling_contacts: director 이상만 (PII 보호) ────────────────────────
DROP POLICY IF EXISTS "contacts_select" ON public.counseling_contacts;
CREATE POLICY "contacts_select" ON public.counseling_contacts
  FOR SELECT USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

DROP POLICY IF EXISTS "contacts_write" ON public.counseling_contacts;
CREATE POLICY "contacts_write" ON public.counseling_contacts
  FOR ALL USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── manual_sources: 공용(academy_id IS NULL) 또는 내 학원 ──────────────────
DROP POLICY IF EXISTS "manual_sources_select" ON public.manual_sources;
CREATE POLICY "manual_sources_select" ON public.manual_sources
  FOR SELECT USING (
    academy_id IS NULL
    OR academy_id = public.get_user_academy_id()
  );

DROP POLICY IF EXISTS "manual_sources_write" ON public.manual_sources;
CREATE POLICY "manual_sources_write" ON public.manual_sources
  FOR ALL USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── knowledge_chunks ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "knowledge_chunks_select" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks_select" ON public.knowledge_chunks
  FOR SELECT USING (
    academy_id IS NULL
    OR academy_id = public.get_user_academy_id()
  );

DROP POLICY IF EXISTS "knowledge_chunks_write" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks_write" ON public.knowledge_chunks
  FOR ALL USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── counseling_cases ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cases_select" ON public.counseling_cases;
CREATE POLICY "cases_select" ON public.counseling_cases
  FOR SELECT USING (
    academy_id IS NULL
    OR academy_id = public.get_user_academy_id()
  );

DROP POLICY IF EXISTS "cases_write" ON public.counseling_cases;
CREATE POLICY "cases_write" ON public.counseling_cases
  FOR ALL USING (
    academy_id = public.get_user_academy_id()
    AND public.get_user_role() IN ('admin', 'director')
  );

-- ── persona_settings ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "persona_select" ON public.persona_settings;
CREATE POLICY "persona_select" ON public.persona_settings
  FOR SELECT USING (
    academy_id IS NULL
    OR academy_id = public.get_user_academy_id()
  );

DROP POLICY IF EXISTS "persona_write" ON public.persona_settings;
CREATE POLICY "persona_write" ON public.persona_settings
  FOR ALL USING (
    academy_id IS NULL
    OR (
      academy_id = public.get_user_academy_id()
      AND public.get_user_role() IN ('admin', 'director')
    )
  );

-- ── counseling_logs: 분석은 모두 가능, 조회는 역할 기반 ─────────────────────
DROP POLICY IF EXISTS "logs_select" ON public.counseling_logs;
CREATE POLICY "logs_select" ON public.counseling_logs
  FOR SELECT USING (
    academy_id = public.get_user_academy_id()
    AND (
      public.get_user_role() IN ('admin', 'director')
      OR analyzed_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "logs_insert" ON public.counseling_logs;
CREATE POLICY "logs_insert" ON public.counseling_logs
  FOR INSERT WITH CHECK (
    academy_id = public.get_user_academy_id()
  );

-- UPDATE / DELETE 정책 미생성 → counseling_logs는 불변(immutable) 로그


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: knowledge_base → 신규 테이블로 데이터 이전 (선택적 실행)
-- ══════════════════════════════════════════════════════════════════════════════
-- 기존 knowledge_base의 manual 항목 → manual_sources + knowledge_chunks
-- 기존 knowledge_base의 case 항목   → counseling_cases
-- 아직 실행하지 마세요. Phase 5에서 기존 테이블과 함께 마이그레이션합니다.

/*
-- [Phase 5에서 실행] knowledge_base manual → manual_sources + knowledge_chunks
INSERT INTO public.manual_sources (academy_id, title, priority, subject, entry_type, total_characters, total_chunks, created_at)
SELECT
  academy_id,
  title,
  CASE WHEN priority IN ('critical','high','medium','low') THEN priority ELSE 'medium' END,
  'general',
  'text',
  length(content),
  1,
  created_at
FROM public.knowledge_base
WHERE category = 'manual'
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_chunks (source_id, academy_id, chunk_index, content, priority, subject, tags, created_at)
SELECT
  ms.id,
  kb.academy_id,
  0,
  kb.content,
  CASE WHEN kb.priority IN ('critical','high','medium','low') THEN kb.priority ELSE 'medium' END,
  'general',
  COALESCE(kb.tags, '{}'),
  kb.created_at
FROM public.knowledge_base kb
JOIN public.manual_sources ms ON ms.title = kb.title AND ms.academy_id IS NOT DISTINCT FROM kb.academy_id
WHERE kb.category = 'manual'
ON CONFLICT DO NOTHING;

-- [Phase 5에서 실행] knowledge_base case → counseling_cases
INSERT INTO public.counseling_cases (academy_id, title, priority, subject, tags, situation, response, outcome, outcome_type, created_at)
SELECT
  academy_id,
  title,
  CASE WHEN priority IN ('high','medium','low') THEN priority ELSE 'medium' END,
  'general',
  COALESCE(tags, '{}'),
  COALESCE(situation, content),
  COALESCE(response, ''),
  COALESCE(outcome, ''),
  'success',
  created_at
FROM public.knowledge_base
WHERE category = 'case'
ON CONFLICT DO NOTHING;
*/


-- ══════════════════════════════════════════════════════════════════════════════
-- 완료 확인
-- ══════════════════════════════════════════════════════════════════════════════
-- 아래 쿼리로 생성된 테이블 수를 확인하세요 (10개 이상이면 성공):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
