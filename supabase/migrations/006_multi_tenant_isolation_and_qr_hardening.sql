-- ============================================================================
-- SajiAman MBG — Migration 006: Multi-Tenant Isolation, Unique QR & RPC Hardening
-- Description:
--   1. Extends production_batches with server qr_token, deterministic box_number & box_label.
--   2. Extends schools with pic_name, phone_wa, and default_portions.
--   3. Restores strict multi-tenant RLS policies per kitchen_id / school_id
--      (removes permissive USING (TRUE) policies from migrations 002, 003, 005).
--   4. Restores strict ownership & role validation across ALL operational RPCs.
--   5. Adds server-side verify_batch_qr_server, manage_school, and update_kitchen_inventory RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS (Idempotent)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'production_batches' AND column_name = 'qr_token'
  ) THEN
    ALTER TABLE public.production_batches
      ADD COLUMN qr_token TEXT,
      ADD COLUMN box_number INTEGER,
      ADD COLUMN box_label TEXT;
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

-- Backfill qr_token, box_number & box_label for existing batches
WITH numbered AS (
  SELECT
    b.id,
    row_number() OVER (PARTITION BY b.kitchen_id ORDER BY b.created_at ASC) AS seq,
    k.code AS kitchen_code,
    b.batch_code,
    b.cooked_at
  FROM public.production_batches b
  JOIN public.kitchens k ON k.id = b.kitchen_id
)
UPDATE public.production_batches pb
SET
  box_number = COALESCE(pb.box_number, n.seq::integer),
  box_label = COALESCE(pb.box_label, 'Boks #' || lpad(n.seq::text, 2, '0')),
  qr_token = COALESCE(
    pb.qr_token,
    upper(substr(encode(sha256(convert_to(n.batch_code || '#' || n.kitchen_code || '#' || extract(epoch from n.cooked_at)::bigint::text, 'UTF8')), 'hex'), 1, 16))
  )
FROM numbered n
WHERE pb.id = n.id
  AND (pb.qr_token IS NULL OR pb.box_label IS NULL OR pb.box_number IS NULL);

-- Backfill default PIC / portions on seeded schools if empty
UPDATE public.schools
SET
  pic_name = COALESCE(pic_name, 'Koordinator ' || name),
  default_portions = CASE
    WHEN npsn = '20328901' AND default_portions = 100 THEN 150
    WHEN npsn = '20328902' AND default_portions = 100 THEN 120
    WHEN npsn = '20328903' AND default_portions = 100 THEN 90
    WHEN npsn = '20328904' AND default_portions = 100 THEN 110
    ELSE default_portions
  END
WHERE pic_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_batches_batch_code_upper ON public.production_batches (upper(batch_code));
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON public.production_batches (created_by);

-- ----------------------------------------------------------------------------
-- 2. RLS HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_kitchen_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kitchen_id FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. STRICT MULTI-TENANT RLS POLICIES (REMOVE ALL PERMISSIVE USING(TRUE))
-- ----------------------------------------------------------------------------

-- 3.1 kitchens
DROP POLICY IF EXISTS "kitchens_read_all" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_readable_by_associated_users" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_select_scoped" ON public.kitchens;
DROP POLICY IF EXISTS "kitchens_update_own" ON public.kitchens;

CREATE POLICY "kitchens_select_scoped"
  ON public.kitchens FOR SELECT
  TO authenticated
  USING (
    id = public.my_kitchen_id() OR
    id IN (SELECT assigned_kitchen_id FROM public.schools WHERE id = public.my_school_id())
  );

CREATE POLICY "kitchens_update_own"
  ON public.kitchens FOR UPDATE
  TO authenticated
  USING (public.my_role() = 'kitchen' AND id = public.my_kitchen_id())
  WITH CHECK (public.my_role() = 'kitchen' AND id = public.my_kitchen_id());

-- 3.2 schools
DROP POLICY IF EXISTS "schools_read_all" ON public.schools;
DROP POLICY IF EXISTS "schools_readable_by_authorized_users" ON public.schools;
DROP POLICY IF EXISTS "schools_select_scoped" ON public.schools;
DROP POLICY IF EXISTS "schools_insert_kitchen" ON public.schools;
DROP POLICY IF EXISTS "schools_update_kitchen" ON public.schools;

CREATE POLICY "schools_select_scoped"
  ON public.schools FOR SELECT
  TO authenticated
  USING (
    id = public.my_school_id() OR
    assigned_kitchen_id = public.my_kitchen_id()
  );

