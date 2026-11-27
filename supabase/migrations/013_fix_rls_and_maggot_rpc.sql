-- ============================================================================
-- MIGRATION 013: RLS POLICY HYGIENE, PRIVILEGE TRIGGER, HARDENED REGISTRATION,
--                UHT PACKAGING EXEMPTION, & HARDENED MAGGOT RPCS
-- ============================================================================

-- 1. DROP LEGACY PERMISSIVE RLS POLICIES & UNIFY SCOPING

-- 1.1 menu_catalog: 006 created menu_catalog_select_authenticated USING (TRUE)
-- which remained OR-combined with 007's menu_catalog_select_scoped.
DROP POLICY IF EXISTS "menu_catalog_select_authenticated" ON public.menu_catalog;

-- 1.2 maggot_pickup_reports: 006 created maggot_reports_select_scoped while 007
-- dropped the wrong name ("maggot_select_scoped"), leaving duplicate/broad rules.
DROP POLICY IF EXISTS "maggot_reports_select_policy" ON public.maggot_pickup_reports;
DROP POLICY IF EXISTS "maggot_reports_read_all" ON public.maggot_pickup_reports;
DROP POLICY IF EXISTS "maggot_reports_select_scoped" ON public.maggot_pickup_reports;
DROP POLICY IF EXISTS "maggot_select_scoped" ON public.maggot_pickup_reports;

CREATE POLICY "maggot_reports_select_scoped"
  ON public.maggot_pickup_reports FOR SELECT
  TO authenticated
  USING (
    public.my_role() = 'admin' OR
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

-- 1.3 storage.objects: grant Admin BGN read visibility alongside Kitchen & School
DROP POLICY IF EXISTS "kitchen_and_school_read_sample_photos" ON storage.objects;

CREATE POLICY "kitchen_and_school_read_sample_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sample-photos' AND (
      public.my_role() = 'admin' OR
      (storage.foldername(name))[1] = public.my_kitchen_id()::text OR
      (storage.foldername(name))[1] IN (
        SELECT assigned_kitchen_id::text FROM public.schools WHERE id = public.my_school_id()
      ) OR
      (
        (storage.foldername(name))[1] = 'rejections' AND (
          (storage.foldername(name))[2] = public.my_school_id()::text OR
          (storage.foldername(name))[2] IN (
            SELECT id::text FROM public.schools WHERE assigned_kitchen_id = public.my_kitchen_id()
          )
        )
      )
    )
  );

-- 2. PREVENT SELF-PRIVILEGE ESCALATION VIA DIRECT UPDATE ON public.profiles
-- Blocks non-admin PostgREST updates to role, kitchen_id, school_id, is_active
-- while still allowing SECURITY DEFINER RPCs (current_user = 'postgres'),
-- service_role, and verified Admin BGN accounts.
CREATE OR REPLACE FUNCTION public.protect_profiles_privilege_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND COALESCE(public.my_role()::text, '') != 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.kitchen_id IS DISTINCT FROM OLD.kitchen_id
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak berwenang mengubah role, penugasan unit, atau status aktif profil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_privilege_fields ON public.profiles;
CREATE TRIGGER trg_protect_profiles_privilege_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_privilege_fields();

