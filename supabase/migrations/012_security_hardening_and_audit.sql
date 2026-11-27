-- ============================================================================
-- SajiAman MBG — Migration 012: Security Hardening, Clamp, Audit & is_active
-- Description:
--   1. Adds AI override audit columns and manual verification audit columns
--      to public.production_batches.
--   2. Introduces centralized public.assert_caller_active() guard and applies it
--      across all operational & master-data SECURITY DEFINER RPCs.
--   3. Clamps p_extra_items strictly to 60-360 mins (and <= 210 mins if
--      is_high_risk OR name matches perishable keywords), and records
--      ai_overridden if chef removed high-risk AI components.
--   4. Supports verification_method ('qr_scan' | 'manual_code') & reason
--      tracking inside verify_batch_qr_server & confirm_ompreng_receipt.
-- ============================================================================

-- 1. AUDIT COLUMNS ON production_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'ai_overridden'
  ) THEN
    ALTER TABLE public.production_batches
      ADD COLUMN ai_overridden BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'ai_detected_weakest_minutes'
  ) THEN
    ALTER TABLE public.production_batches
      ADD COLUMN ai_detected_weakest_minutes INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'verification_method'
  ) THEN
    ALTER TABLE public.production_batches
      ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'qr_scan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'manual_verification_reason'
  ) THEN
    ALTER TABLE public.production_batches
      ADD COLUMN manual_verification_reason TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.production_batches'::regclass
      AND conname = 'production_batches_verification_method_check'
  ) THEN
    ALTER TABLE public.production_batches
      ADD CONSTRAINT production_batches_verification_method_check
      CHECK (verification_method IN ('qr_scan', 'manual_code'));
  END IF;
END $$;

