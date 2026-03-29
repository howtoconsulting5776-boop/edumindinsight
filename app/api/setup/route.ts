import { NextResponse } from "next/server"
import { getUserProfile } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

// 전체 필수 SQL: 모든 테이블 생성 + 트리거
const SETUP_SQL = `
-- 1. profiles 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'director', 'teacher')),
  academy_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. academies 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS public.academies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. handle_new_user 트리거 함수를 EXCEPTION 처리 포함으로 교체
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, academy_id)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
      NULLIF(NULLIF(NEW.raw_user_meta_data->>'academy_id', ''), 'null')::UUID
    )
    ON CONFLICT (id) DO UPDATE
      SET email      = EXCLUDED.email,
          full_name  = EXCLUDED.full_name,
          role       = EXCLUDED.role,
          academy_id = EXCLUDED.academy_id,
          updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- 4. 트리거 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. knowledge_base 테이블 (없으면 생성, 있으면 누락 컬럼 추가)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category   TEXT NOT NULL DEFAULT 'general',
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  priority   TEXT NOT NULL DEFAULT 'medium',
  tags       TEXT[] DEFAULT '{}',
  situation  TEXT,
  response   TEXT,
  outcome    TEXT,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS tags       TEXT[] DEFAULT '{}';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS situation  TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS response   TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS outcome    TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. persona_settings 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS public.persona_settings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  persona    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`.trim()

export async function POST() {
  try {
    // admin/super admin 만 실행 가능
    const profile = await getUserProfile()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "슈퍼 어드민만 실행할 수 있습니다." }, { status: 403 })
    }

    // 방법 1: DATABASE_URL / POSTGRES_URL 직접 연결 (Vercel+Supabase 통합 시 자동 제공)
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
        // 실패해도 SQL 반환
      }
    }

    // 방법 2: SQL을 반환하여 사용자가 직접 실행
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
