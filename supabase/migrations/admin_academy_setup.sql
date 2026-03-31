-- ══════════════════════════════════════════════════════════════════════════════
-- 슈퍼어드민 계정 학원 설정
-- 대상: howtoconsulting5776@gmail.com → 하우투영어수학전문학원
-- 실행: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- 멱등성 보장: 여러 번 실행해도 안전합니다.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id    UUID;
  v_academy_id UUID;
  v_existing   UUID;
BEGIN

  -- ── 1. 슈퍼어드민 유저 조회 ────────────────────────────────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'howtoconsulting5776@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '[ERROR] howtoconsulting5776@gmail.com 계정을 찾을 수 없습니다.';
    RAISE NOTICE '        먼저 해당 이메일로 회원가입을 완료한 뒤 이 SQL을 다시 실행하세요.';
    RETURN;
  END IF;

  RAISE NOTICE '[OK] 유저 확인: %', v_user_id;

  -- ── 2. 기존 academy_id 확인 (profiles 테이블) ─────────────────────────────
  SELECT academy_id INTO v_existing
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing IS NOT NULL THEN
    -- 이미 학원이 연결되어 있으면 이름만 업데이트
    UPDATE public.academies
    SET name       = '하우투영어수학전문학원',
        owner_id   = v_user_id,
        updated_at = NOW()
    WHERE id = v_existing;
    v_academy_id := v_existing;
    RAISE NOTICE '[OK] 기존 학원 이름 업데이트 완료 (id: %)', v_academy_id;
  ELSE
    -- ── 3. 동일 이름 학원이 이미 있는지 확인 ────────────────────────────────
    SELECT id INTO v_academy_id
    FROM public.academies
    WHERE name = '하우투영어수학전문학원'
    LIMIT 1;

    IF v_academy_id IS NOT NULL THEN
      -- 이름이 같은 학원이 있으면 owner_id만 연결
      UPDATE public.academies
      SET owner_id   = v_user_id,
          updated_at = NOW()
      WHERE id = v_academy_id;
      RAISE NOTICE '[OK] 기존 "하우투영어수학전문학원" 학원에 오너 연결 (id: %)', v_academy_id;
    ELSE
      -- ── 4. 새 학원 생성 ────────────────────────────────────────────────────
      INSERT INTO public.academies (name, owner_id, code)
      VALUES (
        '하우투영어수학전문학원',
        v_user_id,
        upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
      )
      RETURNING id INTO v_academy_id;
      RAISE NOTICE '[OK] 새 학원 생성 완료 (id: %)', v_academy_id;
    END IF;
  END IF;

  -- ── 5. profiles 업데이트 ────────────────────────────────────────────────────
  -- role = 'admin', academy_id = 생성된 학원, plan = 'enterprise'
  UPDATE public.profiles
  SET academy_id  = v_academy_id,
      role        = 'admin',
      plan        = 'enterprise',
      updated_at  = NOW()
  WHERE id = v_user_id;

  -- profiles 행이 없으면 INSERT
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, role, academy_id, plan, signup_method, plan_started_at)
    VALUES (
      v_user_id,
      'howtoconsulting5776@gmail.com',
      'admin',
      v_academy_id,
      'enterprise',
      'email',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
      SET role       = 'admin',
          academy_id = v_academy_id,
          plan       = 'enterprise',
          updated_at = NOW();
  END IF;

  RAISE NOTICE '[OK] profiles 업데이트 완료 — role: admin, plan: enterprise';

  -- ── 6. auth.users 메타데이터 동기화 ────────────────────────────────────────
  -- user_metadata에 academy_id와 역할 정보를 반영해두면 JWT 클레임에서 바로 읽을 수 있음
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
        'role',        'admin',
        'academy_id',  v_academy_id::text,
        'academy_name','하우투영어수학전문학원'
       )
  WHERE id = v_user_id;

  RAISE NOTICE '[OK] auth.users 메타데이터 동기화 완료';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '슈퍼어드민 설정 완료!';
  RAISE NOTICE '  이메일   : howtoconsulting5776@gmail.com';
  RAISE NOTICE '  학원명   : 하우투영어수학전문학원';
  RAISE NOTICE '  역할     : admin (슈퍼어드민)';
  RAISE NOTICE '  요금제   : enterprise (무제한)';
  RAISE NOTICE '  학원 ID  : %', v_academy_id;
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '적용 후 로그아웃 → 다시 로그인하면 설정이 반영됩니다.';

END $$;
