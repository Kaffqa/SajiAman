-- ============================================================================
-- SajiAman MBG — Database Initialization Migration
-- Version: 001_sajiaman_init.sql
-- Description: Core Schema, Server-Side Anti-Tampering RPCs, RLS, Storage & Realtime
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES (Idempotent creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('kitchen', 'school', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'input_mode_type') THEN
    CREATE TYPE input_mode_type AS ENUM ('manual', 'ai_photo');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ompreng_lifecycle_status') THEN
    CREATE TYPE ompreng_lifecycle_status AS ENUM ('in_transit', 'received_school', 'returned_sterilized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_category_type') THEN
    CREATE TYPE waste_category_type AS ENUM ('post_meal_leftover', 'surplus_intact', 'expired_red');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maggot_pickup_status') THEN
    CREATE TYPE maggot_pickup_status AS ENUM ('ready_for_pickup', 'partner_assigned', 'picked_up');
  END IF;
END $$;

-- 3. CORE TABLES

-- 3.1 Kitchens (SPPG)
CREATE TABLE IF NOT EXISTS public.kitchens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  total_ompreng_inventory INTEGER NOT NULL DEFAULT 600 CHECK (total_ompreng_inventory >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3.2 Schools (Penerima Manfaat MBG)
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npsn TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  assigned_kitchen_id UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3.3 User Profiles (Links auth.users to Kitchen or School)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  kitchen_id UUID REFERENCES public.kitchens(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chk_profile_role_assignment CHECK (
    (role = 'kitchen' AND kitchen_id IS NOT NULL) OR
    (role = 'school' AND school_id IS NOT NULL) OR
    (role = 'admin')
  )
);

-- 3.4 Menu Catalog (Master Data with Authoritative Holding Times)
CREATE TABLE IF NOT EXISTS public.menu_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('karbohidrat', 'protein', 'sayur', 'buah')),
  holding_time_minutes INTEGER NOT NULL CHECK (holding_time_minutes BETWEEN 60 AND 720),
  is_high_risk_wet BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3.5 Production Batches (Sealed Cooking Batches with Anti-Tampering Locks)
CREATE TABLE IF NOT EXISTS public.production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT UNIQUE NOT NULL,
  kitchen_id UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE RESTRICT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  input_mode input_mode_type NOT NULL,
  sample_photo_path TEXT,
  ai_nutrition_verified BOOLEAN NOT NULL DEFAULT FALSE,
  weakest_link_item_name TEXT NOT NULL,
  holding_time_minutes INTEGER NOT NULL,
  cooked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ompreng_sent_count INTEGER NOT NULL CHECK (ompreng_sent_count > 0),
  ompreng_status ompreng_lifecycle_status NOT NULL DEFAULT 'in_transit',
  ompreng_received_at TIMESTAMPTZ,
  ompreng_received_by UUID REFERENCES public.profiles(id),
  ompreng_returned_at TIMESTAMPTZ,
  ompreng_returned_by UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3.6 Batch Menu Items (Normalized Ingredients per Batch)
CREATE TABLE IF NOT EXISTS public.batch_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  menu_item_id TEXT REFERENCES public.menu_catalog(id),
  menu_item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  holding_time_minutes INTEGER NOT NULL
);

-- 3.7 Maggot Pickup Reports (Circular Zero-Waste Traceability)
CREATE TABLE IF NOT EXISTS public.maggot_pickup_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID UNIQUE NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  kitchen_id UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE RESTRICT,
  waste_category waste_category_type NOT NULL,
  volume_tier TEXT NOT NULL,
  estimated_kg NUMERIC(6,2) NOT NULL CHECK (estimated_kg > 0),
  notes TEXT,
  status maggot_pickup_status NOT NULL DEFAULT 'ready_for_pickup',
  partner_name TEXT,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ
);

