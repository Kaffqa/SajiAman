-- ============================================================================
-- SajiAman MBG — Database Seed File
-- Version: seed.sql
-- Description: Authentic Indonesian MBG master data & 1-Tap Demo Auth Setup
-- ============================================================================

-- 1. SEED KITCHEN (SPPG Semarang Tengah 01)
INSERT INTO public.kitchens (id, code, name, address, total_ompreng_inventory)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'SPPG-SMG-01',
  'SPPG Semarang Tengah',
  'Jl. Pemuda No. 142, Semarang Tengah, Kota Semarang',
  600
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  total_ompreng_inventory = EXCLUDED.total_ompreng_inventory;

-- 2. SEED SCHOOLS (Penerima Manfaat MBG Binaan SPPG)
INSERT INTO public.schools (id, npsn, name, address, assigned_kitchen_id)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    '20328901',
    'SDN 01 Pendrikan',
    'Jl. Imam Bonjol No. 88, Semarang',
    'a0000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'b0000000-0000-0000-0000-000000000002'::uuid,
    '20328902',
    'SMPN 03 Semarang',
    'Jl. Mayjend Sutoyo No. 12, Semarang',
    'a0000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'b0000000-0000-0000-0000-000000000003'::uuid,
    '20328903',
    'SDN 04 Miroto',
    'Jl. Pandanaran No. 55, Semarang',
    'a0000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'b0000000-0000-0000-0000-000000000004'::uuid,
    '20328904',
    'MI Al-Hikmah',
    'Jl. Pahlawan No. 20, Semarang',
    'a0000000-0000-0000-0000-000000000001'::uuid
  )
ON CONFLICT (id) DO UPDATE SET
  npsn = EXCLUDED.npsn,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  assigned_kitchen_id = EXCLUDED.assigned_kitchen_id;

-- 3. SEED MENU CATALOG (15 Menu Resmi MBG dengan Batas Aman Holding Time)
INSERT INTO public.menu_catalog (id, name, category, holding_time_minutes, is_high_risk_wet, is_active)
VALUES
  -- Karbohidrat
  ('nasi-putih', 'Nasi Putih', 'karbohidrat', 270, FALSE, TRUE),
  ('nasi-uduk-santan', 'Nasi Uduk Santan', 'karbohidrat', 210, TRUE, TRUE),
  ('kentang-rebus', 'Kentang Rebus', 'karbohidrat', 270, FALSE, TRUE),

  -- Protein
  ('ayam-goreng', 'Ayam Goreng Kering', 'protein', 300, FALSE, TRUE),
  ('telur-balado', 'Telur Balado', 'protein', 270, FALSE, TRUE),
  ('gulai-ayam-santan', 'Gulai Ayam Santan', 'protein', 210, TRUE, TRUE),
  ('ikan-kuah-kuning', 'Ikan Kuah Kuning', 'protein', 210, TRUE, TRUE),
  ('tempe-orek', 'Tempe Orek Kering', 'protein', 300, FALSE, TRUE),

  -- Sayur
  ('tumis-buncis', 'Tumis Buncis Kering', 'sayur', 270, FALSE, TRUE),
  ('capcay-kuah', 'Capcay Kuah', 'sayur', 240, FALSE, TRUE),
  ('sayur-lodeh', 'Sayur Lodeh Santan', 'sayur', 210, TRUE, TRUE),
  ('sop-wortel-bakso', 'Sop Wortel Bakso', 'sayur', 210, TRUE, TRUE),

  -- Buah
  ('pisang-ambon', 'Pisang Ambon', 'buah', 360, FALSE, TRUE),
  ('jeruk-medan', 'Jeruk Medan', 'buah', 360, FALSE, TRUE),
  ('potongan-melon', 'Potongan Melon', 'buah', 210, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  holding_time_minutes = EXCLUDED.holding_time_minutes,
  is_high_risk_wet = EXCLUDED.is_high_risk_wet,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- 4. DEMO AUTH USERS & PROFILES SETUP
-- Creates demo accounts for Chef Dapur and Koordinator Sekolah:
--   - Dapur:   chef.hendra@sajiaman.id   / SajiAmanDemo2026!
--   - Sekolah: busari.sdn01@sajiaman.id  / SajiAmanDemo2026!
-- ============================================================================

DO $$
DECLARE
  v_kitchen_user_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_school_user_id UUID  := 'c0000000-0000-0000-0000-000000000002'::uuid;
  v_encrypted_pw TEXT;
BEGIN
  -- Hash password using pgcrypto extension
  v_encrypted_pw := crypt('SajiAmanDemo2026!', gen_salt('bf'));

  -- 4.1 Insert / Update Kitchen Demo User in auth.users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
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
      v_kitchen_user_id,
      'authenticated',
      'authenticated',
      'chef.hendra@sajiaman.id',
      v_encrypted_pw,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Chef Hendra Setiawan","role":"kitchen"}'::jsonb,
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

    -- Link into public.profiles
    INSERT INTO public.profiles (
      id,
      role,
      full_name,
      kitchen_id,
      school_id
    ) VALUES (
      v_kitchen_user_id,
      'kitchen',
      'Chef Hendra Setiawan',
      'a0000000-0000-0000-0000-000000000001'::uuid,
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'kitchen',
      full_name = EXCLUDED.full_name,
      kitchen_id = EXCLUDED.kitchen_id;

    -- 4.2 Insert / Update School Demo User in auth.users
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
      v_school_user_id,
      'authenticated',
      'authenticated',
      'busari.sdn01@sajiaman.id',
      v_encrypted_pw,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Bu Sari Rahayu","role":"school"}'::jsonb,
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

    -- Link into public.profiles
    INSERT INTO public.profiles (
      id,
      role,
      full_name,
      kitchen_id,
      school_id
    ) VALUES (
      v_school_user_id,
      'school',
      'Bu Sari Rahayu',
      NULL,
      'b0000000-0000-0000-0000-000000000001'::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'school',
      full_name = EXCLUDED.full_name,
      school_id = EXCLUDED.school_id;

  END IF;
END $$;
