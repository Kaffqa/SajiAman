-- ============================================================================
-- SajiAman MBG — Migration 002: Realtime & Mobile Anon Access
-- Description: Grants full anon/authenticated access, updates RPCs for 1-Tap Mobile,
--              enables REPLICA IDENTITY FULL for instant Realtime WebSocket broadcasts.
-- ============================================================================

-- 1. SCHEMA PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- 2. POLICIES FOR REALTIME & READ ACCESS (ANON + AUTHENTICATED)

-- 2.1 menu_catalog
DROP POLICY IF EXISTS "menu_catalog_readable_by_authenticated" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_read_all" ON public.menu_catalog;
CREATE POLICY "menu_catalog_read_all"
  ON public.menu_catalog FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.2 kitchens
DROP POLICY IF EXISTS "kitchens_readable_by_associated_users" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_read_all" ON public.kitchens;
CREATE POLICY "kitchens_read_all"
  ON public.kitchens FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.3 schools
DROP POLICY IF EXISTS "schools_readable_by_authorized_users" ON public.schools;
DROP POLICY IF EXISTS "schools_read_all" ON public.schools;
CREATE POLICY "schools_read_all"
  ON public.schools FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.4 profiles
DROP POLICY IF EXISTS "profiles_view_own_or_colleague" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.5 production_batches (Allow SELECT & Realtime stream for all app users)
DROP POLICY IF EXISTS "batches_select_policy" ON public.production_batches;
DROP POLICY IF EXISTS "batches_read_all" ON public.production_batches;
CREATE POLICY "batches_read_all"
  ON public.production_batches FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.6 batch_menu_items
DROP POLICY IF EXISTS "batch_items_select_policy" ON public.batch_menu_items;
DROP POLICY IF EXISTS "batch_items_read_all" ON public.batch_menu_items;
CREATE POLICY "batch_items_read_all"
  ON public.batch_menu_items FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 2.7 maggot_pickup_reports
DROP POLICY IF EXISTS "maggot_reports_select_policy" ON public.maggot_pickup_reports;
DROP POLICY IF EXISTS "maggot_reports_read_all" ON public.maggot_pickup_reports;
CREATE POLICY "maggot_reports_read_all"
  ON public.maggot_pickup_reports FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 3. ENSURE REPLICA IDENTITY FULL FOR REALTIME WEBSOCKET BROADCASTS
ALTER TABLE public.production_batches REPLICA IDENTITY FULL;
ALTER TABLE public.maggot_pickup_reports REPLICA IDENTITY FULL;

-- 4. UPDATE RPCS TO SUPPORT 1-TAP ROLE AUTH & LIVE REALTIME FIELD TESTS

-- 4.1 Seal Production Batch RPC
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
  v_batch_id UUID;
  v_item RECORD;
  v_result JSONB;