-- 4. PERFORMANCE & LOOKUP INDEXES
CREATE INDEX IF NOT EXISTS idx_schools_assigned_kitchen ON public.schools(assigned_kitchen_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_batches_kitchen_id ON public.production_batches(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_batches_school_id ON public.production_batches(school_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.production_batches(ompreng_status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.production_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON public.batch_menu_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_maggot_school_id ON public.maggot_pickup_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_maggot_kitchen_id ON public.maggot_pickup_reports(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_maggot_status ON public.maggot_pickup_reports(status);

-- 5. HELPER FUNCTIONS FOR RLS & CONTEXT
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.my_kitchen_id()
RETURNS UUID AS $$
  SELECT kitchen_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. SERVER-SIDE ANTI-TAMPERING RPCs (SECURITY DEFINER)

-- 6.1 Server Time (Prevents device clock manipulation on SCR-07)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ AS $$
  SELECT timezone('utc', now());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6.2 Seal Production Batch (Weakest-Link Engine in PostgreSQL)
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
  -- 1. Verify caller has kitchen role
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya petugas Dapur SPPG terverifikasi yang dapat mencatat batch produksi.';
  END IF;

  -- 2. Verify school is assigned to this kitchen
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id AND assigned_kitchen_id = v_caller.kitchen_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Sekolah tujuan tidak terdaftar atau bukan di bawah tanggung jawab SPPG Anda.';
  END IF;

  -- 3. Validate inputs
  IF p_menu_item_ids IS NULL OR array_length(p_menu_item_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Komposisi menu wajib menyertakan minimal 1 item makanan.';
  END IF;

  IF p_ompreng_count IS NULL OR p_ompreng_count <= 0 THEN
    RAISE EXCEPTION 'Jumlah ompreng harus lebih besar dari 0.';
  END IF;

  IF p_input_mode = 'ai_photo' AND (p_sample_photo_path IS NULL OR length(trim(p_sample_photo_path)) = 0) THEN
    RAISE EXCEPTION 'Mode verifikasi foto AI mewajibkan path foto sampel yang valid.';
  END IF;

  -- 4. ANTI-TAMPERING: Query true holding time and trigger item from catalog
  SELECT holding_time_minutes, name
  INTO v_min_minutes, v_trigger_item_name
  FROM public.menu_catalog
  WHERE id = ANY(p_menu_item_ids) AND is_active = TRUE
  ORDER BY holding_time_minutes ASC, is_high_risk_wet DESC
  LIMIT 1;

  IF v_min_minutes IS NULL THEN
    RAISE EXCEPTION 'Menu yang dipilih tidak ditemukan dalam katalog resmi MBG.';
  END IF;

  -- 5. Lock server timestamps
  v_cooked_at := timezone('utc', now());
  v_expires_at := v_cooked_at + make_interval(mins => v_min_minutes);

  -- 6. Generate human-readable batch code: MBG-DDMM-XXXX
  v_batch_code := 'MBG-' ||
                  to_char(v_cooked_at AT TIME ZONE 'Asia/Jakarta', 'DDMM') ||
                  '-' ||
                  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  -- 7. Insert production batch
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
    v_caller.id
  )
  RETURNING id INTO v_batch_id;

  -- 8. Insert snapshot of menu items
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

  -- 9. Return newly created batch with relations as JSONB
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

-- 6.3 Confirm Ompreng Receipt by School
CREATE OR REPLACE FUNCTION public.confirm_ompreng_receipt(p_batch_id UUID)
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
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'school' OR v_caller.school_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya koordinator sekolah yang dapat mengonfirmasi penerimaan boks.';
  END IF;

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch tidak ditemukan.';
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Boks ini dialokasikan untuk sekolah lain.';
  END IF;

  IF v_batch.ompreng_status != 'in_transit' THEN
    RAISE EXCEPTION 'Status ompreng saat ini (%) tidak dalam pengiriman.', v_batch.ompreng_status;
  END IF;

  UPDATE public.production_batches
  SET
    ompreng_status = 'received_school',
    ompreng_received_at = v_now,
    ompreng_received_by = v_caller.id
  WHERE id = p_batch_id;

  RETURN json_build_object(
    'batch_id', p_batch_id,
    'ompreng_status', 'received_school',
    'ompreng_received_at', v_now,
    'ompreng_received_by', v_caller.id
  )::jsonb;
END;
$$;

-- 6.4 Confirm Ompreng Return & Sterilization by Kitchen
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
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Dapur SPPG yang dapat memverifikasi pengembalian & sterilisasi ompreng.';
  END IF;

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch tidak ditemukan.';
  END IF;

  IF v_batch.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Batch ini bukan milik SPPG Anda.';
  END IF;

  IF v_batch.ompreng_status != 'received_school' THEN
    RAISE EXCEPTION 'Ompreng belum berstatus diterima sekolah (saat ini: %).', v_batch.ompreng_status;
  END IF;

  UPDATE public.production_batches
  SET
    ompreng_status = 'returned_sterilized',
    ompreng_returned_at = v_now,
    ompreng_returned_by = v_caller.id
  WHERE id = p_batch_id;

  RETURN json_build_object(
    'batch_id', p_batch_id,
    'ompreng_status', 'returned_sterilized',
    'ompreng_returned_at', v_now,
    'ompreng_returned_by', v_caller.id
  )::jsonb;
END;
$$;

-- 6.5 Submit Maggot Waste Report (15-Second Circular Economy Flow)
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
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'school' OR v_caller.school_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya pihak sekolah yang dapat membuat laporan sisa makanan.';
  END IF;

  SELECT * INTO v_batch FROM public.production_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch makanan tidak ditemukan.';
  END IF;

  IF v_batch.school_id != v_caller.school_id THEN
    RAISE EXCEPTION 'Batch ini bukan milik sekolah Anda.';
  END IF;

  IF p_estimated_kg <= 0 THEN
    RAISE EXCEPTION 'Estimasi berat sisa makanan harus lebih besar dari 0 kg.';
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
    p_volume_tier,
    p_estimated_kg,
    p_notes,
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

-- 6.6 Assign Maggot Partner to Pickup Report
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
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Dapur SPPG yang dapat menugaskan mitra maggot.';
  END IF;

  SELECT * INTO v_report FROM public.maggot_pickup_reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Laporan maggot tidak ditemukan.';
  END IF;

  IF v_report.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Laporan ini berada di luar wilayah SPPG Anda.';
  END IF;

  UPDATE public.maggot_pickup_reports
  SET
    status = 'partner_assigned',
    partner_name = COALESCE(p_partner_name, 'Mitra BSF Maggot Jaya'),
    assigned_at = v_now
  WHERE id = p_report_id;

  RETURN json_build_object(
    'report_id', p_report_id,
    'status', 'partner_assigned',
    'partner_name', COALESCE(p_partner_name, 'Mitra BSF Maggot Jaya'),
    'assigned_at', v_now
  )::jsonb;
END;
$$;

-- 6.7 Complete Maggot Pickup
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
  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role != 'kitchen' OR v_caller.kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Dapur SPPG yang dapat menyelesaikan status jemput maggot.';
  END IF;

  SELECT * INTO v_report FROM public.maggot_pickup_reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Laporan maggot tidak ditemukan.';
  END IF;

  IF v_report.kitchen_id != v_caller.kitchen_id THEN
    RAISE EXCEPTION 'Laporan ini berada di luar wilayah SPPG Anda.';
  END IF;

  UPDATE public.maggot_pickup_reports
  SET
    status = 'picked_up',
    picked_up_at = v_now
  WHERE id = p_report_id;

  RETURN json_build_object(
    'report_id', p_report_id,
    'status', 'picked_up',
    'picked_up_at', v_now
  )::jsonb;
END;
$$;

-- 7. REAL-TIME IMPACT AGGREGATION VIEW
CREATE OR REPLACE VIEW public.v_kitchen_impact_metrics AS
SELECT
  k.id AS kitchen_id,
  k.code AS kitchen_code,
  k.name AS kitchen_name,
  k.total_ompreng_inventory,
  COALESCE(
    (SELECT SUM(b.ompreng_sent_count)
     FROM public.production_batches b
     WHERE b.kitchen_id = k.id AND b.ompreng_status = 'returned_sterilized'),
    0
  )::BIGINT AS total_plastics_prevented,
  COALESCE(
    (SELECT SUM(r.estimated_kg)
     FROM public.maggot_pickup_reports r
     WHERE r.kitchen_id = k.id),
    0
  )::NUMERIC(10,2) AS total_organic_kg_diverted,
  COALESCE(
    (SELECT COUNT(*)
     FROM public.production_batches b
     WHERE b.kitchen_id = k.id AND b.ompreng_status != 'returned_sterilized'),
    0
  )::BIGINT AS active_batches_count,
  COALESCE(
    (SELECT SUM(b.ompreng_sent_count)
     FROM public.production_batches b
     WHERE b.kitchen_id = k.id AND b.ompreng_status = 'received_school'),
    0
  )::BIGINT AS ompreng_at_schools_count,
  COALESCE(
    (SELECT COUNT(*)
     FROM public.maggot_pickup_reports r
     WHERE r.kitchen_id = k.id AND r.status != 'picked_up'),
    0
  )::BIGINT AS pending_maggot_pickups_count
FROM public.kitchens k;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all 7 tables
ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maggot_pickup_reports ENABLE ROW LEVEL SECURITY;

-- 8.1 Menu Catalog: Readable by all authenticated users
CREATE POLICY "menu_catalog_readable_by_authenticated"
  ON public.menu_catalog FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- 8.2 Kitchens: Readable by authenticated users associated with the kitchen
CREATE POLICY "kitchens_readable_by_associated_users"
  ON public.kitchens FOR SELECT
  TO authenticated
  USING (
    id = public.my_kitchen_id() OR
    id IN (SELECT assigned_kitchen_id FROM public.schools WHERE id = public.my_school_id())
  );

-- 8.3 Schools: Readable by school users and assigned kitchen users
CREATE POLICY "schools_readable_by_authorized_users"
  ON public.schools FOR SELECT
  TO authenticated
  USING (
    id = public.my_school_id() OR
    assigned_kitchen_id = public.my_kitchen_id()
  );

-- 8.4 Profiles: Users can view their own profile and counterpart profiles
CREATE POLICY "profiles_view_own_or_colleague"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    (kitchen_id IS NOT NULL AND kitchen_id = public.my_kitchen_id()) OR
    (school_id IS NOT NULL AND school_id = public.my_school_id())
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 8.5 Production Batches: Select allowed for kitchen owner and target school
CREATE POLICY "batches_select_policy"
  ON public.production_batches FOR SELECT
  TO authenticated
  USING (
    kitchen_id = public.my_kitchen_id() OR
    school_id = public.my_school_id()
  );

-- Direct client INSERT/UPDATE/DELETE blocked: all mutations must execute through verified RPCs
-- (No INSERT, UPDATE, DELETE policies granted to 'authenticated' directly)

-- 8.6 Batch Menu Items: Select allowed when parent batch is viewable
CREATE POLICY "batch_items_select_policy"
  ON public.batch_menu_items FOR SELECT
  TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM public.production_batches
      WHERE kitchen_id = public.my_kitchen_id() OR school_id = public.my_school_id()
    )
  );

-- 8.7 Maggot Pickup Reports: Select allowed for school owner and assigned kitchen
CREATE POLICY "maggot_reports_select_policy"
  ON public.maggot_pickup_reports FOR SELECT
  TO authenticated
  USING (
    school_id = public.my_school_id() OR
    kitchen_id = public.my_kitchen_id()
  );

-- 9. PRIVATE STORAGE BUCKET & POLICIES ('sample-photos')
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sample-photos',
  'sample-photos',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png']::text[];

-- Storage Object Policies
-- Kitchen upload into {kitchen_id}/*
CREATE POLICY "kitchen_upload_sample_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sample-photos' AND
    (storage.foldername(name))[1] = public.my_kitchen_id()::text
  );

-- Kitchen & School download/view via signed URL
CREATE POLICY "kitchen_and_school_read_sample_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sample-photos' AND (
      (storage.foldername(name))[1] = public.my_kitchen_id()::text OR
      (storage.foldername(name))[1] IN (
        SELECT assigned_kitchen_id::text FROM public.schools WHERE id = public.my_school_id()
      )
    )
  );

-- 10. REALTIME CONFIGURATION
-- Ensure supabase_realtime publication includes production_batches and maggot_pickup_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'production_batches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.production_batches;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'maggot_pickup_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maggot_pickup_reports;
  END IF;
END $$;
