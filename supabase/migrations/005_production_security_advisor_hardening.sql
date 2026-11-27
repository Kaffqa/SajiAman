-- ============================================================================
-- SajiAman MBG — Migration 005: Comprehensive Security Advisor Hardening
-- Description:
--   1. Resolves CRITICAL Security Definer View on public.v_kitchen_impact_metrics
--      by setting security_invoker = true.
--   2. Optimizes Auth RLS query plans on public.profiles using (SELECT auth.uid())
--      and adds indexes for foreign keys.
--   3. Sets immutable search_path = public on all functions to eliminate
--      "Function Search Path Mutable" warnings.
--   4. Revokes public execution on sensitive SECURITY DEFINER RPCs and grants
--      access strictly to 'authenticated' (and 'anon' only where required).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CRITICAL: SET SECURITY_INVOKER ON VIEWS
-- ----------------------------------------------------------------------------
ALTER VIEW IF EXISTS public.v_kitchen_impact_metrics SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 2. AUTH RLS QUERY PLAN OPTIMIZATION ON PROFILES
-- ----------------------------------------------------------------------------
-- Use (SELECT auth.uid()) scalar subquery for single-evaluation execution plan
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by members" ON public.profiles;

CREATE POLICY "Profiles readable by members"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- Foreign key indexes to speed up RLS evaluation joins
CREATE INDEX IF NOT EXISTS idx_profiles_kitchen_id ON public.profiles(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_kitchen_id ON public.production_batches(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_school_id ON public.production_batches(school_id);

-- ----------------------------------------------------------------------------
-- 3. FIX FUNCTION SEARCH PATH MUTABLE (SET search_path = public)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT timezone('utc', now());
$$;

-- ----------------------------------------------------------------------------
-- 4. RESTRICT EXECUTION ON SECURITY DEFINER FUNCTIONS
--    (Eliminates "Public Can Execute SECURITY DEFINER Function" warnings)
-- ----------------------------------------------------------------------------

-- Revoke execute from PUBLIC on all security definer functions
REVOKE EXECUTE ON FUNCTION public.get_server_time() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_kitchen_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_id() FROM PUBLIC;

-- Grant access cleanly:
-- Time & registration need anon for login/registration flow
GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_kitchen_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_school_id() TO authenticated;

-- Hardening seal_production_batch
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seal_production_batch') THEN
    REVOKE EXECUTE ON FUNCTION public.seal_production_batch FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.seal_production_batch TO authenticated;
    ALTER FUNCTION public.seal_production_batch SET search_path = public;
  END IF;
END $$;

-- Hardening confirm_ompreng_receipt
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_ompreng_receipt') THEN
    REVOKE EXECUTE ON FUNCTION public.confirm_ompreng_receipt FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.confirm_ompreng_receipt TO authenticated;
    ALTER FUNCTION public.confirm_ompreng_receipt SET search_path = public;
  END IF;
END $$;

-- Hardening reject_batch_spoiled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reject_batch_spoiled') THEN
    REVOKE EXECUTE ON FUNCTION public.reject_batch_spoiled FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.reject_batch_spoiled TO authenticated;
    ALTER FUNCTION public.reject_batch_spoiled SET search_path = public;
  END IF;
END $$;

-- Hardening void_production_batch
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'void_production_batch') THEN
    REVOKE EXECUTE ON FUNCTION public.void_production_batch FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.void_production_batch TO authenticated;
    ALTER FUNCTION public.void_production_batch SET search_path = public;
  END IF;
END $$;

-- Hardening mark_ompreng_ready_for_pickup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_ompreng_ready_for_pickup') THEN
    REVOKE EXECUTE ON FUNCTION public.mark_ompreng_ready_for_pickup FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.mark_ompreng_ready_for_pickup TO authenticated;
    ALTER FUNCTION public.mark_ompreng_ready_for_pickup SET search_path = public;
  END IF;
END $$;

-- Hardening confirm_ompreng_return
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_ompreng_return') THEN
    REVOKE EXECUTE ON FUNCTION public.confirm_ompreng_return FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.confirm_ompreng_return TO authenticated;
    ALTER FUNCTION public.confirm_ompreng_return SET search_path = public;
  END IF;
END $$;

-- Hardening maggot circular functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_maggot_partner') THEN
    REVOKE EXECUTE ON FUNCTION public.assign_maggot_partner FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.assign_maggot_partner TO authenticated;
    ALTER FUNCTION public.assign_maggot_partner SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_maggot_pickup') THEN
    REVOKE EXECUTE ON FUNCTION public.complete_maggot_pickup FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.complete_maggot_pickup TO authenticated;
    ALTER FUNCTION public.complete_maggot_pickup SET search_path = public;
  END IF;
END $$;
