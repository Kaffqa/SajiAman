-- ============================================================================
-- SajiAman MBG — Migration 003: Unified Security & Civic Features (P0, P1, P2)
-- Description: Adds batch_status, notifications table, ompreng discrepancy fields,
--              early spoilage rejection RPC, void batch RPC, registration RPC,
--              menu upsert RPC, and real-time triggers for 2-actor operation.
-- Note: Scope Lock strictly enforced — Maggot BSF module untouched.
-- ============================================================================

-- 1. ADD NEW COLUMNS TO PRODUCTION_BATCHES
DO $$
BEGIN
  -- batch_status ('active' | 'voided' | 'rejected_spoiled')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'batch_status'
  ) THEN
    ALTER TABLE public.production_batches 
      ADD COLUMN batch_status TEXT NOT NULL DEFAULT 'active' 
      CHECK (batch_status IN ('active', 'voided', 'rejected_spoiled'));
  END IF;

  -- rejection fields (SCR-07 Force Red Override)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.production_batches 
      ADD COLUMN rejection_reason TEXT,
      ADD COLUMN rejection_photo_path TEXT,
      ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  -- void fields (SCR-04 Controlled Void)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE public.production_batches 
      ADD COLUMN void_reason TEXT,
      ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;

  -- ompreng discrepancy fields (SCR-07 & SCR-05A)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'ompreng_received_count'
  ) THEN
    ALTER TABLE public.production_batches 
      ADD COLUMN ompreng_received_count INTEGER CHECK (ompreng_received_count >= 0),
      ADD COLUMN ompreng_discrepancy_note TEXT;
  END IF;

  -- ompreng ready for pickup flag (SCR-07 School History)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'ompreng_ready_for_pickup'
  ) THEN
    ALTER TABLE public.production_batches 
      ADD COLUMN ompreng_ready_for_pickup BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN ompreng_ready_for_pickup_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. ADD PHONE_WA TO PROFILES IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_wa'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone_wa TEXT;
  END IF;
END $$;