-- 2. CENTRALIZED CALLER & UNIT ACTIVE GUARD
CREATE OR REPLACE FUNCTION public.assert_caller_active(
  p_allowed_roles TEXT[] DEFAULT NULL,
  p_check_kitchen BOOLEAN DEFAULT FALSE,
  p_check_school BOOLEAN DEFAULT FALSE
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_kitchen public.kitchens;
  v_school public.schools;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Profil petugas tidak ditemukan.';
  END IF;

  IF NOT COALESCE(v_caller.is_active, TRUE) THEN
    RAISE EXCEPTION 'Akun petugas Anda sedang dinonaktifkan oleh Admin BGN.';
  END IF;

  IF p_allowed_roles IS NOT NULL AND NOT (v_caller.role::text = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'Akses ditolak: Peran akun tidak memiliki otorisasi untuk aksi ini.';
  END IF;

  IF p_check_kitchen THEN
    IF v_caller.kitchen_id IS NULL THEN
      RAISE EXCEPTION 'Akun petugas tidak terhubung ke unit Dapur SPPG.';
    END IF;
    SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
    IF NOT FOUND OR NOT COALESCE(v_kitchen.is_active, TRUE) THEN
      RAISE EXCEPTION 'Unit Dapur SPPG tidak ditemukan atau sedang dinonaktifkan oleh Admin BGN.';
    END IF;
  END IF;

  IF p_check_school THEN
    IF v_caller.school_id IS NULL THEN
      RAISE EXCEPTION 'Akun petugas tidak terhubung ke unit Sekolah penerima.';
    END IF;
    SELECT * INTO v_school FROM public.schools WHERE id = v_caller.school_id;
    IF NOT FOUND OR NOT COALESCE(v_school.is_active, TRUE) THEN
      RAISE EXCEPTION 'Unit Sekolah penerima tidak ditemukan atau sedang dinonaktifkan oleh Admin BGN.';
    END IF;
  END IF;

  RETURN v_caller;
END;
$$;

-- 3. HARDENED seal_production_batch WITH STRICT CLAMP (60-360, HIGH RISK <= 210) & AI OVERRIDE AUDIT
DROP FUNCTION IF EXISTS public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB);
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
          OR lower(COALESCE(el->>'name', '')) ~* '(santan|kuah|soto|lodeh|gulai|opor|sop|susu)'
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
            OR lower(COALESCE(el->>'name', '')) ~* '(santan|kuah|soto|lodeh|gulai|opor|sop|susu)'
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

-- 4. HARDEN verify_batch_qr_server WITH is_active + VERIFICATION METHOD AUDIT
DROP FUNCTION IF EXISTS public.verify_batch_qr_server(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.verify_batch_qr_server(TEXT, TEXT, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.verify_batch_qr_server(
  p_batch_code TEXT,
  p_sig TEXT DEFAULT NULL,
  p_require_sig BOOLEAN DEFAULT TRUE,
  p_verification_method TEXT DEFAULT NULL,
  p_manual_reason TEXT DEFAULT NULL
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
  v_batch public.production_batches;
  v_safe_method TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Sesi login tidak valid. Silakan masuk ulang.');
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Profil petugas tidak ditemukan.');
  END IF;

  IF NOT COALESCE(v_caller.is_active, TRUE) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Akun petugas Anda sedang dinonaktifkan oleh Admin BGN.');
  END IF;

  IF v_caller.role = 'school' AND v_caller.school_id IS NOT NULL THEN
    SELECT * INTO v_school FROM public.schools WHERE id = v_caller.school_id;
    IF NOT FOUND OR NOT COALESCE(v_school.is_active, TRUE) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'Unit Sekolah Anda sedang dinonaktifkan oleh Admin BGN.');
    END IF;
  END IF;

  IF v_caller.role = 'kitchen' AND v_caller.kitchen_id IS NOT NULL THEN
    SELECT * INTO v_kitchen FROM public.kitchens WHERE id = v_caller.kitchen_id;
    IF NOT FOUND OR NOT COALESCE(v_kitchen.is_active, TRUE) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'Unit Dapur SPPG Anda sedang dinonaktifkan oleh Admin BGN.');
    END IF;
  END IF;

  SELECT * INTO v_batch
  FROM public.production_batches
  WHERE upper(batch_code) = upper(trim(p_batch_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Kode boks tidak terdaftar dalam sistem manifes SajiAman.');
  END IF;

  IF v_caller.role = 'school' AND v_batch.school_id != v_caller.school_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'DITOLAK: Boks ini dialokasikan untuk sekolah lain, bukan sekolah Anda.');
  END IF;

  IF v_caller.role = 'kitchen' AND v_batch.kitchen_id != v_caller.kitchen_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'DITOLAK: Boks ini berasal dari unit Dapur SPPG lain.');
  END IF;

  IF p_require_sig AND v_batch.qr_token IS NOT NULL THEN
    IF p_sig IS NULL OR upper(trim(p_sig)) != upper(v_batch.qr_token) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'Tanda tangan QR tidak cocok dengan segel server. Terindikasi pemalsuan stiker.'
      );
    END IF;
  END IF;

  IF v_caller.role = 'school' AND p_verification_method IN ('qr_scan', 'manual_code') THEN
    v_safe_method := p_verification_method;
    IF v_safe_method = 'manual_code' AND (p_manual_reason IS NULL OR length(trim(p_manual_reason)) = 0) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'Alasan penggunaan Input Kode Manual wajib dipilih.'
      );
    END IF;

    UPDATE public.production_batches
    SET
      verification_method = v_safe_method,
      manual_verification_reason = CASE
        WHEN v_safe_method = 'manual_code' THEN trim(p_manual_reason)
        ELSE NULL
      END
    WHERE id = v_batch.id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'batch_id', v_batch.id,
    'batch_code', v_batch.batch_code,
    'batch_status', v_batch.batch_status,
    'school_id', v_batch.school_id
  );
END;
$$;

