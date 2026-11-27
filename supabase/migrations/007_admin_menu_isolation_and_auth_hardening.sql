-- ============================================================================
-- SajiAman MBG — Migration 007: Admin BGN Role, Per-SPPG Menu Isolation & Auth Hardening
-- Description:
--   1. Fixes NULL token columns on seeded auth.users & creates official BGN Admin account.
--   2. Restricts kitchens & schools creation/editing strictly to role = 'admin' (BGN).
--   3. Adds per-SPPG custom menu isolation (menu_catalog.kitchen_id) + keeps BGN global defaults.
--   4. Adds pre-registration validation RPC (check_registration_institution) to prevent orphan auth users.
--   5. Adds Admin BGN dashboard snapshot & CRUD RPCs (kitchens, schools, profile recovery/assignment).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS (Per-SPPG Menu Catalog)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_catalog' AND column_name = 'kitchen_id'
  ) THEN
    ALTER TABLE public.menu_catalog
      ADD COLUMN kitchen_id UUID REFERENCES public.kitchens(id) ON DELETE CASCADE,
      ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN is_system_default BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'pic_name'
  ) THEN
    ALTER TABLE public.schools
      ADD COLUMN pic_name TEXT,
      ADD COLUMN phone_wa TEXT,
      ADD COLUMN default_portions INTEGER NOT NULL DEFAULT 100;
  END IF;
END $$;

UPDATE public.menu_catalog
SET is_system_default = TRUE
WHERE kitchen_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_catalog_kitchen_id ON public.menu_catalog (kitchen_id);

-- ----------------------------------------------------------------------------
-- 2. FIX SEEDED AUTH TOKENS & PROVISION ADMIN BGN ACCOUNT
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id UUID := 'c0000000-0000-0000-0000-000000000099'::uuid;
  v_admin_pw TEXT;
BEGIN
  SET LOCAL search_path = public, auth, extensions;

  -- Fix NULL token fields on any seeded auth.users rows that cause "Database error querying schema"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    UPDATE auth.users
    SET
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
    WHERE
      confirmation_token IS NULL
      OR recovery_token IS NULL
      OR email_change_token_new IS NULL
      OR email_change IS NULL
      OR email_change_token_current IS NULL
      OR reauthentication_token IS NULL;

    -- Ensure auth.identities exist for demo seeded users
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      u.id,
      u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email),
      'email',
      now(),
      now(),
      now()
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
    );

    -- Create / Update Official Admin BGN Account: admin@bgn.sajiaman.id / AdminBgn2026!
    v_admin_pw := crypt('AdminBgn2026!', gen_salt('bf'));

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@bgn.sajiaman.id',
      v_admin_pw,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Pengawas Pusat BGN","role":"admin"}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email = EXCLUDED.email,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      reauthentication_token = '',
      raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@bgn.sajiaman.id'),
      'email',
      now(),
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = v_admin_id AND provider = 'email'
    );

    INSERT INTO public.profiles (
      id,
      role,
      full_name,
      phone_wa,
      kitchen_id,
      school_id
    ) VALUES (
      v_admin_id,
      'admin',
      'Admin Pengawas Pusat BGN',
      '081100000001',
      NULL,
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      full_name = EXCLUDED.full_name,
      kitchen_id = NULL,
      school_id = NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES: ONLY ADMIN WRITES KITCHENS/SCHOOLS; SCOPED MENU CATALOG
-- ----------------------------------------------------------------------------

-- 3.1 Kitchens (Read: admin + own kitchen + assigned school; Write: admin only)
DROP POLICY IF EXISTS "kitchens_select_scoped" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_update_own" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_admin_all" ON public.kitchens;

CREATE POLICY "kitchens_select_scoped"
  ON public.kitchens FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    id = public.my_kitchen_id() OR
    id IN (SELECT assigned_kitchen_id FROM public.schools WHERE id = public.my_school_id())
  );

CREATE POLICY "kitchens_admin_all"
  ON public.kitchens FOR ALL
  TO authenticated
  USING (public.my_role() = 'admin')
  WITH CHECK (public.my_role() = 'admin');

-- 3.2 Schools (Read: admin + assigned kitchen + own school; Write: admin only)
DROP POLICY IF EXISTS "schools_select_scoped" ON public.schools;
DROP POLICY IF EXISTS "schools_insert_kitchen" ON public.schools;
DROP POLICY IF EXISTS "schools_update_kitchen" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_all" ON public.schools;

