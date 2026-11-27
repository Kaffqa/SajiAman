-- ============================================================================
-- SajiAman MBG — Migration 008: Sealed Pre-Arrival Notification
-- Description:
--   Prevents leaking batch_code, weakest-link item, and expiry timestamp in
--   school pre-arrival notifications before the physical QR box seal is scanned.
-- ============================================================================

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

  -- Sealed pre-arrival notice: never reveal batch_code or expiry time prior to physical QR scan
  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'school', v_caller.kitchen_id, p_school_id, v_new_batch_id,
    'Kiriman Boks Baru Dalam Perjalanan',
    'Kiriman ' || v_box_label || ' dari ' || v_kitchen.name || ' sedang menuju sekolah (' || p_ompreng_count || ' ompreng). Pindai QR stiker boks fisik saat tiba untuk cek batas aman.',
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

GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
