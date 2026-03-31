-- profiles 테이블에 요금제 및 가입 방법 컬럼 추가
-- 실행: Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_method TEXT DEFAULT 'email'
    CHECK (signup_method IN ('email', 'google'));

-- 소셜 신규 가입 시 plan은 자동으로 'free' 세팅됨 (DEFAULT)

-- 기존 rows: plan NULL → 'free' 로 백필 (DEFAULT가 이미 적용되므로 사실상 불필요하나 안전하게)
UPDATE public.profiles
  SET plan = 'free'
  WHERE plan IS NULL OR plan = '';

-- 기존 rows: signup_method NULL → 'email' 로 백필
UPDATE public.profiles
  SET signup_method = 'email'
  WHERE signup_method IS NULL;