CREATE POLICY "schools_select_scoped"
  ON public.schools FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    id = public.my_school_id() OR
    assigned_kitchen_id = public.my_kitchen_id()
  );

CREATE POLICY "schools_admin_all"
  ON public.schools FOR ALL
  TO authenticated
  USING (public.my_role() = 'admin')
  WITH CHECK (public.my_role() = 'admin');

-- 3.3 Profiles (Admin can read/manage all; others own or same unit)
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
CREATE POLICY "profiles_select_scoped"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    id = (SELECT auth.uid()) OR
    (kitchen_id IS NOT NULL AND kitchen_id = public.my_kitchen_id()) OR
    (school_id IS NOT NULL AND school_id = public.my_school_id())
  );

-- 3.4 Menu Catalog (Global BGN defaults + Per-SPPG custom items)
DROP POLICY IF EXISTS "menu_read_all" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_select_all" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_kitchen_write" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_select_scoped" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_scoped_write" ON public.menu_catalog;

CREATE POLICY "menu_catalog_select_scoped"
  ON public.menu_catalog FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    kitchen_id IS NULL OR
    kitchen_id = public.my_kitchen_id() OR
    id IN (
      SELECT bmi.menu_item_id
      FROM public.batch_menu_items bmi
      JOIN public.production_batches pb ON pb.id = bmi.batch_id
      WHERE pb.school_id = public.my_school_id()
        AND bmi.menu_item_id IS NOT NULL
    )
  );

CREATE POLICY "menu_catalog_scoped_write"
  ON public.menu_catalog FOR ALL
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    (public.my_role() = 'kitchen' AND kitchen_id = public.my_kitchen_id())
  )
  WITH CHECK (
    public.my_role() = 'admin' OR
    (public.my_role() = 'kitchen' AND kitchen_id = public.my_kitchen_id())
  );

-- 3.5 Admin read visibility across batches, batch items, maggot, notifications
DROP POLICY IF EXISTS "batches_select_scoped" ON public.production_batches;
CREATE POLICY "batches_select_scoped"
  ON public.production_batches FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

DROP POLICY IF EXISTS "batch_items_select_scoped" ON public.batch_menu_items;
CREATE POLICY "batch_items_select_scoped"
  ON public.batch_menu_items FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.production_batches pb
      WHERE pb.id = batch_menu_items.batch_id
        AND (pb.kitchen_id = public.my_kitchen_id() OR pb.school_id = public.my_school_id())
    )
  );

DROP POLICY IF EXISTS "maggot_select_scoped" ON public.maggot_pickup_reports;
CREATE POLICY "maggot_select_scoped"
  ON public.maggot_pickup_reports FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

DROP POLICY IF EXISTS "notifications_select_scoped" ON public.notifications;
CREATE POLICY "notifications_select_scoped"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    (recipient_role = 'kitchen' AND kitchen_id = public.my_kitchen_id()) OR
    (recipient_role = 'school' AND school_id = public.my_school_id())
  );

-- ----------------------------------------------------------------------------
-- 4. REGISTRATION PRE-VALIDATION & HARDENED REGISTRATION
-- ----------------------------------------------------------------------------

-- 4.1 Pre-check SPPG Code or School NPSN BEFORE calling supabase.auth.signUp()
CREATE OR REPLACE FUNCTION public.check_registration_institution(
  p_role user_role,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := trim(COALESCE(p_code, ''));
  v_kitchen public.kitchens;
  v_school public.schools;
BEGIN
  IF p_role = 'admin' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Peran Admin BGN tidak dapat didaftarkan melalui registrasi umum.'
    );
  END IF;

  IF length(v_clean) = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Kode instansi wajib diisi.'
    );
  END IF;

  IF p_role = 'kitchen' THEN
    SELECT * INTO v_kitchen
    FROM public.kitchens
    WHERE upper(code) = upper(v_clean)
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'Kode SPPG "' || v_clean || '" belum terdaftar oleh Admin BGN.'
      );
    END IF;

    RETURN jsonb_build_object(
      'valid', true,
      'institution_id', v_kitchen.id,
      'institution_name', v_kitchen.name
    );
  END IF;

  -- p_role = 'school'
  IF v_clean !~ '^\d{8}$' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'NPSN sekolah resmi wajib berupa 8 digit angka.'
    );
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE trim(npsn) = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'NPSN "' || v_clean || '" belum terdaftar sebagai sekolah binaan di sistem.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'institution_id', v_school.id,
    'institution_name', v_school.name
  );