CREATE POLICY "schools_insert_kitchen"
  ON public.schools FOR INSERT
  TO authenticated
  WITH CHECK (
    public.my_role() = 'kitchen' AND
    assigned_kitchen_id = public.my_kitchen_id()
  );

CREATE POLICY "schools_update_kitchen"
  ON public.schools FOR UPDATE
  TO authenticated
  USING (
    public.my_role() = 'kitchen' AND
    assigned_kitchen_id = public.my_kitchen_id()
  )
  WITH CHECK (
    public.my_role() = 'kitchen' AND
    assigned_kitchen_id = public.my_kitchen_id()
  );

-- 3.3 profiles
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own_or_colleague" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_scoped"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid()) OR
    (kitchen_id IS NOT NULL AND kitchen_id = public.my_kitchen_id()) OR
    (school_id IS NOT NULL AND school_id = public.my_school_id())
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- 3.4 production_batches
DROP POLICY IF EXISTS "batches_read_all" ON public.production_batches;
DROP POLICY IF EXISTS "batches_select_policy" ON public.production_batches;

CREATE POLICY "batches_select_scoped"
  ON public.production_batches FOR SELECT
  TO authenticated
  USING (
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

-- 3.5 batch_menu_items
DROP POLICY IF EXISTS "batch_items_read_all" ON public.batch_menu_items;
DROP POLICY IF EXISTS "batch_items_select_policy" ON public.batch_menu_items;

CREATE POLICY "batch_items_select_scoped"
  ON public.batch_menu_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.production_batches b
      WHERE b.id = batch_id
        AND (b.kitchen_id = public.my_kitchen_id() OR b.school_id = public.my_school_id())
    )
  );

-- 3.6 notifications
DROP POLICY IF EXISTS "notifications_read_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_all" ON public.notifications;

CREATE POLICY "notifications_select_scoped"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    (recipient_role = 'kitchen' AND kitchen_id = public.my_kitchen_id()) OR
    (recipient_role = 'school' AND school_id = public.my_school_id())
  );

CREATE POLICY "notifications_update_scoped"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    (recipient_role = 'kitchen' AND kitchen_id = public.my_kitchen_id()) OR
    (recipient_role = 'school' AND school_id = public.my_school_id())
  )
  WITH CHECK (
    (recipient_role = 'kitchen' AND kitchen_id = public.my_kitchen_id()) OR
    (recipient_role = 'school' AND school_id = public.my_school_id())
  );

-- 3.7 maggot_pickup_reports (Scoped read without altering Maggot module flow)
DROP POLICY IF EXISTS "maggot_reports_read_all" ON public.maggot_pickup_reports;
DROP POLICY IF EXISTS "maggot_reports_select_policy" ON public.maggot_pickup_reports;

CREATE POLICY "maggot_reports_select_scoped"
  ON public.maggot_pickup_reports FOR SELECT
  TO authenticated
  USING (
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

-- 3.8 menu_catalog
DROP POLICY IF EXISTS "menu_catalog_read_all" ON public.menu_catalog;
DROP POLICY IF EXISTS "menu_catalog_readable_by_authenticated" ON public.menu_catalog;

CREATE POLICY "menu_catalog_select_authenticated"
  ON public.menu_catalog FOR SELECT
  TO authenticated
  USING (TRUE);

-- 3.9 Storage policies for sample-photos (kitchen uploads + school rejection evidence uploads)
DROP POLICY IF EXISTS "kitchen_upload_sample_photos" ON storage.objects;
DROP POLICY IF EXISTS "kitchen_and_school_read_sample_photos" ON storage.objects;
DROP POLICY IF EXISTS "school_upload_rejection_photos" ON storage.objects;

CREATE POLICY "kitchen_upload_sample_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sample-photos' AND
    public.my_role() = 'kitchen' AND
    (storage.foldername(name))[1] = public.my_kitchen_id()::text
  );

CREATE POLICY "school_upload_rejection_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sample-photos' AND
    public.my_role() = 'school' AND
    (storage.foldername(name))[1] = 'rejections' AND
    (storage.foldername(name))[2] = public.my_school_id()::text
  );

CREATE POLICY "kitchen_and_school_read_sample_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sample-photos' AND (
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

-- ----------------------------------------------------------------------------
-- 4. SECURE SERVER-SIDE RPCs (STRICT OWNERSHIP & CRYPTOGRAPHIC QR)
-- ----------------------------------------------------------------------------