-- 3. CREATE NOTIFICATIONS TABLE FOR REALTIME OPERATIONAL ALERTS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role user_role,
  kitchen_id UUID REFERENCES public.kitchens(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.production_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'new_batch', 'early_spoilage', 'ompreng_discrepancy', 'ompreng_ready', 'batch_voided'
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_kitchen_role 
  ON public.notifications (kitchen_id, recipient_role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_school_role 
  ON public.notifications (school_id, recipient_role, is_read);

-- 4. REALTIME PUBLICATION & REPLICA IDENTITY
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 5. PERMISSIONS & RLS FOR NOTIFICATIONS
GRANT ALL ON public.notifications TO anon, authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_read_all" ON public.notifications;
CREATE POLICY "notifications_read_all"
  ON public.notifications FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
CREATE POLICY "notifications_insert_all"
  ON public.notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "notifications_update_all" ON public.notifications;
CREATE POLICY "notifications_update_all"
  ON public.notifications FOR UPDATE
  TO anon, authenticated
  USING (TRUE);

-- 6. RPC: COMPLETE USER REGISTRATION (P1 Auth & Onboarding)
CREATE OR REPLACE FUNCTION public.complete_user_registration(
  p_role user_role,
  p_full_name TEXT,
  p_phone_wa TEXT,
  p_kitchen_code TEXT DEFAULT NULL,
  p_school_npsn TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_kitchen_id UUID := NULL;
  v_school_id UUID := NULL;
  v_profile public.profiles;
BEGIN
  -- If running in local demo without auth.uid(), generate a deterministic UUID
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
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

-- 7. RPC: REJECT BATCH SPOILED / FORCE RED OVERRIDE (SCR-07)
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
  v_batch public.production_batches;
  v_school public.schools;
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;

  -- Lock batch to rejected_spoiled
  UPDATE public.production_batches
  SET 
    batch_status = 'rejected_spoiled',
    rejection_reason = trim(p_reason),
    rejection_photo_path = p_photo_path,
    rejected_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  -- Push urgent operational alert to Kitchen
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

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 8. RPC: MARK OMPRENG READY FOR PICKUP (SCR-07 School History)
CREATE OR REPLACE FUNCTION public.mark_ompreng_ready_for_pickup(
  p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.production_batches;
  v_school public.schools;
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;

  UPDATE public.production_batches
  SET 
    ompreng_ready_for_pickup = TRUE,
    ompreng_ready_for_pickup_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  -- Notify Kitchen
  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'kitchen',
    v_batch.kitchen_id,
    v_batch.school_id,
    p_batch_id,
    'Ompreng Siap Dijemput',
    'Ompreng boks ' || v_batch.batch_code || ' di ' || COALESCE(v_school.name, 'Sekolah') || ' telah selesai dan siap dijemput dapur.',
    'ompreng_ready'
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 9. RPC: VOID PRODUCTION BATCH (SCR-04 Controlled Void)
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
  v_batch public.production_batches;
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.ompreng_status != 'in_transit' THEN
    RAISE EXCEPTION 'Hanya boks dalam status pengiriman (in_transit) yang dapat dibatalkan';
  END IF;

  IF v_batch.batch_status != 'active' THEN
    RAISE EXCEPTION 'Batch sudah tidak dalam status aktif';
  END IF;

  UPDATE public.production_batches
  SET 
    batch_status = 'voided',
    void_reason = trim(p_reason),
    voided_at = timezone('utc', now())
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  -- Notify School of cancellation
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

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 10. RPC: UPSERT MENU ITEM (P2 Menu Catalog Management)
CREATE OR REPLACE FUNCTION public.upsert_menu_item(
  p_id TEXT,
  p_name TEXT,
  p_category TEXT,
  p_risk_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holding_minutes INTEGER := 270;
  v_is_high_risk BOOLEAN := FALSE;
  v_item public.menu_catalog;
BEGIN
  IF p_risk_tier = 'santan_kuah_tinggi' THEN
    v_holding_minutes := 210; -- 3.5 jam
    v_is_high_risk := TRUE;
  ELSIF p_risk_tier = 'tumis_kuah' THEN
    v_holding_minutes := 240; -- 4.0 jam
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'kering_goreng' THEN
    v_holding_minutes := 270; -- 4.5 jam
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'lauk_kering' THEN
    v_holding_minutes := 300; -- 5.0 jam
    v_is_high_risk := FALSE;
  ELSIF p_risk_tier = 'buah_utuh' THEN
    v_holding_minutes := 360; -- 6.0 jam
    v_is_high_risk := FALSE;
  ELSE
    v_holding_minutes := 270;
    v_is_high_risk := FALSE;
  END IF;

  INSERT INTO public.menu_catalog (
    id, name, category, holding_time_minutes, is_high_risk_wet, is_active
  )
  VALUES (
    trim(p_id), trim(p_name), p_category, v_holding_minutes, v_is_high_risk, TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    holding_time_minutes = EXCLUDED.holding_time_minutes,
    is_high_risk_wet = EXCLUDED.is_high_risk_wet,
    is_active = TRUE
  RETURNING * INTO v_item;

  RETURN jsonb_build_object(
    'success', true,
    'item', row_to_json(v_item)
  );
END;
$$;

-- 11. UPDATE CONFIRM_OMPRENG_RECEIPT TO ACCEPT DISCREPANCIES (SCR-07)
DROP FUNCTION IF EXISTS public.confirm_ompreng_receipt(UUID);
CREATE OR REPLACE FUNCTION public.confirm_ompreng_receipt(
  p_batch_id UUID,
  p_received_count INTEGER DEFAULT NULL,
  p_discrepancy_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.production_batches;
  v_school public.schools;
  v_effective_count INTEGER;
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch dengan ID % tidak ditemukan', p_batch_id;
  END IF;

  IF v_batch.ompreng_status != 'in_transit' THEN
    RAISE EXCEPTION 'Hanya boks dalam status in_transit yang dapat dikonfirmasi penerimaannya';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_batch.school_id;

  v_effective_count := COALESCE(p_received_count, v_batch.ompreng_sent_count);

  UPDATE public.production_batches
  SET 
    ompreng_status = 'received_school',
    ompreng_received_at = timezone('utc', now()),
    ompreng_received_count = v_effective_count,
    ompreng_discrepancy_note = p_discrepancy_note
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  -- If discrepancy reported (e.g. fewer boxes received than dispatched), notify Kitchen
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

-- 12. UPDATE SEAL_PRODUCTION_BATCH TO SEND REALTIME ARRIVAL NOTIFICATION
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
  v_kitchen_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_creator_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_caller public.profiles;
  v_school public.schools;
  v_min_minutes INTEGER;
  v_trigger_item_name TEXT;
  v_cooked_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_batch_code TEXT;
  v_new_batch_id UUID;
  v_item RECORD;
BEGIN
  -- If authenticated user exists, adopt their kitchen_id and profile id
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
    IF v_caller.kitchen_id IS NOT NULL THEN
      v_kitchen_id := v_caller.kitchen_id;
    END IF;
    v_creator_id := auth.uid();
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah tujuan dengan ID % tidak ditemukan', p_school_id;
  END IF;

  IF array_length(p_menu_item_ids, 1) IS NULL OR array_length(p_menu_item_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Batch produksi wajib menyertakan minimal 1 menu';
  END IF;

  IF p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0';
  END IF;

  -- Weakest-Link Rule Evaluation
  SELECT 
    holding_time_minutes,
    name
  INTO 
    v_min_minutes,
    v_trigger_item_name
  FROM public.menu_catalog
  WHERE id = ANY(p_menu_item_ids) AND is_active = TRUE
  ORDER BY holding_time_minutes ASC
  LIMIT 1;

  IF v_min_minutes IS NULL THEN
    v_min_minutes := 210;
    v_trigger_item_name := 'Menu Standar';
  END IF;

  v_cooked_at := timezone('utc', now());
  v_expires_at := v_cooked_at + make_interval(mins => v_min_minutes);

  v_batch_code := 'MBG-' || 
                  to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') || '-' || 
                  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.production_batches (
    batch_code,
    kitchen_id,
    school_id,
    input_mode,
    sample_photo_path,
    ai_nutrition_verified,
    weakest_link_item_name,
    holding_time_minutes,
    cooked_at,
    expires_at,
    ompreng_sent_count,
    ompreng_status,
    batch_status,
    created_by,
    created_at
  )
  VALUES (
    v_batch_code,
    v_kitchen_id,
    p_school_id,
    p_input_mode,
    p_sample_photo_path,
    (p_input_mode = 'ai_photo'),
    v_trigger_item_name,
    v_min_minutes,
    v_cooked_at,
    v_expires_at,
    p_ompreng_count,
    'in_transit',
    'active',
    v_creator_id,
    v_cooked_at
  )
  RETURNING id INTO v_new_batch_id;

  FOR v_item IN
    SELECT id, name, category, holding_time_minutes
    FROM public.menu_catalog
    WHERE id = ANY(p_menu_item_ids)
  LOOP
    INSERT INTO public.batch_menu_items (
      batch_id,
      menu_item_id,
      menu_item_name,
      category,
      holding_time_minutes
    )
    VALUES (
      v_new_batch_id,
      v_item.id,
      v_item.name,
      v_item.category,
      v_item.holding_time_minutes
    );
  END LOOP;

  -- Realtime Arrival Notification to the recipient school
  INSERT INTO public.notifications (
    recipient_role, kitchen_id, school_id, batch_id, title, message, type
  ) VALUES (
    'school',
    v_kitchen_id,
    p_school_id,
    v_new_batch_id,
    'Boks Baru Dikirim SPPG',
    'Boks ' || v_batch_code || ' (' || v_trigger_item_name || ') sedang dalam perjalanan. Batas konsumsi terkunci jam ' || to_char(v_expires_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB',
    'new_batch'
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_new_batch_id,
    'batch_code', v_batch_code,
    'cooked_at', v_cooked_at,
    'expires_at', v_expires_at,
    'weakest_link_item', v_trigger_item_name,
    'holding_time_minutes', v_min_minutes
  );
END;
$$;