-- 5. HARDEN confirm_ompreng_receipt
DROP FUNCTION IF EXISTS public.confirm_ompreng_receipt(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.confirm_ompreng_receipt(UUID, INTEGER, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_ompreng_receipt(
  p_batch_id UUID,
  p_received_count INTEGER DEFAULT NULL,
  p_discrepancy_note TEXT DEFAULT NULL,
  p_verification_method TEXT DEFAULT NULL,
  p_manual_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
  v_school public.schools;
  v_effective_count INTEGER;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['school'], FALSE, TRUE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Akses ditolak: Boks ini dialokasikan untuk sekolah lain.';
  END IF;

  IF v_batch.batch_status != 'active' THEN
    RAISE EXCEPTION 'Boks berstatus % tidak dapat dikonfirmasi penerimaannya.', v_batch.batch_status;
  END IF;

  IF v_batch.ompreng_status != 'in_transit' THEN
    RAISE EXCEPTION 'Hanya boks dalam status pengiriman (in_transit) yang dapat dikonfirmasi.';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;
  v_effective_count := COALESCE(p_received_count, v_batch.ompreng_sent_count);

  IF v_effective_count < 0 OR v_effective_count > v_batch.ompreng_sent_count THEN
    RAISE EXCEPTION 'Jumlah diterima tidak valid (maksimal % boks).', v_batch.ompreng_sent_count;
  END IF;

  UPDATE public.production_batches
  SET
    ompreng_status = 'received_school',
    ompreng_received_at = timezone('utc', now()),
    ompreng_received_by = v_caller.id,
    ompreng_received_count = v_effective_count,
    ompreng_discrepancy_note = p_discrepancy_note,
    verification_method = CASE
      WHEN p_verification_method IN ('qr_scan', 'manual_code') THEN p_verification_method
      ELSE verification_method
    END,
    manual_verification_reason = CASE
      WHEN p_verification_method = 'manual_code' AND NULLIF(trim(p_manual_reason), '') IS NOT NULL
        THEN trim(p_manual_reason)
      ELSE manual_verification_reason
    END
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  IF v_effective_count < v_batch.ompreng_sent_count THEN
    INSERT INTO public.notifications (
      recipient_role, kitchen_id, school_id, batch_id, title, message, type
    ) VALUES (
      'kitchen',
      v_batch.kitchen_id,
      v_batch.school_id,
      p_batch_id,
      'Selisih Ompreng Dilaporkan',
      COALESCE(v_school.name, 'Sekolah') || ' menerima ' || v_effective_count || ' dari ' || v_batch.ompreng_sent_count || ' boks. Catatan: ' || COALESCE(p_discrepancy_note, 'Tidak ada catatan'),
      'ompreng_discrepancy'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 6. HARDEN reject_batch_spoiled
CREATE OR REPLACE FUNCTION public.reject_batch_spoiled(
  p_batch_id UUID,
  p_reason TEXT,
  p_photo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
  v_school public.schools;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['school'], FALSE, TRUE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Akses ditolak: Boks ini dialokasikan untuk sekolah lain.';
  END IF;

  IF v_batch.batch_status = 'voided' THEN
    RAISE EXCEPTION 'Batch sudah dibatalkan oleh Dapur SPPG.';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;

  UPDATE public.production_batches
  SET
    batch_status = 'rejected_spoiled',
    rejection_reason = trim(p_reason),
    rejection_photo_path = p_photo_path,
    rejected_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'kitchen',
    v_batch.kitchen_id,
    v_batch.school_id,
    p_batch_id,
    'DARURAT: Boks Ditolak Sekolah',
    'Boks ' || v_batch.batch_code || ' ditolak oleh ' || COALESCE(v_school.name, 'Sekolah') || '. Alasan: ' || trim(p_reason),
    'early_spoilage'
  );

  RETURN jsonb_build_object('success', true, 'batch', row_to_json(v_batch));
END;
$$;

-- 7. HARDEN mark_ompreng_ready_for_pickup
CREATE OR REPLACE FUNCTION public.mark_ompreng_ready_for_pickup(
  p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
  v_school public.schools;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['school'], FALSE, TRUE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Akses ditolak: Boks ini bukan milik sekolah Anda.';
  END IF;

  IF v_batch.ompreng_status != 'received_school' THEN
    RAISE EXCEPTION 'Ompreng harus dikonfirmasi diterima sekolah terlebih dahulu.';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;

  UPDATE public.production_batches
  SET
    ompreng_ready_for_pickup = TRUE,
    ompreng_ready_for_pickup_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'kitchen',
    v_batch.kitchen_id,
    v_batch.school_id,
    p_batch_id,
    'Ompreng Siap Dijemput',
    'Ompreng boks ' || v_batch.batch_code || ' di ' || COALESCE(v_school.name, 'Sekolah') || ' selesai digunakan dan siap dijemput dapur.',
    'ompreng_ready'
  );

  RETURN jsonb_build_object('success', true, 'batch', row_to_json(v_batch));
END;
$$;

-- 8. HARDEN void_production_batch
CREATE OR REPLACE FUNCTION public.void_production_batch(
  p_batch_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Akses ditolak: Batch ini milik Dapur SPPG lain.';
  END IF;

  IF v_batch.ompreng_status != 'in_transit' THEN
    RAISE EXCEPTION 'Hanya boks dalam status pengiriman (in_transit) yang dapat dibatalkan.';
  END IF;

  IF v_batch.batch_status != 'active' THEN
    RAISE EXCEPTION 'Batch sudah tidak dalam status aktif.';
  END IF;

  UPDATE public.production_batches
  SET
    batch_status = 'voided',
    void_reason = trim(p_reason),
    voided_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'school',
    v_batch.kitchen_id,
    v_batch.school_id,
    p_batch_id,
    'Pengiriman Boks Dibatalkan',
    'Pengiriman boks ' || v_batch.batch_code || ' dibatalkan oleh Dapur SPPG. Alasan: ' || trim(p_reason),
    'batch_voided'
  );

  RETURN jsonb_build_object('success', true, 'batch', row_to_json(v_batch));
END;
$$;

-- 9. HARDEN confirm_ompreng_return
CREATE OR REPLACE FUNCTION public.confirm_ompreng_return(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_batch public.production_batches;
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch tidak ditemukan.';
  END IF;

  IF v_batch.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Akses ditolak: Batch ini bukan milik SPPG Anda.';
  END IF;

  IF v_batch.ompreng_status != 'received_school' THEN
    RAISE EXCEPTION 'Ompreng belum berstatus diterima sekolah.';
  END IF;

  UPDATE public.production_batches
  SET
    ompreng_status = 'returned_sterilized',
    ompreng_returned_at = v_now,
    ompreng_returned_by = v_caller.id
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'ompreng_status', 'returned_sterilized',
    'ompreng_returned_at', v_now
  );
END;
$$;

-- 10. HARDEN MASTER DATA RPCs (upsert_menu_item, update_kitchen_inventory)
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
  v_caller := public.assert_caller_active(ARRAY['kitchen', 'admin'], FALSE, FALSE);
  IF v_caller.role = 'kitchen' THEN
    PERFORM public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Nama menu masakan wajib diisi.';
  END IF;

  IF p_category NOT IN ('karbohidrat', 'protein', 'sayur', 'buah', 'susu_minuman', 'sambal_pelengkap') THEN
    RAISE EXCEPTION 'Kategori tidak valid.';
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

  RETURN jsonb_build_object('success', true, 'item', row_to_json(v_item));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_kitchen_inventory(p_inventory_count INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller public.profiles;
  v_kitchen public.kitchens;
BEGIN
  v_caller := public.assert_caller_active(ARRAY['kitchen'], TRUE, FALSE);

  IF p_inventory_count IS NULL OR p_inventory_count < 0 THEN
    RAISE EXCEPTION 'Jumlah kuota ompreng tidak valid.';
  END IF;

  UPDATE public.kitchens
  SET total_ompreng_inventory = p_inventory_count
  WHERE id = v_caller.kitchen_id
  RETURNING * INTO v_kitchen;

  RETURN jsonb_build_object('success', true, 'kitchen', row_to_json(v_kitchen));
END;
$$;

GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_batch_qr_server(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_receipt(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_batch_spoiled(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ompreng_ready_for_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_production_batch(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_return(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_kitchen_inventory(INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
