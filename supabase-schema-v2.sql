-- ══════════════════════════════════════════════════════════════════════════════
-- EduMind Insight — Schema v2: 다중 학원 조직 관리 시스템
-- Supabase SQL Editor 에서 실행하세요.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. academies 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,          -- 선생님 초대 코드 (8자리)
  owner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. profiles 테이블 ──────────────────────────────────────────────────────
-- auth.users 의 확장 테이블. 역할(role)과 소속 학원(academy_id)을 저장합니다.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'teacher'
                CHECK (role IN ('admin', 'director', 'teacher')),
  academy_id  UUID REFERENCES academies(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. academies: 누락된 컬럼 안전 추가 (기존 테이블 대응) ─────────────────
ALTER TABLE academies ADD COLUMN IF NOT EXISTS code       TEXT UNIQUE;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- code 가 NULL 인 기존 행에 자동 코드 부여
UPDATE academies SET code = upper(substr(md5(random()::text || id::text), 1, 8))
  WHERE code IS NULL OR code = '';

-- ── 4. knowledge_base: academy_id 컬럼 추가 ────────────────────────────────
-- NULL = 글로벌(모든 학원 공유), UUID = 특정 학원 전용
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES academies(id) ON DELETE CASCADE;

-- ── 5. persona_settings: academy_id 컬럼 추가 ──────────────────────────────
ALTER TABLE persona_settings
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES academies(id) ON DELETE CASCADE;

-- ── 6. counseling_logs: academy_id 컬럼 추가 ───────────────────────────────
ALTER TABLE counseling_logs
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES academies(id) ON DELETE SET NULL;

-- ── 7. RLS 정책 ─────────────────────────────────────────────────────────────
ALTER TABLE academies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;

-- academies: 내 소속 학원만 조회 가능 (서비스 롤은 항상 통과)
DROP POLICY IF EXISTS "academy_select" ON academies;
CREATE POLICY "academy_select" ON academies
  FOR SELECT USING (
    id IN (SELECT academy_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "academy_insert" ON academies;
CREATE POLICY "academy_insert" ON academies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- profiles: 본인 프로필만 읽기/수정 가능
DROP POLICY IF EXISTS "profile_select" ON profiles;
CREATE POLICY "profile_select" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profile_insert" ON profiles;
CREATE POLICY "profile_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_update" ON profiles;
CREATE POLICY "profile_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── 8. 신규 가입 시 자동 profile 생성 트리거 ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- profiles 테이블이 없거나 오류 발생 시 유저 생성은 계속 진행
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, academy_id)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
      NULLIF(NEW.raw_user_meta_data->>'academy_id', '')::UUID
    )
    ON CONFLICT (id) DO UPDATE
      SET email      = EXCLUDED.email,
          full_name  = EXCLUDED.full_name,
          role       = EXCLUDED.role,
          academy_id = EXCLUDED.academy_id,
          updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- 트리거 실패 시에도 유저 생성은 성공하도록 무시
    NULL;
  END;

  -- 학원장(director)이면 academies.owner_id 도 함께 업데이트
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

-- ── 9. 초대 코드 생성 헬퍼 함수 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_academy_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;