BEGIN
  -- If authenticated user exists, use their profile
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
    IF v_caller IS NOT NULL AND v_caller.kitchen_id IS NOT NULL THEN
      v_kitchen_id := v_caller.kitchen_id;
      v_creator_id := v_caller.id;
    END IF;
  END IF;

  -- Ensure fallback profile exists in profiles table
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_creator_id) THEN
    INSERT INTO public.kitchens (id, code, name, address, total_ompreng_inventory)
    VALUES (v_kitchen_id, 'SPPG-SMG-01', 'SPPG Semarang Tengah', 'Jl. Pemuda No. 142, Semarang', 600)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, role, full_name, kitchen_id)
    VALUES (v_creator_id, 'kitchen', 'Chef Hendra Setiawan', v_kitchen_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Validate inputs
  IF p_menu_item_ids IS NULL OR array_length(p_menu_item_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Komposisi menu wajib menyertakan minimal 1 item makanan.';
  END IF;

  IF p_ompreng_count IS NULL OR p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0.';
  END IF;

  -- ANTI-TAMPERING: Query true holding time and trigger item from catalog
  SELECT holding_time_minutes, name
  INTO v_min_minutes, v_trigger_item_name
  FROM public.menu_catalog
  WHERE id = ANY(p_menu_item_ids) AND is_active = TRUE
  ORDER BY holding_time_minutes ASC, is_high_risk_wet DESC
  LIMIT 1;

  IF v_min_minutes IS NULL THEN
    -- Fallback default holding time if custom
    v_min_minutes := 210; -- 3.5 jam standar batas aman
    v_trigger_item_name := 'Sayur Bersantan / Menu Berkuah';
  END IF;

  -- Lock server timestamps
  v_cooked_at := timezone('utc', now());
  v_expires_at := v_cooked_at + make_interval(mins => v_min_minutes);

  -- Generate human-readable batch code: MBG-DDMM-XXXX
  v_batch_code := 'MBG-' ||
                  to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') ||
                  '-' ||
                  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  -- Insert production batch
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
    created_by
  ) VALUES (
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
    v_creator_id
  )
  RETURNING id INTO v_batch_id;

  -- Insert snapshot of menu items
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
    ) VALUES (
      v_batch_id,
      v_item.id,
      v_item.name,
      v_item.category,
      v_item.holding_time_minutes
    );
  END LOOP;

  -- Return newly created batch with relations as JSONB
  SELECT json_build_object(
    'id', b.id,
    'batch_code', b.batch_code,
    'kitchen_id', b.kitchen_id,
    'kitchen_name', k.name,
    'school_id', b.school_id,
    'school_name', s.name,
    'input_mode', b.input_mode,
    'sample_photo_path', b.sample_photo_path,
    'ai_nutrition_verified', b.ai_nutrition_verified,
    'weakest_link_item_name', b.weakest_link_item_name,
    'holding_time_minutes', b.holding_time_minutes,
    'cooked_at', b.cooked_at,
    'expires_at', b.expires_at,
    'ompreng_sent_count', b.ompreng_sent_count,
    'ompreng_status', b.ompreng_status,
    'created_at', b.created_at,
    'items', (
      SELECT json_agg(json_build_object(
        'id', bmi.menu_item_id,
        'name', bmi.menu_item_name,
        'category', bmi.category,
        'holding_time_minutes', bmi.holding_time_minutes
      ))
      FROM public.batch_menu_items bmi
      WHERE bmi.batch_id = b.id
    )
  )::jsonb INTO v_result
  FROM public.production_batches b
  JOIN public.kitchens k ON k.id = b.kitchen_id
  JOIN public.schools s ON s.id = b.school_id
  WHERE b.id = v_batch_id;

  RETURN v_result;
END;
$$;

-- 4.2 Confirm Ompreng Receipt by School
CREATE OR REPLACE FUNCTION public.confirm_ompreng_receipt(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  UPDATE public.production_batches
  SET
    ompreng_status = 'received_school',
    ompreng_received_at = v_now
  WHERE id = p_batch_id;

  RETURN json_build_object(
    'batch_id', p_batch_id,
    'ompreng_status', 'received_school',
    'ompreng_received_at', v_now
  )::jsonb;
END;
$$;

-- 4.3 Confirm Ompreng Return & Sterilization by Kitchen
CREATE OR REPLACE FUNCTION public.confirm_ompreng_return(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  UPDATE public.production_batches
  SET
    ompreng_status = 'returned_sterilized',
    ompreng_returned_at = v_now
  WHERE id = p_batch_id;

  RETURN json_build_object(
    'batch_id', p_batch_id,
    'ompreng_status', 'returned_sterilized',
    'ompreng_returned_at', v_now
  )::jsonb;
END;
$$;

-- 4.4 Submit Maggot Report
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
  v_batch public.production_batches;
  v_creator_id UUID := 'c0000000-0000-0000-0000-000000000002'::uuid;
  v_report_id UUID;
  v_now TIMESTAMPTZ := timezone('utc', now());
  v_result JSONB;
BEGIN
  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch makanan tidak ditemukan.';
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
    v_batch.school_id,
    v_batch.kitchen_id,
    p_waste_category,
    p_volume_tier,
    p_estimated_kg,
    p_notes,
    'ready_for_pickup',
    v_creator_id,
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

-- 5. GRANT EXECUTE ON ALL RPCS TO ANON AND AUTHENTICATED
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_receipt(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_return(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_maggot_report(UUID, waste_category_type, TEXT, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_maggot_partner(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_maggot_pickup(UUID) TO anon, authenticated;