END;
$$;

-- 4.2 Block self-promotion to 'admin' in public complete_user_registration
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ID Pengguna tidak valid atau sesi pendaftaran belum terinisialisasi.';
  END IF;

  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Peran Admin BGN hanya dapat ditetapkan oleh Administrator Pusat.';
  END IF;

  IF p_role = 'kitchen' THEN
    IF p_kitchen_code IS NULL OR length(trim(p_kitchen_code)) = 0 THEN
      RAISE EXCEPTION 'Kode SPPG wajib diisi untuk peran Dapur.';
    END IF;

    SELECT id INTO v_kitchen_id
    FROM public.kitchens
    WHERE upper(code) = upper(trim(p_kitchen_code))
    LIMIT 1;

    IF v_kitchen_id IS NULL THEN
      RAISE EXCEPTION 'Kode SPPG "%" belum terdaftar dalam sistem resmi.', p_kitchen_code;
    END IF;
  ELSIF p_role = 'school' THEN
    IF p_school_npsn IS NULL OR length(trim(p_school_npsn)) = 0 THEN
      RAISE EXCEPTION 'NPSN Sekolah wajib diisi untuk peran Koordinator Sekolah.';
    END IF;

    SELECT id INTO v_school_id
    FROM public.schools
    WHERE trim(npsn) = trim(p_school_npsn)
    LIMIT 1;

    IF v_school_id IS NULL THEN
      RAISE EXCEPTION 'NPSN "%" belum terdaftar sebagai sekolah binaan SPPG.', p_school_npsn;
    END IF;
  END IF;

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

-- ----------------------------------------------------------------------------
-- 5. UPGRADE OPERATIONAL RPCs: PER-SPPG MENU + STRICT ADMIN SCHOOL CONTROL
-- ----------------------------------------------------------------------------

