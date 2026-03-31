import { NextResponse } from "next/server"
import { getUserProfile } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

// v3 전체 스키마 SQL — supabase/migrations/v3_full_schema.sql 과 동일한 내용
// 변경 시 두 파일 모두 업데이트하세요.
const SETUP_SQL = `
-- ── 1. academies ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='academies_code_key' AND conrelid='public.academies'::regclass) THEN ALTER TABLE public.academies ADD CONSTRAINT academies_code_key UNIQUE (code); END IF; END $$;
UPDATE public.academies SET code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE code IS NULL OR code = '';

-- ── 2. profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin','director','teacher')),
  academy_id UUID REFERENCES public.academies(id) ON DELETE SET NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  signup_method TEXT DEFAULT 'email' CHECK (signup_method IN ('email','google')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_method TEXT DEFAULT 'email';
UPDATE public.profiles SET plan='free' WHERE plan IS NULL OR plan='';
UPDATE public.profiles SET signup_method='email' WHERE signup_method IS NULL;

-- ── 3. persona_settings (UUID PK, id=1 방식 폐기) ────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='persona_settings') THEN
    BEGIN ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS response_length TEXT NOT NULL DEFAULT 'medium'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.persona_settings ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSE
    CREATE TABLE public.persona_settings (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
      tone TEXT NOT NULL DEFAULT 'empathetic' CHECK (tone IN ('empathetic','logical','assertive')),
      empathy_level INTEGER NOT NULL DEFAULT 70,
      formality INTEGER NOT NULL DEFAULT 65,
      custom_instructions TEXT NOT NULL DEFAULT '',
      response_length TEXT NOT NULL DEFAULT 'medium' CHECK (response_length IN ('short','medium','long')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;
INSERT INTO public.persona_settings (tone,empathy_level,formality,custom_instructions,response_length) SELECT 'empathetic',70,65,'','medium' WHERE NOT EXISTS (SELECT 1 FROM public.persona_settings WHERE academy_id IS NULL);

-- ── 4. counseling_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  analyzed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id UUID,
  contact_type TEXT NOT NULL DEFAULT 'student' CHECK (contact_type IN ('student','father','mother','guardian','other')),
  original_text TEXT NOT NULL,
  sanitized_text TEXT NOT NULL,
  analysis_mode TEXT NOT NULL DEFAULT 'general' CHECK (analysis_mode IN ('general','deep')),
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  positive_score INTEGER CHECK (positive_score BETWEEN 0 AND 100),
  negative_score INTEGER CHECK (negative_score BETWEEN 0 AND 100),
  neutral_score INTEGER CHECK (neutral_score BETWEEN 0 AND 100),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT 'general',
  ai_response TEXT,
  result JSONB NOT NULL DEFAULT '{}',
  history_summary TEXT,
  history_used BOOLEAN NOT NULL DEFAULT FALSE,
  history_count INTEGER NOT NULL DEFAULT 0,
  chunks_used INTEGER NOT NULL DEFAULT 0,
  cases_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS original_text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS sanitized_text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS analysis_mode TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS positive_score INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS negative_score INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS result JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS analyzed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS neutral_score INTEGER;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS ai_response TEXT;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_summary TEXT;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS history_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS chunks_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.counseling_logs ADD COLUMN IF NOT EXISTS cases_used INTEGER NOT NULL DEFAULT 0;

-- ── 5. plan_history ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id UUID REFERENCES public.academies(id) ON DELETE SET NULL,
  from_plan TEXT CHECK (from_plan IN ('free','pro','enterprise')),
  to_plan TEXT NOT NULL CHECK (to_plan IN ('free','pro','enterprise')),
  changed_by TEXT NOT NULL DEFAULT 'user' CHECK (changed_by IN ('user','admin','system','webhook')),
  reason TEXT NOT NULL DEFAULT 'upgrade' CHECK (reason IN ('signup','upgrade','downgrade','expired','admin_grant','refund')),
  payment_ref TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. students ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  school TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','withdrawn','prospect')),
  assigned_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  latest_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (latest_risk_score BETWEEN 0 AND 100),
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. counseling_contacts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('father','mother','guardian','other')),
  name TEXT NOT NULL DEFAULT '미등록',
  phone TEXT,
  relationship TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, contact_type)
);

-- ── 8. manual_sources ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  subject TEXT NOT NULL DEFAULT 'general' CHECK (subject IN ('general','churn_risk','complaint','achievement','fee','schedule','refund')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  entry_type TEXT NOT NULL DEFAULT 'text' CHECK (entry_type IN ('text','pdf','image')),
  original_filename TEXT,
  storage_path TEXT,
  file_size_bytes BIGINT,
  ocr_used BOOLEAN NOT NULL DEFAULT FALSE,
  total_characters INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9. knowledge_chunks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.manual_sources(id) ON DELETE CASCADE,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  subject TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 10. counseling_cases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counseling_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('high','medium','low')),
  subject TEXT NOT NULL DEFAULT 'general' CHECK (subject IN ('general','churn_risk','complaint','achievement','fee','schedule','refund')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  situation TEXT NOT NULL,
  response TEXT NOT NULL,
  outcome TEXT NOT NULL,
  outcome_type TEXT NOT NULL DEFAULT 'success' CHECK (outcome_type IN ('success','failure','neutral')),
  log_id UUID REFERENCES public.counseling_logs(id) ON DELETE SET NULL,
  risk_score INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 11. knowledge_base (기존 테이블 유지 - Phase 5에서 마이그레이션 후 삭제) ──
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  situation TEXT, response TEXT, outcome TEXT,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 12. 외래 키 지연 추가 (students 생성 후) ──────────────────────────────────
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='counseling_logs_student_id_fkey' AND conrelid='public.counseling_logs'::regclass) THEN ALTER TABLE public.counseling_logs ADD CONSTRAINT counseling_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL; END IF; END $$;

-- ── 13. 헬퍼 함수 ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_academy_id() RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT academy_id FROM public.profiles WHERE id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION public.generate_academy_code() RETURNS TEXT LANGUAGE sql AS $$ SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)); $$;

-- ── 14. 트리거 ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_provider TEXT; v_signup_method TEXT;
BEGIN
  v_provider := NEW.raw_app_meta_data->>'provider';
  v_signup_method := CASE WHEN v_provider='google' THEN 'google' ELSE 'email' END;
  BEGIN
    INSERT INTO public.profiles (id,email,role,academy_id,plan,plan_started_at,signup_method)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role','teacher'), NULLIF(NULLIF(NEW.raw_user_meta_data->>'academy_id',''),'null')::UUID, 'free', NOW(), v_signup_method)
    ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role, academy_id=EXCLUDED.academy_id, updated_at=NOW();
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    IF NEW.raw_user_meta_data->>'role'='director' AND NEW.raw_user_meta_data->>'academy_id' IS NOT NULL AND NEW.raw_user_meta_data->>'academy_id'!='' THEN
      UPDATE public.academies SET owner_id=NEW.id, updated_at=NOW() WHERE id=(NEW.raw_user_meta_data->>'academy_id')::UUID AND owner_id IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.fn_update_student_after_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.student_id IS NULL OR NEW.risk_score IS NULL THEN RETURN NEW; END IF;
  UPDATE public.students SET latest_risk_score=NEW.risk_score, last_contacted_at=NEW.created_at, updated_at=NOW() WHERE id=NEW.student_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_update_student_after_log ON public.counseling_logs;
CREATE TRIGGER trg_update_student_after_log AFTER INSERT ON public.counseling_logs FOR EACH ROW EXECUTE FUNCTION public.fn_update_student_after_log();

-- ── 15. RLS ───────────────────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "academies_select"   ON public.academies;
CREATE POLICY "academies_select"   ON public.academies   FOR SELECT USING (id=public.get_user_academy_id() OR public.get_user_role()='admin');
DROP POLICY IF EXISTS "academies_insert"   ON public.academies;
CREATE POLICY "academies_insert"   ON public.academies   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "academies_update"   ON public.academies;
CREATE POLICY "academies_update"   ON public.academies   FOR UPDATE USING (id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "profiles_select"    ON public.profiles;
CREATE POLICY "profiles_select"    ON public.profiles    FOR SELECT USING (id=auth.uid() OR (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director')));
DROP POLICY IF EXISTS "profiles_insert"    ON public.profiles;
CREATE POLICY "profiles_insert"    ON public.profiles    FOR INSERT WITH CHECK (id=auth.uid());
DROP POLICY IF EXISTS "profiles_update"    ON public.profiles;
CREATE POLICY "profiles_update"    ON public.profiles    FOR UPDATE USING (id=auth.uid());
DROP POLICY IF EXISTS "plan_history_select" ON public.plan_history;
CREATE POLICY "plan_history_select" ON public.plan_history FOR SELECT USING (user_id=auth.uid() OR public.get_user_role()='admin');
DROP POLICY IF EXISTS "students_select"    ON public.students;
CREATE POLICY "students_select"    ON public.students    FOR SELECT USING (academy_id=public.get_user_academy_id() AND (public.get_user_role() IN ('admin','director') OR assigned_teacher_id=auth.uid() OR assigned_teacher_id IS NULL));
DROP POLICY IF EXISTS "students_insert"    ON public.students;
CREATE POLICY "students_insert"    ON public.students    FOR INSERT WITH CHECK (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "students_update"    ON public.students;
CREATE POLICY "students_update"    ON public.students    FOR UPDATE USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "students_delete"    ON public.students;
CREATE POLICY "students_delete"    ON public.students    FOR DELETE USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "contacts_select"    ON public.counseling_contacts;
CREATE POLICY "contacts_select"    ON public.counseling_contacts FOR SELECT USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "contacts_write"     ON public.counseling_contacts;
CREATE POLICY "contacts_write"     ON public.counseling_contacts FOR ALL   USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "manual_sources_select" ON public.manual_sources;
CREATE POLICY "manual_sources_select" ON public.manual_sources FOR SELECT USING (academy_id IS NULL OR academy_id=public.get_user_academy_id());
DROP POLICY IF EXISTS "manual_sources_write"  ON public.manual_sources;
CREATE POLICY "manual_sources_write"  ON public.manual_sources FOR ALL    USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "chunks_select"      ON public.knowledge_chunks;
CREATE POLICY "chunks_select"      ON public.knowledge_chunks  FOR SELECT USING (academy_id IS NULL OR academy_id=public.get_user_academy_id());
DROP POLICY IF EXISTS "chunks_write"       ON public.knowledge_chunks;
CREATE POLICY "chunks_write"       ON public.knowledge_chunks  FOR ALL    USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "cases_select"       ON public.counseling_cases;
CREATE POLICY "cases_select"       ON public.counseling_cases  FOR SELECT USING (academy_id IS NULL OR academy_id=public.get_user_academy_id());
DROP POLICY IF EXISTS "cases_write"        ON public.counseling_cases;
CREATE POLICY "cases_write"        ON public.counseling_cases  FOR ALL    USING (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director'));
DROP POLICY IF EXISTS "persona_select"     ON public.persona_settings;
CREATE POLICY "persona_select"     ON public.persona_settings  FOR SELECT USING (academy_id IS NULL OR academy_id=public.get_user_academy_id());
DROP POLICY IF EXISTS "persona_write"      ON public.persona_settings;
CREATE POLICY "persona_write"      ON public.persona_settings  FOR ALL    USING (academy_id IS NULL OR (academy_id=public.get_user_academy_id() AND public.get_user_role() IN ('admin','director')));
DROP POLICY IF EXISTS "logs_select"        ON public.counseling_logs;
CREATE POLICY "logs_select"        ON public.counseling_logs   FOR SELECT USING (academy_id=public.get_user_academy_id() AND (public.get_user_role() IN ('admin','director') OR analyzed_by=auth.uid()));
DROP POLICY IF EXISTS "logs_insert"        ON public.counseling_logs;
CREATE POLICY "logs_insert"        ON public.counseling_logs   FOR INSERT WITH CHECK (academy_id=public.get_user_academy_id());
`.trim()

