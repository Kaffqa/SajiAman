-- ============================================================================
-- SajiAman MBG — Migration 009: Admin Unit & Account Activation Control
-- Description:
--   1. Adds is_active column to kitchens, schools, and profiles (default TRUE).
--   2. Enforces is_active checks in check_registration_institution,
--      complete_user_registration, and seal_production_batch.
--   3. Extends admin_get_dashboard_snapshot to expose is_active flags.
--   4. Adds Admin BGN RPCs to deactivate/reactivate SPPG, Schools, and Staff Accounts.
-- ============================================================================

-- 1. SCHEMA EXTENSIONS (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kitchens' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.kitchens
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.schools
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- 2. REGISTRATION PRE-CHECK RESPECTING ACTIVE STATUS
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

    IF NOT v_kitchen.is_active THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'Unit SPPG "' || v_kitchen.name || '" sedang dinonaktifkan oleh Admin BGN.'
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

  IF NOT v_school.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Sekolah "' || v_school.name || '" sedang dinonaktifkan oleh Admin BGN.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'institution_id', v_school.id,
    'institution_name', v_school.name
  );
END;
$$;

-- 3. COMPLETE USER REGISTRATION RESPECTING ACTIVE STATUS
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
  v_kitchen public.kitchens;
  v_school public.schools;
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

    SELECT * INTO v_kitchen
    FROM public.kitchens
    WHERE upper(code) = upper(trim(p_kitchen_code))
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kode SPPG "%" belum terdaftar dalam sistem resmi.', p_kitchen_code;
    END IF;
    IF NOT v_kitchen.is_active THEN
      RAISE EXCEPTION 'Unit SPPG "%" sedang dinonaktifkan oleh Admin BGN.', v_kitchen.name;
    END IF;
    v_kitchen_id := v_kitchen.id;
  ELSIF p_role = 'school' THEN
    IF p_school_npsn IS NULL OR length(trim(p_school_npsn)) = 0 THEN
      RAISE EXCEPTION 'NPSN Sekolah wajib diisi untuk peran Koordinator Sekolah.';
    END IF;

    SELECT * INTO v_school
    FROM public.schools
    WHERE trim(npsn) = trim(p_school_npsn)
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'NPSN "%" belum terdaftar sebagai sekolah binaan SPPG.', p_school_npsn;
    END IF;
    IF NOT v_school.is_active THEN
      RAISE EXCEPTION 'Sekolah "%" sedang dinonaktifkan oleh Admin BGN.', v_school.name;
    END IF;
    v_school_id := v_school.id;
  END IF;

  INSERT INTO public.profiles (
    id, role, full_name, phone_wa, kitchen_id, school_id, is_active, created_at
  )
  VALUES (
    v_uid, p_role, trim(p_full_name), trim(p_phone_wa), v_kitchen_id, v_school_id, TRUE, timezone('utc', now())
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

-- 4. SEAL BATCH CHECKS ACTIVE STATUS OF CALLER, KITCHEN, AND SCHOOL
-- Keep 008 notification wording (masked pre-arrival) while adding is_active validation
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

  IF NOT v_caller.is_active THEN
    RAISE EXCEPTION 'Akun petugas Anda sedang dinonaktifkan oleh Admin BGN.';
  END IF;

  SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit Dapur SPPG tidak ditemukan.';
  END IF;
  IF NOT v_kitchen.is_active THEN
    RAISE EXCEPTION 'Unit Dapur SPPG ini sedang dinonaktifkan oleh Admin BGN.';
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE id = p_school_id AND assigned_kitchen_id = v_caller.kitchen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah tujuan tidak terdaftar atau berada di bawah SPPG lain.';
  END IF;
  IF NOT v_school.is_active THEN
    RAISE EXCEPTION 'Sekolah tujuan "%" sedang dinonaktifkan oleh Admin BGN.', v_school.name;
  END IF;

  IF p_menu_item_ids IS NULL OR array_length(p_menu_item_ids, 1) IS NULL OR array_length(p_menu_item_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Batch produksi wajib menyertakan minimal 1 komponen menu.';
  END IF;

  IF p_ompreng_count IS NULL OR p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0.';
  END IF;

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
    v_batch_code := 'MBG-' || to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.production_batches WHERE batch_code = v_batch_code);
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Gagal membuat kode batch unik. Silakan coba lagi.';
    END IF;
  END LOOP;

  v_qr_token := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.production_batches (
    batch_code, qr_token, kitchen_id, school_id, created_by, box_number, box_label,
    ompreng_sent_count, ompreng_status, batch_status, weakest_link_item_name,
    holding_time_minutes, cooked_at, expires_at, input_mode, sample_photo_path, ai_nutrition_verified
  ) VALUES (
    v_batch_code, v_qr_token, v_caller.kitchen_id, p_school_id, v_caller.id, v_box_num, v_box_label,
    p_ompreng_count, 'in_transit', 'active', v_trigger_item_name,
    v_min_minutes, v_cooked_at, v_expires_at, p_input_mode, p_sample_photo_path, (p_input_mode = 'ai_photo')
  )
  RETURNING id INTO v_new_batch_id;

  FOR v_item IN
    SELECT id, name, category, holding_time_minutes
    FROM public.menu_catalog
    WHERE id = ANY(p_menu_item_ids)
      AND is_active = TRUE
      AND (kitchen_id IS NULL OR kitchen_id = v_caller.kitchen_id)
  LOOP
    INSERT INTO public.batch_menu_items (
      batch_id, menu_item_id, menu_item_name, category, holding_time_minutes
    ) VALUES (
      v_new_batch_id, v_item.id, v_item.name, v_item.category, v_item.holding_time_minutes
    );
  END LOOP;

  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'school', v_caller.kitchen_id, p_school_id, v_new_batch_id,
    'Kiriman Boks Baru Dalam Perjalanan',
    v_box_label || ' dari ' || v_kitchen.name || ' (' || p_ompreng_count || ' ompreng) sedang dikirim. Pindai QR fisik saat tiba untuk membuka batas aman.',
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

-- 5. EXTENDED ADMIN SNAPSHOT INCLUDING is_active FLAGS
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
          k.is_active,
          k.created_at,
          (SELECT count(*)::int FROM public.schools s WHERE s.assigned_kitchen_id = k.id) AS school_count,
          (SELECT count(*)::int FROM public.profiles p WHERE p.kitchen_id = k.id) AS staff_count,
          (SELECT count(*)::int FROM public.production_batches pb WHERE pb.kitchen_id = k.id AND pb.batch_status = 'active') AS active_batch_count
        FROM public.kitchens k
        ORDER BY k.is_active DESC, k.created_at DESC
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
          s.is_active,
          k.code AS assigned_kitchen_code,
          k.name AS assigned_kitchen_name,
          s.created_at
        FROM public.schools s
        LEFT JOIN public.kitchens k ON k.id = s.assigned_kitchen_id
        ORDER BY s.is_active DESC, s.name ASC
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
          COALESCE(p.is_active, TRUE) AS is_active,
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

-- 6. ADMIN STATUS TOGGLE RPCs (Audit-safe soft deactivation without breaking FK logs)
CREATE OR REPLACE FUNCTION public.admin_toggle_kitchen_active(
  p_kitchen_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_kitchen public.kitchens;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat mengubah status aktif unit SPPG.';
  END IF;

  UPDATE public.kitchens
  SET is_active = COALESCE(p_is_active, TRUE)
  WHERE id = p_kitchen_id
  RETURNING * INTO v_kitchen;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit SPPG tidak ditemukan.';
  END IF;

  RETURN jsonb_build_object('success', true, 'kitchen', row_to_json(v_kitchen));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_school_active(
  p_school_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_school public.schools;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat mengubah status aktif sekolah.';
  END IF;

  UPDATE public.schools
  SET is_active = COALESCE(p_is_active, TRUE)
  WHERE id = p_school_id
  RETURNING * INTO v_school;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah binaan tidak ditemukan.';
  END IF;

  RETURN jsonb_build_object('success', true, 'school', row_to_json(v_school));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_target public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin BGN yang dapat mengubah status aktif akun petugas.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Admin tidak dapat menonaktifkan akunnya sendiri.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil akun belum terhubung. Gunakan "Atur Unit" terlebih dahulu.';
  END IF;

  IF v_target.role = 'admin' THEN
    RAISE EXCEPTION 'Akun Administrator BGN tidak dapat dinonaktifkan melalui panel ini.';
  END IF;

  UPDATE public.profiles
  SET is_active = COALESCE(p_is_active, TRUE)
  WHERE id = p_user_id
  RETURNING * INTO v_target;

  RETURN jsonb_build_object('success', true, 'profile', row_to_json(v_target));
END;
$$;

-- 7. GRANTS & SCHEMA RELOAD
REVOKE EXECUTE ON FUNCTION public.admin_toggle_kitchen_active(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_school_active(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_toggle_kitchen_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_school_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