-- 5.1 Seal Production Batch: validate menu belongs to global defaults OR caller's SPPG
CREATE OR REPLACE FUNCTION public.seal_production_batch(
  p_school_id UUID,
  p_menu_item_ids TEXT[],
  p_ompreng_count INTEGER,
  p_input_mode input_mode_type,
  p_sample_photo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_kitchen public.kitchens;
  v_school public.schools;
  v_min_minutes INTEGER;
  v_trigger_item_name TEXT;
  v_cooked_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_batch_code TEXT;
  v_qr_token TEXT;
  v_box_num INTEGER;
  v_box_label TEXT;
  v_new_batch_id UUID;
  v_item RECORD;
  v_attempts INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda wajib masuk akun resmi terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya petugas Dapur SPPG terverifikasi yang dapat menyegel produksi.';
  END IF;

  SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit Dapur SPPG tidak ditemukan.';
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE id = p_school_id AND assigned_kitchen_id = v_caller.kitchen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah tujuan tidak terdaftar atau berada di bawah SPPG lain.';
  END IF;

  IF p_menu_item_ids IS NULL OR array_length(p_menu_item_ids, 1) IS NULL OR array_length(p_menu_item_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Batch produksi wajib menyertakan minimal 1 komponen menu.';
  END IF;

  IF p_ompreng_count IS NULL OR p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0.';
  END IF;

  -- Weakest-Link Rule Evaluation strictly from global defaults or this SPPG's custom menu
  SELECT holding_time_minutes, name
  INTO v_min_minutes, v_trigger_item_name
  FROM public.menu_catalog
  WHERE id = ANY(p_menu_item_ids)
    AND is_active = TRUE
    AND (kitchen_id IS NULL OR kitchen_id = v_caller.kitchen_id)
  ORDER BY holding_time_minutes ASC, is_high_risk_wet DESC
  LIMIT 1;

  IF v_min_minutes IS NULL THEN
    RAISE EXCEPTION 'Komponen menu tidak valid atau sudah dinonaktifkan dalam katalog.';
  END IF;

  v_cooked_at := timezone('utc', now());
  v_expires_at := v_cooked_at + make_interval(mins => v_min_minutes);

  SELECT COALESCE(MAX(box_number), 0) + 1
  INTO v_box_num
  FROM public.production_batches
  WHERE kitchen_id = v_caller.kitchen_id
    AND (cooked_at AT TIME ZONE 'Asia/Jakarta')::date = (v_cooked_at AT TIME ZONE 'Asia/Jakarta')::date;

  v_box_label := 'Boks #' || lpad(v_box_num::text, 2, '0');

  LOOP
    v_attempts := v_attempts + 1;
    v_batch_code := 'MBG-' ||
                    to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') || '-' ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    v_qr_token := upper(substr(encode(pg_catalog.sha256(convert_to(
      v_batch_code || '#' || v_kitchen.code || '#' || extract(epoch from v_cooked_at)::bigint::text || '#' || gen_random_uuid()::text,
      'UTF8'
    )), 'hex'), 1, 16));

    BEGIN
      INSERT INTO public.production_batches (
        batch_code, kitchen_id, school_id, input_mode, sample_photo_path, ai_nutrition_verified,
        weakest_link_item_name, holding_time_minutes, cooked_at, expires_at, ompreng_sent_count,
        ompreng_status, batch_status, created_by, created_at, qr_token, box_number, box_label
      )
      VALUES (
        v_batch_code, v_caller.kitchen_id, p_school_id, p_input_mode, p_sample_photo_path, (p_input_mode = 'ai_photo'),
        v_trigger_item_name, v_min_minutes, v_cooked_at, v_expires_at, p_ompreng_count,
        'in_transit', 'active', v_caller.id, v_cooked_at, v_qr_token, v_box_num, v_box_label
      )
      RETURNING id INTO v_new_batch_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'Gagal menghasilkan kode batch unik setelah 5 percobaan.';
      END IF;
    END;
  END LOOP;

  FOR v_item IN
    SELECT id, name, category, holding_time_minutes
    FROM public.menu_catalog
    WHERE id = ANY(p_menu_item_ids)
      AND (kitchen_id IS NULL OR kitchen_id = v_caller.kitchen_id)
  LOOP
    INSERT INTO public.batch_menu_items (
      batch_id, menu_item_id, menu_item_name, category, holding_time_minutes
    )
    VALUES (
      v_new_batch_id, v_item.id, v_item.name, v_item.category, v_item.holding_time_minutes
    );
  END LOOP;

  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'school', v_caller.kitchen_id, p_school_id, v_new_batch_id,
    'Boks Baru Dikirim SPPG',
    'Boks ' || v_batch_code || ' dari ' || v_kitchen.name || ' (' || v_trigger_item_name || ') dalam perjalanan. Batas aman pukul ' || to_char(v_expires_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB.',
    'new_batch'
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_new_batch_id,
    'batch_code', v_batch_code,
    'qr_token', v_qr_token,
    'kitchen_id', v_caller.kitchen_id,
    'kitchen_code', v_kitchen.code,
    'box_number', v_box_num,
    'box_label', v_box_label,
    'cooked_at', v_cooked_at,
    'expires_at', v_expires_at,
    'weakest_link_item', v_trigger_item_name,
    'holding_time_minutes', v_min_minutes
  );
END;
$$;

