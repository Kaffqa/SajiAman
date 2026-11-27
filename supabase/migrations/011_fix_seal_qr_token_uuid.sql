-- ============================================================================
-- SajiAman MBG — Migration 011: Fix seal_production_batch QR Token Generator
-- Description:
--   Replaces gen_random_bytes(16) (which lives in extensions schema outside
--   SET search_path = public) with built-in PostgreSQL gen_random_uuid()
--   so seal_production_batch succeeds reliably on all Supabase databases.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seal_production_batch(
  p_school_id UUID,
  p_menu_item_ids TEXT[],
  p_ompreng_count INTEGER,
  p_input_mode input_mode_type,
  p_sample_photo_path TEXT DEFAULT NULL,
  p_extra_items JSONB DEFAULT '[]'::jsonb
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
  v_has_extra BOOLEAN := (p_extra_items IS NOT NULL AND jsonb_typeof(p_extra_items) = 'array' AND jsonb_array_length(p_extra_items) > 0);
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
  IF NOT FOUND OR NOT v_kitchen.is_active THEN
    RAISE EXCEPTION 'Unit Dapur SPPG tidak ditemukan atau sedang dinonaktifkan.';
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
      LEAST(720, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 270))) AS mins,
      NULLIF(trim(el->>'name'), '') AS nm
    INTO v_extra_min_minutes, v_extra_trigger_name
    FROM jsonb_array_elements(p_extra_items) AS el
    WHERE NULLIF(trim(el->>'name'), '') IS NOT NULL
    ORDER BY LEAST(720, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 270))) ASC
    LIMIT 1;

    IF v_extra_min_minutes IS NOT NULL AND (v_min_minutes IS NULL OR v_extra_min_minutes < v_min_minutes) THEN
      v_min_minutes := v_extra_min_minutes;
      v_trigger_item_name := v_extra_trigger_name;
    END IF;
  END IF;

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
        LEAST(720, GREATEST(60, COALESCE((el->>'holding_time_minutes')::int, 270))) AS holding_time_minutes
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
    'holding_time_minutes', v_min_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