-- 4.1 Seal Production Batch (Strict Auth, Collision-Free Code, Unique QR Token)
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

  -- Weakest-Link Rule Evaluation from catalog
  SELECT holding_time_minutes, name
  INTO v_min_minutes, v_trigger_item_name
  FROM public.menu_catalog
  WHERE id = ANY(p_menu_item_ids) AND is_active = TRUE
  ORDER BY holding_time_minutes ASC, is_high_risk_wet DESC
  LIMIT 1;

  IF v_min_minutes IS NULL THEN
    RAISE EXCEPTION 'Komponen menu tidak valid atau sudah dinonaktifkan dalam katalog.';
  END IF;

  v_cooked_at := timezone('utc', now());
  v_expires_at := v_cooked_at + make_interval(mins => v_min_minutes);

  -- Atomic daily box sequence per kitchen (in WIB date)
  SELECT COALESCE(MAX(box_number), 0) + 1
  INTO v_box_num
  FROM public.production_batches
  WHERE kitchen_id = v_caller.kitchen_id
    AND (cooked_at AT TIME ZONE 'Asia/Jakarta')::date = (v_cooked_at AT TIME ZONE 'Asia/Jakarta')::date;

  v_box_label := 'Boks #' || lpad(v_box_num::text, 2, '0');

  -- Collision-safe 6-char batch code + cryptographic SHA-256 QR token
  LOOP
    v_attempts := v_attempts + 1;
    v_batch_code := 'MBG-' ||
                    to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') || '-' ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    v_qr_token := upper(substr(encode(sha256(convert_to(
      v_batch_code || '#' || v_kitchen.code || '#' || extract(epoch from v_cooked_at)::bigint::text || '#' || gen_random_uuid()::text,
      'UTF8'
    )), 'hex'), 1, 16));

    BEGIN
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
        created_at,
        qr_token,
        box_number,
        box_label
      )
      VALUES (
        v_batch_code,
        v_caller.kitchen_id,
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
        v_caller.id,
        v_cooked_at,
        v_qr_token,
        v_box_num,
        v_box_label
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
    'school',
    v_caller.kitchen_id,
    p_school_id,
    v_new_batch_id,
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

-- 4.2 Server-Side QR & School Ownership Verification RPC
CREATE OR REPLACE FUNCTION public.verify_batch_qr_server(
  p_batch_code TEXT,
  p_sig TEXT DEFAULT NULL,
  p_require_sig BOOLEAN DEFAULT TRUE
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
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Sesi login tidak valid. Silakan masuk ulang.'
    );
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Profil petugas tidak ditemukan.'
    );
  END IF;

  SELECT * INTO v_batch
  FROM public.production_batches
  WHERE upper(batch_code) = upper(trim(p_batch_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Kode boks tidak terdaftar dalam sistem manifes SajiAman.'
    );
  END IF;

  IF v_caller.role = 'school' AND v_batch.school_id != v_caller.school_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'DITOLAK: Boks ini dialokasikan untuk sekolah lain, bukan sekolah Anda.'
    );
  END IF;

  IF v_caller.role = 'kitchen' AND v_batch.kitchen_id != v_caller.kitchen_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'DITOLAK: Boks ini berasal dari unit Dapur SPPG lain.'
    );
  END IF;

  IF p_require_sig AND v_batch.qr_token IS NOT NULL THEN
    IF p_sig IS NULL OR upper(trim(p_sig)) != upper(v_batch.qr_token) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'Tanda tangan kriptografi QR tidak cocok dengan segel server. Terindikasi pemalsuan stiker.'
      );
    END IF;
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

-- 4.3 Confirm Ompreng Receipt (Strict School Ownership + Active Batch Guard)
DROP FUNCTION IF EXISTS public.confirm_ompreng_receipt(UUID, INTEGER, TEXT);
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
  v_caller public.profiles;
  v_batch public.production_batches;
  v_school public.schools;
  v_effective_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'school' OR v_caller.school_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Koordinator Sekolah yang dapat mengonfirmasi penerimaan boks.';
  END IF;

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
    ompreng_discrepancy_note = p_discrepancy_note
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

-- 4.4 Reject Batch Spoiled (Strict School Ownership)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'school' OR v_caller.school_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Koordinator Sekolah yang dapat menolak kondisi boks.';
  END IF;

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

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 4.5 Mark Ompreng Ready For Pickup (Strict School Ownership)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'school' OR v_caller.school_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Koordinator Sekolah yang dapat menandai wadah siap jemput.';
  END IF;

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

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 4.6 Void Production Batch (Strict Kitchen Ownership)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya petugas Dapur SPPG yang dapat membatalkan batch.';
  END IF;

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

  RETURN jsonb_build_object(
    'success', true,
    'batch', row_to_json(v_batch)
  );