-- 3. HARDEN complete_user_registration (STRICT auth.uid(), NO ANON, NO REBIND)
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
  v_uid UUID := auth.uid();
  v_kitchen public.kitchens;
  v_school public.schools;
  v_kitchen_id UUID := NULL;
  v_school_id UUID := NULL;
  v_existing public.profiles;
  v_profile public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi autentikasi tidak valid atau belum aktif. Silakan masuk terlebih dahulu sebelum melengkapi profil.';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != v_uid THEN
    RAISE EXCEPTION 'Akses ditolak: ID pengguna tidak sesuai dengan sesi autentikasi aktif.';
  END IF;

  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Peran Admin BGN hanya dapat ditetapkan oleh Administrator Pusat.';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nama lengkap penanggung jawab wajib diisi.';
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

  -- Prevent hijacking/overwriting an already-bound profile's role or institution
  SELECT * INTO v_existing
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.role = 'admin'
       OR (v_existing.kitchen_id IS NOT NULL AND (v_existing.role != p_role OR v_existing.kitchen_id IS DISTINCT FROM v_kitchen_id))
       OR (v_existing.school_id IS NOT NULL AND (v_existing.role != p_role OR v_existing.school_id IS DISTINCT FROM v_school_id)) THEN
      RAISE EXCEPTION 'Profil Anda sudah terdaftar dan terikat pada unit kerja resmi. Hubungi Admin BGN Pusat untuk perubahan peran atau unit.';
    END IF;

    UPDATE public.profiles
    SET
      full_name = trim(p_full_name),
      phone_wa = COALESCE(NULLIF(trim(p_phone_wa), ''), phone_wa)
    WHERE id = v_uid
    RETURNING * INTO v_profile;
  ELSE
    INSERT INTO public.profiles (
      id, role, full_name, phone_wa, kitchen_id, school_id, is_active, created_at
    )
    VALUES (
      v_uid, p_role, trim(p_full_name), COALESCE(trim(p_phone_wa), ''), v_kitchen_id, v_school_id, TRUE, timezone('utc', now())
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone_wa = COALESCE(NULLIF(EXCLUDED.phone_wa, ''), public.profiles.phone_wa)
    RETURNING * INTO v_profile;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_user_registration(user_role, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- 4. UPDATE seal_production_batch: EXEMPT STERILE/PACKAGED UHT MILK FROM 210m CAP
DROP FUNCTION IF EXISTS public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB, INTEGER);

CREATE OR REPLACE FUNCTION public.seal_production_batch(
  p_school_id UUID,
  p_menu_item_ids TEXT[],
  p_ompreng_count INTEGER,
  p_input_mode input_mode_type,
  p_sample_photo_path TEXT DEFAULT NULL,
  p_extra_items JSONB DEFAULT '[]'::jsonb,
  p_ai_detected_weakest_minutes INTEGER DEFAULT NULL
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
  v_extra_min_minutes INTEGER;
  v_extra_trigger_name TEXT;
  v_cooked_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_batch_code TEXT;
  v_qr_token TEXT;
  v_box_num INTEGER;
  v_box_label TEXT;
  v_new_batch_id UUID;
  v_item RECORD;
  v_extra RECORD;
  v_attempts INTEGER := 0;
  v_ai_overridden BOOLEAN := FALSE;
  v_ai_weakest_clamped INTEGER;
  v_has_extra BOOLEAN := (p_extra_items IS NOT NULL AND jsonb_typeof(p_extra_items) = 'array' AND jsonb_array_length(p_extra_items) > 0);
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
  SELECT * INTO v_school
  FROM public.schools
  WHERE id = p_school_id AND assigned_kitchen_id = v_caller.kitchen_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah tujuan tidak terdaftar atau berada di bawah SPPG lain.';
  END IF;
  IF NOT COALESCE(v_school.is_active, TRUE) THEN
    RAISE EXCEPTION 'Sekolah tujuan "%" sedang dinonaktifkan oleh Admin BGN.', v_school.name;
  END IF;

  IF (p_menu_item_ids IS NULL OR array_length(p_menu_item_ids, 1) IS NULL OR array_length(p_menu_item_ids, 1) < 1)
     AND NOT v_has_extra THEN
    RAISE EXCEPTION 'Batch produksi wajib menyertakan minimal 1 komponen menu.';
  END IF;

  IF p_ompreng_count IS NULL OR p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0.';
  END IF;

  IF p_menu_item_ids IS NOT NULL AND array_length(p_menu_item_ids, 1) > 0 THEN
    SELECT holding_time_minutes, name
    INTO v_min_minutes, v_trigger_item_name
    FROM public.menu_catalog
    WHERE id = ANY(p_menu_item_ids)
      AND is_active = TRUE
      AND (kitchen_id IS NULL OR kitchen_id = v_caller.kitchen_id)
    ORDER BY holding_time_minutes ASC, is_high_risk_wet DESC
    LIMIT 1;
  END IF;

  IF v_has_extra THEN
    SELECT
      CASE
        WHEN COALESCE((el->>'is_high_risk')::boolean, FALSE) = TRUE
          OR lower(COALESCE(el->>'name', '')) ~* '(santan|kuah|soto|lodeh|gulai|opor|sop)'
          OR (
            lower(COALESCE(el->>'name', '')) ~* 'susu'
            AND lower(COALESCE(el->>'name', '')) !~* '(uht|kotak|kemasan|botol|steril)'
          )
        THEN LEAST(210, LEAST(360, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 210))))
        ELSE LEAST(360, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 270)))
      END AS mins,
      NULLIF(trim(el->>'name'), '') AS nm
    INTO v_extra_min_minutes, v_extra_trigger_name
    FROM jsonb_array_elements(p_extra_items) AS el
    WHERE NULLIF(trim(el->>'name'), '') IS NOT NULL
    ORDER BY 1 ASC
    LIMIT 1;

    IF v_extra_min_minutes IS NOT NULL AND (v_min_minutes IS NULL OR v_extra_min_minutes < v_min_minutes) THEN
      v_min_minutes := v_extra_min_minutes;
      v_trigger_item_name := v_extra_trigger_name;
    END IF;
  END IF;

  IF v_min_minutes IS NULL THEN
    RAISE EXCEPTION 'Komponen menu tidak valid atau sudah dinonaktifkan dalam katalog.';
  END IF;

  IF p_ai_detected_weakest_minutes IS NOT NULL THEN
    v_ai_weakest_clamped := LEAST(360, GREATEST(60, p_ai_detected_weakest_minutes));
    IF p_input_mode = 'ai_photo' AND v_min_minutes > v_ai_weakest_clamped THEN
      v_ai_overridden := TRUE;
    END IF;
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
    holding_time_minutes, cooked_at, expires_at, input_mode, sample_photo_path,
    ai_nutrition_verified, ai_overridden, ai_detected_weakest_minutes
  ) VALUES (
    v_batch_code, v_qr_token, v_caller.kitchen_id, p_school_id, v_caller.id, v_box_num, v_box_label,
    p_ompreng_count, 'in_transit', 'active', v_trigger_item_name,
    v_min_minutes, v_cooked_at, v_expires_at, p_input_mode, p_sample_photo_path,
    (p_input_mode = 'ai_photo'), v_ai_overridden, v_ai_weakest_clamped
  )
  RETURNING id INTO v_new_batch_id;

  IF p_menu_item_ids IS NOT NULL AND array_length(p_menu_item_ids, 1) > 0 THEN
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
  END IF;

  IF v_has_extra THEN
    FOR v_extra IN
      SELECT
        NULLIF(trim(el->>'name'), '') AS name,
        CASE
          WHEN (el->>'category') IN ('karbohidrat', 'protein', 'sayur', 'buah', 'susu_minuman', 'sambal_pelengkap')
            THEN (el->>'category')
          ELSE 'sambal_pelengkap'
        END AS category,
        CASE
          WHEN COALESCE((el->>'is_high_risk')::boolean, FALSE) = TRUE
            OR lower(COALESCE(el->>'name', '')) ~* '(santan|kuah|soto|lodeh|gulai|opor|sop)'
            OR (
              lower(COALESCE(el->>'name', '')) ~* 'susu'
              AND lower(COALESCE(el->>'name', '')) !~* '(uht|kotak|kemasan|botol|steril)'
            )
          THEN LEAST(210, LEAST(360, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 210))))
          ELSE LEAST(360, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 270)))
        END AS holding_time_minutes
      FROM jsonb_array_elements(p_extra_items) AS el
    LOOP
      IF v_extra.name IS NOT NULL THEN
        INSERT INTO public.batch_menu_items (
          batch_id, menu_item_id, menu_item_name, category, holding_time_minutes
        ) VALUES (
          v_new_batch_id, NULL, v_extra.name, v_extra.category, v_extra.holding_time_minutes
        );
      END IF;
    END LOOP;
  END IF;

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
    'holding_time_minutes', v_min_minutes,
    'ai_overridden', v_ai_overridden
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB, INTEGER) TO authenticated;