export async function POST(req: Request) {
  try {
    // admin 또는 director 만 실행 가능
    const profile = await getUserProfile()
    if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
      return NextResponse.json({ error: "관리자 또는 학원장만 실행할 수 있습니다." }, { status: 403 })
    }

    // 요청 body에서 accessToken 읽기 (런타임 입력 지원)
    let bodyAccessToken: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      bodyAccessToken = body?.accessToken ?? null
    } catch { /* ignore */ }

    // 방법 1: DATABASE_URL / POSTGRES_URL 직접 연결
    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.SUPABASE_DB_URL

    if (dbUrl) {
      const { Client } = await import("pg")
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      try {
        await client.connect()
        await client.query(SETUP_SQL)
        await client.end()
        return NextResponse.json({ success: true, method: "direct_db", message: "데이터베이스 설정이 완료되었습니다." })
      } catch (pgErr) {
        await client.end().catch(() => {})
        console.error("[setup] pg error:", pgErr)
      }
    }

    // 방법 2: Supabase Management API (환경변수 또는 런타임 토큰)
    const mgmtToken = bodyAccessToken || process.env.SUPABASE_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

    if (mgmtToken && projectRef) {
      try {
        const res = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: SETUP_SQL }),
          }
        )
        if (res.ok) {
          return NextResponse.json({ success: true, method: "management_api", message: "데이터베이스 설정이 완료되었습니다." })
        }
        const errBody = await res.json().catch(() => ({}))
        console.warn("[setup] mgmt API failed:", errBody)
        if (res.status === 401) {
          return NextResponse.json({ success: false, method: "manual", message: "토큰이 유효하지 않습니다. Personal Access Token을 다시 확인해주세요.", sql: SETUP_SQL })
        }
      } catch (mgmtErr) {
        console.error("[setup] management API error:", mgmtErr)
      }
    }

    // 방법 3: SQL을 반환하여 사용자가 직접 실행
    return NextResponse.json({
      success: false,
      method: "manual",
      message: "아래 SQL을 Supabase SQL Editor에서 실행해주세요.",
      sql: SETUP_SQL,
    })
  } catch (err) {
    console.error("[POST /api/setup]", err)
    return NextResponse.json({
      success: false,
      method: "manual",
      message: "아래 SQL을 Supabase SQL Editor에서 실행해주세요.",
      sql: SETUP_SQL,
    })
  }
}

export async function GET() {
  // 인증 없이 SQL만 반환 (개발 편의용)
  return NextResponse.json({ sql: SETUP_SQL })
}
