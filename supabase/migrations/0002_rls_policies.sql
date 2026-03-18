-- Row Level Security Policies

-- ─── Admin helper (SECURITY DEFINER avoids recursive RLS) ─
-- Without this, policies that check profiles.role=admin would
-- trigger RLS on profiles itself, causing a silent failure loop.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── PROFILES ────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_see_own_profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "pilots_see_others_for_lookup"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pilots_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "admins_manage_profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- ─── SEQUENCES ───────────────────────────────────────────
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_own_sequences"
  ON public.sequences FOR ALL
  USING (auth.uid() = pilot_id);

CREATE POLICY "admins_all_sequences"
  ON public.sequences FOR ALL
  USING (public.is_admin());

-- ─── DUTY PERIODS ────────────────────────────────────────
ALTER TABLE public.duty_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_own_duty_periods"
  ON public.duty_periods FOR ALL
  USING (auth.uid() = pilot_id);

CREATE POLICY "admins_all_duty_periods"
  ON public.duty_periods FOR ALL
  USING (public.is_admin());

-- ─── FLIGHTS ─────────────────────────────────────────────
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_own_flights"
  ON public.flights FOR ALL
  USING (auth.uid() = pilot_id OR auth.uid() = copilot_id);

CREATE POLICY "admins_all_flights"
  ON public.flights FOR ALL
  USING (public.is_admin());

-- ─── PAY RECORDS ─────────────────────────────────────────
ALTER TABLE public.pay_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_own_pay_records"
  ON public.pay_records FOR ALL
  USING (auth.uid() = pilot_id);

CREATE POLICY "admins_all_pay_records"
  ON public.pay_records FOR ALL
  USING (public.is_admin());

-- ─── FAR117 RECORDS ──────────────────────────────────────
ALTER TABLE public.far117_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilots_own_far117"
  ON public.far117_records FOR ALL
  USING (auth.uid() = pilot_id);

CREATE POLICY "admins_all_far117"
  ON public.far117_records FOR ALL
  USING (public.is_admin());

-- ─── SEQUENCE EVENTS ─────────────────────────────────────
ALTER TABLE public.sequence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_events_via_sequence"
  ON public.sequence_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sequences s
      WHERE s.id = sequence_id AND s.pilot_id = auth.uid()
    )
    OR public.is_admin()
  );

-- ─── CACHES (read by any authenticated user) ─────────────
ALTER TABLE public.acars_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_acars_cache"
  ON public.acars_cache FOR SELECT TO authenticated USING (true);

ALTER TABLE public.metar_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_metar_cache"
  ON public.metar_cache FOR SELECT TO authenticated USING (true);

-- ─── INVITATIONS ─────────────────────────────────────────
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_invitations"
  ON public.invitations FOR ALL
  USING (public.is_admin());

CREATE POLICY "public_read_invite_by_token"
  ON public.invitations FOR SELECT
  USING (true);  -- token validation happens in server code

-- ─── AIRCRAFT ────────────────────────────────────────────
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_aircraft"
  ON public.aircraft FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_manage_aircraft"
  ON public.aircraft FOR ALL
  USING (public.is_admin());