-- 5. HARDEN MAGGOT RPCS (NO ANON, CALLER OWNERSHIP, ACTIVE CHECKS, DEDUP)
DROP FUNCTION IF EXISTS public.submit_maggot_report(UUID, waste_category_type, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.submit_maggot_report(
  p_batch_id UUID,
  p_waste_category waste_category_type,
  p_volume_tier TEXT,
  p_estimated_kg NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
  v_report_id UUID;
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_result JSONB;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['school'], FALSE, TRUE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch makanan tidak ditemukan.';
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Akses ditolak: Batch ini bukan milik sekolah Anda.';
  END IF;

  IF v_batch.batch_status = 'voided' THEN
    RAISE EXCEPTION 'Batch yang telah dibatalkan (VOID) oleh Dapur SPPG tidak dapat dialihkan ke jalur maggot.';
  END IF;

  IF p_estimated_kg IS NULL OR p_estimated_kg <= 0 THEN
    RAISE EXCEPTION 'Estimasi berat sisa makanan harus lebih besar dari 0 kg.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.maggot_pickup_reports WHERE batch_id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'Laporan pengalihan maggot untuk batch ini sudah pernah dikirim sebelumnya.';
  END IF;

  INSERT INTO public.maggot_pickup_reports (
    batch_id,
    school_id,
    kitchen_id,
    waste_category,
    volume_tier,
    estimated_kg,
    notes,
    status,
    reported_by,
    reported_at
  ) VALUES (
    p_batch_id,
    v_caller.school_id,
    v_batch.kitchen_id,
    p_waste_category,
    COALESCE(NULLIF(trim(p_volume_tier), ''), 'sedang'),
    p_estimated_kg,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    'ready_for_pickup',
    v_caller.id,
    v_now
  )
  RETURNING id INTO v_report_id;

  SELECT json_build_object(
    'id', r.id,
    'batch_id', r.batch_id,
    'batch_code', b.batch_code,
    'school_id', r.school_id,
    'school_name', s.name,
    'kitchen_id', r.kitchen_id,
    'waste_category', r.waste_category,
    'volume_tier', r.volume_tier,
    'estimated_kg', r.estimated_kg,
    'notes', r.notes,
    'status', r.status,
    'reported_at', r.reported_at
  )::jsonb INTO v_result
  FROM public.maggot_pickup_reports r
  JOIN public.production_batches b ON b.id = r.batch_id
  JOIN public.schools s ON s.id = r.school_id
  WHERE r.id = v_report_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_maggot_report(UUID, waste_category_type, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_maggot_report(UUID, waste_category_type, TEXT, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_maggot_partner(
  p_report_id UUID,
  p_partner_name TEXT DEFAULT 'Mitra BSF Maggot Jaya'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_report public.maggot_pickup_reports;
  v_kitchen public.kitchens;
  v_partner TEXT;
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  SELECT * INTO v_report FROM public.maggot_pickup_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan maggot tidak ditemukan.';
  END IF;

  IF v_report.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Laporan ini berada di luar wilayah SPPG Anda.';
  END IF;

  IF v_report.status = 'picked_up' THEN
    RAISE EXCEPTION 'Laporan maggot ini sudah selesai dijemput.';
  END IF;

  SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
  v_partner := COALESCE(NULLIF(trim(p_partner_name), ''), NULLIF(trim(v_kitchen.partner_bsf_name), ''), 'Mitra BSF Maggot Jaya');

  UPDATE public.maggot_pickup_reports
  SET
    status = 'partner_assigned',
    partner_name = v_partner,
    assigned_at = COALESCE(assigned_at, v_now)
  WHERE id = p_report_id;

  RETURN json_build_object(
    'report_id', p_report_id,
    'status', 'partner_assigned',
    'partner_name', v_partner,
    'assigned_at', v_now
  )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_maggot_partner(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_maggot_partner(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_maggot_pickup(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_report public.maggot_pickup_reports;
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  SELECT * INTO v_report FROM public.maggot_pickup_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan maggot tidak ditemukan.';
  END IF;

  IF v_report.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Laporan ini berada di luar wilayah SPPG Anda.';
  END IF;

  UPDATE public.maggot_pickup_reports
  SET
    status = 'picked_up',
    picked_up_at = COALESCE(picked_up_at, v_now)
  WHERE id = p_report_id;

  RETURN json_build_object(
    'report_id', p_report_id,
    'status', 'picked_up',
    'picked_up_at', v_now
  )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_maggot_pickup(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_maggot_pickup(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
