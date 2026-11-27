-- ============================================================================
-- SajiAman MBG — Migration 004: Security Advisor Fixes & Registration Robustness
-- Description:
--   1. Fix CRITICAL Security Definer View on public.v_kitchen_impact_metrics
--      by setting security_invoker = true.
--   2. Fix "Function Search Path Mutable" warnings by adding SET search_path = public
--      to all helper and security definer functions.
--   3. Upgrade complete_user_registration RPC to accept p_user_id UUID, ensuring
--      public.profiles is created reliably even when email confirmation is pending.
-- ============================================================================

-- 1. FIX CRITICAL: SECURITY DEFINER VIEW ON v_kitchen_impact_metrics
-- Setting security_invoker = true ensures the view respects caller permissions & RLS
ALTER VIEW public.v_kitchen_impact_metrics SET (security_invoker = true);

-- 2. FIX FUNCTION SEARCH PATH MUTABLE (Helper Functions)
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_kitchen_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kitchen_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT timezone('utc', now());
$$;

-- 3. UPGRADE COMPLETE_USER_REGISTRATION RPC
-- Accepts p_user_id from auth.signUp() result, guaranteeing public.profiles
-- receives a valid auth.users(id) reference without foreign key constraint failure.
DROP FUNCTION IF EXISTS public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.complete_user_registration(
  p_role user_role,
  p_full_name TEXT,
  p_phone_wa TEXT,
  p_kitchen_code TEXT DEFAULT NULL,
  p_school_npsn TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(auth.uid(), p_user_id);
  v_kitchen_id UUID := NULL;
  v_school_id UUID := NULL;
  v_profile public.profiles;
BEGIN
  -- Validate user id exists
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ID Pengguna tidak valid atau sesi pendaftaran belum terinisialisasi';
  END IF;

  IF p_role = 'kitchen' THEN
    IF p_kitchen_code IS NULL OR length(trim(p_kitchen_code)) = 0 THEN
      RAISE EXCEPTION 'Kode SPPG wajib diisi untuk peran Dapur';
    END IF;

    SELECT id INTO v_kitchen_id 
    FROM public.kitchens 
    WHERE upper(code) = upper(trim(p_kitchen_code))
    LIMIT 1;

    IF v_kitchen_id IS NULL THEN
      RAISE EXCEPTION 'Kode SPPG "%" tidak terdaftar dalam sistem resmi', p_kitchen_code;
    END IF;
  ELSIF p_role = 'school' THEN
    IF p_school_npsn IS NULL OR length(trim(p_school_npsn)) = 0 THEN
      RAISE EXCEPTION 'NPSN Sekolah wajib diisi untuk peran Koordinator Sekolah';
    END IF;

    SELECT id INTO v_school_id 
    FROM public.schools 
    WHERE trim(npsn) = trim(p_school_npsn)
    LIMIT 1;

    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'NPSN "%" tidak terdaftar sebagai sekolah binaan SPPG', p_school_npsn;
    END IF;
  END IF;

  -- Upsert into public.profiles
  INSERT INTO public.profiles (
    id, role, full_name, phone_wa, kitchen_id, school_id, created_at
  )
  VALUES (
    v_uid, p_role, trim(p_full_name), trim(p_phone_wa), v_kitchen_id, v_school_id, timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone_wa = EXCLUDED.phone_wa,
    kitchen_id = EXCLUDED.kitchen_id,
    school_id = EXCLUDED.school_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_profile() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_kitchen_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_school_id() TO authenticated, anon;