-- 5.2 Upsert Menu Item: Per-SPPG isolated custom menus vs Admin global standards
DROP FUNCTION IF EXISTS public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.upsert_menu_item(
  p_id TEXT,
  p_name TEXT,
  p_category TEXT,
  p_risk_tier TEXT,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_existing public.menu_catalog;
  v_holding_minutes INTEGER := 270;
  v_is_high_risk BOOLEAN := FALSE;
  v_final_id TEXT;
  v_slug TEXT;
  v_item public.menu_catalog;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role NOT IN ('kitchen', 'admin') THEN
    RAISE EXCEPTION 'Hanya petugas Dapur SPPG atau Admin BGN yang dapat mengelola menu.';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Nama menu masakan wajib diisi.';
  END IF;

  IF p_category NOT IN ('karbohidrat', 'protein', 'sayur', 'buah') THEN
    RAISE EXCEPTION 'Kategori gizi harus salah satu dari: karbohidrat, protein, sayur, buah.';
  END IF;

  IF p_risk_tier = 'santan_kuah_tinggi' THEN
    v_holding_minutes := 210;
    v_is_high_risk := TRUE;
  ELSIF p_risk_tier = 'tumis_kuah' THEN
    v_holding_minutes := 240;
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'kering_goreng' THEN
    v_holding_minutes := 270;
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'lauk_kering' THEN
    v_holding_minutes := 300;
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'buah_utuh' THEN
    v_holding_minutes := 360;
    v_is_high_risk := FALSE;
  END IF;

  -- Clean URL/ID-safe slug from name if p_id blank
  v_slug := trim(BOTH '-' FROM regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  IF length(v_slug) = 0 THEN
    v_slug := 'menu';
  END IF;

  IF v_caller.role = 'admin' THEN
    v_final_id := COALESCE(NULLIF(trim(p_id), ''), v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    INSERT INTO public.menu_catalog (
      id, name, category, holding_time_minutes, is_high_risk_wet, is_active, kitchen_id, created_by, is_system_default
    )
    VALUES (
      v_final_id, trim(p_name), p_category, v_holding_minutes, v_is_high_risk, COALESCE(p_is_active, TRUE), NULL, v_caller.id, TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      holding_time_minutes = EXCLUDED.holding_time_minutes,
      is_high_risk_wet = EXCLUDED.is_high_risk_wet,
      is_active = EXCLUDED.is_active
    RETURNING * INTO v_item;
  ELSE
    -- Kitchen chef: strict per-SPPG isolation
    IF v_caller.kitchen_id IS NULL THEN
      RAISE EXCEPTION 'Akun dapur tidak terhubung ke unit SPPG manapun.';
    END IF;

    IF p_id IS NOT NULL AND length(trim(p_id)) > 0 THEN
      SELECT * INTO v_existing FROM public.menu_catalog WHERE id = trim(p_id) LIMIT 1;
      IF FOUND THEN
        IF v_existing.kitchen_id IS NULL THEN
          RAISE EXCEPTION 'Menu standar BGN tidak dapat diubah oleh unit dapur. Tambahkan sebagai Menu Kustom SPPG.';
        END IF;
        IF v_existing.kitchen_id != v_caller.kitchen_id THEN
          RAISE EXCEPTION 'Akses ditolak: Menu ini milik unit SPPG lain.';
        END IF;
        v_final_id := v_existing.id;
      ELSE
        -- New item: enforce unique scoped ID so kitchens never overwrite global defaults or other SPPGs
        v_final_id := v_slug || '-' || substr(replace(v_caller.kitchen_id::text, '-', ''), 1, 6) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
      END IF;
    ELSE
      v_final_id := v_slug || '-' || substr(replace(v_caller.kitchen_id::text, '-', ''), 1, 6) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    END IF;

    INSERT INTO public.menu_catalog (
      id, name, category, holding_time_minutes, is_high_risk_wet, is_active, kitchen_id, created_by, is_system_default
    )
    VALUES (
      v_final_id, trim(p_name), p_category, v_holding_minutes, v_is_high_risk, COALESCE(p_is_active, TRUE), v_caller.kitchen_id, v_caller.id, FALSE
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      holding_time_minutes = EXCLUDED.holding_time_minutes,
      is_high_risk_wet = EXCLUDED.is_high_risk_wet,
      is_active = EXCLUDED.is_active
    WHERE public.menu_catalog.kitchen_id = v_caller.kitchen_id
    RETURNING * INTO v_item;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'item', row_to_json(v_item)
  );
END;
$$;

-- 5.3 Restrict manage_school strictly to Admin role
DROP FUNCTION IF EXISTS public.manage_school(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.manage_school(
  p_school_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_npsn TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_pic_name TEXT DEFAULT NULL,
  p_phone_wa TEXT DEFAULT NULL,
  p_default_portions INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Akses ditolak: Penambahan dan perubahan Sekolah Binaan hanya boleh dilakukan oleh Admin BGN Pusat.';
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ADMIN BGN COMMAND CENTER & CRUD RPCs (Strict role = 'admin')
-- ----------------------------------------------------------------------------

-- 6.1 Admin Snapshot Overview
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Khusus Administrator BGN.';
  END IF;

  RETURN jsonb_build_object(
    'kitchens', COALESCE((
      SELECT jsonb_agg(row_to_json(kt))
      FROM (
        SELECT
          k.id,
          k.code,
          k.name,
          k.address,
          k.total_ompreng_inventory,
          k.created_at,
          (SELECT count(*)::int FROM public.schools s WHERE s.assigned_kitchen_id = k.id) AS school_count,
          (SELECT count(*)::int FROM public.profiles p WHERE p.kitchen_id = k.id) AS staff_count,
          (SELECT count(*)::int FROM public.production_batches pb WHERE pb.kitchen_id = k.id AND pb.batch_status = 'active') AS active_batch_count
        FROM public.kitchens k
        ORDER BY k.created_at DESC
      ) kt
    ), '[]'::jsonb),
    'schools', COALESCE((
      SELECT jsonb_agg(row_to_json(sc))
      FROM (
        SELECT
          s.id,
          s.npsn,
          s.name,
          s.address,
          s.pic_name,
          s.phone_wa,
          s.default_portions,
          s.assigned_kitchen_id,
          k.code AS assigned_kitchen_code,
          k.name AS assigned_kitchen_name,
          s.created_at
        FROM public.schools s
        LEFT JOIN public.kitchens k ON k.id = s.assigned_kitchen_id
        ORDER BY s.name ASC
      ) sc
    ), '[]'::jsonb),
    'users', COALESCE((
      SELECT jsonb_agg(row_to_json(us))
      FROM (
        SELECT
          u.id,
          u.email,
          (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
          p.role,
          p.full_name,
          p.phone_wa,
          p.kitchen_id,
          k.code AS kitchen_code,
          k.name AS kitchen_name,
          p.school_id,
          s.name AS school_name,
          (p.id IS NULL) AS is_orphan,
          u.created_at
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        LEFT JOIN public.kitchens k ON k.id = p.kitchen_id
        LEFT JOIN public.schools s ON s.id = p.school_id
        ORDER BY u.created_at DESC
      ) us
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'total_kitchens', (SELECT count(*)::int FROM public.kitchens),
      'total_schools', (SELECT count(*)::int FROM public.schools),
      'total_users', (SELECT count(*)::int FROM auth.users),
      'orphan_users', (SELECT count(*)::int FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL),
      'total_batches', (SELECT count(*)::int FROM public.production_batches),
      'active_batches', (SELECT count(*)::int FROM public.production_batches WHERE batch_status = 'active'),
      'rejected_batches', (SELECT count(*)::int FROM public.production_batches WHERE batch_status = 'rejected_spoiled'),
      'voided_batches', (SELECT count(*)::int FROM public.production_batches WHERE batch_status = 'voided'),
      'total_maggot_kg', COALESCE((SELECT sum(estimated_kg)::numeric(10,1) FROM public.maggot_pickup_reports), 0)
    )
  );
END;
$$;

-- 6.2 Admin Create / Update Kitchen (SPPG)
CREATE OR REPLACE FUNCTION public.admin_manage_kitchen(
  p_kitchen_id UUID DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_inventory INTEGER DEFAULT 600
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_clean_code TEXT := upper(trim(COALESCE(p_code, '')));
  v_kitchen public.kitchens;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat membuat atau mengubah data SPPG.';
  END IF;

  IF p_kitchen_id IS NOT NULL THEN
    UPDATE public.kitchens
    SET
      code = COALESCE(NULLIF(v_clean_code, ''), code),
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      address = COALESCE(NULLIF(trim(p_address), ''), address),
      total_ompreng_inventory = COALESCE(p_inventory, total_ompreng_inventory)
    WHERE id = p_kitchen_id
    RETURNING * INTO v_kitchen;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unit SPPG tidak ditemukan.';
    END IF;
  ELSE
    IF length(v_clean_code) < 4 OR p_name IS NULL OR length(trim(p_name)) = 0 THEN
      RAISE EXCEPTION 'Kode SPPG dan Nama SPPG wajib diisi.';
    END IF;

    INSERT INTO public.kitchens (
      code, name, address, total_ompreng_inventory
    ) VALUES (
      v_clean_code,
      trim(p_name),
      NULLIF(trim(p_address), ''),
      GREATEST(0, COALESCE(p_inventory, 600))
    )
    RETURNING * INTO v_kitchen;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'kitchen', row_to_json(v_kitchen)
  );
END;
$$;

-- 6.3 Admin Create / Update / Reassign School
CREATE OR REPLACE FUNCTION public.admin_manage_school(
  p_school_id UUID DEFAULT NULL,
  p_kitchen_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_npsn TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_pic_name TEXT DEFAULT NULL,
  p_phone_wa TEXT DEFAULT NULL,
  p_default_portions INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_school public.schools;
  v_clean_npsn TEXT := NULLIF(trim(COALESCE(p_npsn, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat menambah atau mengubah Sekolah Binaan.';
  END IF;

  IF v_clean_npsn IS NOT NULL AND v_clean_npsn !~ '^\d{8}$' THEN
    RAISE EXCEPTION 'NPSN resmi sekolah wajib berupa 8 digit angka.';
  END IF;

  IF p_kitchen_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kitchens WHERE id = p_kitchen_id) THEN
    RAISE EXCEPTION 'Unit SPPG pembina tidak ditemukan.';
  END IF;

  IF p_school_id IS NOT NULL THEN
    UPDATE public.schools
    SET
      assigned_kitchen_id = COALESCE(p_kitchen_id, assigned_kitchen_id),
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      npsn = COALESCE(v_clean_npsn, npsn),
      address = COALESCE(NULLIF(trim(p_address), ''), address),
      pic_name = COALESCE(NULLIF(trim(p_pic_name), ''), pic_name),
      phone_wa = COALESCE(NULLIF(trim(p_phone_wa), ''), phone_wa),
      default_portions = COALESCE(p_default_portions, default_portions)
    WHERE id = p_school_id
    RETURNING * INTO v_school;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sekolah tidak ditemukan.';
    END IF;
  ELSE
    IF p_name IS NULL OR length(trim(p_name)) = 0 OR p_kitchen_id IS NULL THEN
      RAISE EXCEPTION 'Nama sekolah dan SPPG pembina wajib diisi.';
    END IF;

    INSERT INTO public.schools (
      assigned_kitchen_id, name, npsn, address, pic_name, phone_wa, default_portions
    ) VALUES (
      p_kitchen_id,
      trim(p_name),
      v_clean_npsn,
      COALESCE(NULLIF(trim(p_address), ''), 'Indonesia'),
      COALESCE(NULLIF(trim(p_pic_name), ''), 'Koordinator ' || trim(p_name)),
      NULLIF(trim(p_phone_wa), ''),
      GREATEST(1, COALESCE(p_default_portions, 100))
    )
    RETURNING * INTO v_school;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'school', row_to_json(v_school)
  );
END;
$$;

-- 6.4 Admin Assign / Recover User Profile (Fixes orphan users or wrong unit links)
CREATE OR REPLACE FUNCTION public.admin_reassign_user_profile(
  p_user_id UUID,
  p_role user_role,
  p_full_name TEXT,
  p_phone_wa TEXT DEFAULT NULL,
  p_kitchen_id UUID DEFAULT NULL,
  p_school_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat mengubah penugasan pengguna.';
  END IF;

  IF p_role = 'kitchen' AND p_kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Peran Dapur SPPG wajib terhubung ke unit SPPG.';
  END IF;
  IF p_role = 'school' AND p_school_id IS NULL THEN
    RAISE EXCEPTION 'Peran Sekolah wajib terhubung ke unit Sekolah.';
  END IF;

  INSERT INTO public.profiles (
    id, role, full_name, phone_wa, kitchen_id, school_id
  ) VALUES (
    p_user_id,
    p_role,
    COALESCE(NULLIF(trim(p_full_name), ''), 'Petugas Resmi'),
    NULLIF(trim(p_phone_wa), ''),
    CASE WHEN p_role = 'kitchen' THEN p_kitchen_id ELSE NULL END,
    CASE WHEN p_role = 'school' THEN p_school_id ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone_wa = COALESCE(EXCLUDED.phone_wa, public.profiles.phone_wa),
    kitchen_id = EXCLUDED.kitchen_id,
    school_id = EXCLUDED.school_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. GRANTS & PERMISSIONS
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.check_registration_institution(user_role, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_manage_kitchen(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_manage_school(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reassign_user_profile(UUID, user_role, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_kitchen(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_school(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reassign_user_profile(UUID, user_role, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_school(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- Segarkan cache skema PostgREST agar RPC baru langsung terbaca tanpa error "not found"
NOTIFY pgrst, 'reload schema';