END;
$$;

-- 4.7 Confirm Ompreng Return (Strict Kitchen Ownership)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Silakan login terlebih dahulu.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Dapur SPPG yang dapat memverifikasi sterilisasi ompreng.';
  END IF;

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

-- 4.8 Upsert Menu Item (Kitchen Only + Support Edit & Deactivate)
DROP FUNCTION IF EXISTS public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT);
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
  v_holding_minutes INTEGER := 270;
  v_is_high_risk BOOLEAN := FALSE;
  v_item public.menu_catalog;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' THEN
    RAISE EXCEPTION 'Hanya petugas Dapur SPPG yang dapat mengelola katalog menu.';
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

  INSERT INTO public.menu_catalog (
    id, name, category, holding_time_minutes, is_high_risk_wet, is_active
  )
  VALUES (
    trim(p_id), trim(p_name), p_category, v_holding_minutes, v_is_high_risk, COALESCE(p_is_active, TRUE)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    holding_time_minutes = EXCLUDED.holding_time_minutes,
    is_high_risk_wet = EXCLUDED.is_high_risk_wet,
    is_active = EXCLUDED.is_active
  RETURNING * INTO v_item;

  RETURN jsonb_build_object(
    'success', true,
    'item', row_to_json(v_item)
  );
END;
$$;

-- 4.9 Manage School RPC (Scoped strictly to caller's kitchen)
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
DECLARE
  v_caller public.profiles;
  v_school public.schools;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Hanya petugas Dapur SPPG yang dapat mengelola sekolah binaan.';
  END IF;

  IF p_school_id IS NOT NULL THEN
    UPDATE public.schools
    SET
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      npsn = COALESCE(NULLIF(trim(p_npsn), ''), npsn),
      address = COALESCE(NULLIF(trim(p_address), ''), address),
      pic_name = COALESCE(NULLIF(trim(p_pic_name), ''), pic_name),
      phone_wa = COALESCE(NULLIF(trim(p_phone_wa), ''), phone_wa),
      default_portions = COALESCE(p_default_portions, default_portions)
    WHERE id = p_school_id AND assigned_kitchen_id = v_caller.kitchen_id
    RETURNING * INTO v_school;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sekolah tidak ditemukan atau bukan binaan SPPG Anda.';
    END IF;
  ELSE
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
      RAISE EXCEPTION 'Nama sekolah wajib diisi.';
    END IF;

    INSERT INTO public.schools (
      name, npsn, address, pic_name, phone_wa, default_portions, assigned_kitchen_id
    ) VALUES (
      trim(p_name),
      NULLIF(trim(p_npsn), ''),
      COALESCE(NULLIF(trim(p_address), ''), 'Kota Semarang'),
      COALESCE(NULLIF(trim(p_pic_name), ''), 'Koordinator ' || trim(p_name)),
      NULLIF(trim(p_phone_wa), ''),
      COALESCE(p_default_portions, 100),
      v_caller.kitchen_id
    )
    RETURNING * INTO v_school;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'school', row_to_json(v_school)
  );
END;
$$;

-- 4.10 Update Kitchen Inventory (Scoped strictly to caller's kitchen)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Hanya petugas Dapur SPPG yang dapat memperbarui inventaris.';
  END IF;

  IF p_inventory_count IS NULL OR p_inventory_count < 0 THEN
    RAISE EXCEPTION 'Jumlah kuota ompreng tidak valid.';
  END IF;

  UPDATE public.kitchens
  SET total_ompreng_inventory = p_inventory_count
  WHERE id = v_caller.kitchen_id
  RETURNING * INTO v_kitchen;

  RETURN jsonb_build_object(
    'success', true,
    'kitchen', row_to_json(v_kitchen)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. STRICT GRANT & REVOKE PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_kitchen_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_batch_qr_server(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_ompreng_receipt(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_batch_spoiled(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_ompreng_ready_for_pickup(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_production_batch(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_ompreng_return(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manage_school(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_kitchen_inventory(INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_kitchen_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seal_production_batch(UUID, TEXT[], INTEGER, input_mode_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_batch_qr_server(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_receipt(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_batch_spoiled(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ompreng_ready_for_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_production_batch(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ompreng_return(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_menu_item(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_school(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_kitchen_inventory(INTEGER) TO authenticated;

-- Ensure view obeys caller RLS
ALTER VIEW IF EXISTS public.v_kitchen_impact_metrics SET (security_invoker = true);
