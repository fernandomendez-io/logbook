-- Functions and Triggers

-- ─── updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'aircraft', 'sequences', 'duty_periods',
    'flights', 'pay_records', 'far117_records'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- ─── Auto-create profile on signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, employee_number, role, seat, base)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'employee_number', SUBSTRING(NEW.id::text, 1, 10)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'pilot'),
    NEW.raw_user_meta_data->>'seat',
    NEW.raw_user_meta_data->>'base'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── FAR 117 rolling window calculator ───────────────────
CREATE OR REPLACE FUNCTION public.compute_far117(
  p_pilot_id UUID,
  p_as_of    TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  flight_time_28d_hrs  NUMERIC,
  flight_time_365d_hrs NUMERIC,
  duty_time_7d_hrs     NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(
      CASE WHEN f.actual_off_utc >= p_as_of - INTERVAL '28 days'
           THEN f.flight_time_hrs END
    ), 0) AS flight_time_28d_hrs,

    COALESCE(SUM(
      CASE WHEN f.actual_off_utc >= p_as_of - INTERVAL '365 days'
           THEN f.flight_time_hrs END
    ), 0) AS flight_time_365d_hrs,

    COALESCE(SUM(
      CASE WHEN d.duty_start_utc >= p_as_of - INTERVAL '7 days'
           THEN EXTRACT(EPOCH FROM (
             COALESCE(d.duty_end_utc, p_as_of) - d.duty_start_utc
           )) / 3600 END
    ), 0) AS duty_time_7d_hrs

  FROM public.flights f
  LEFT JOIN public.duty_periods d ON f.duty_period_id = d.id
  WHERE f.pilot_id = p_pilot_id
    AND f.is_cancelled = false;
$$;

-- ─── Pay period summary ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_pay_period(
  p_pilot_id   UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  total_scheduled_hrs NUMERIC,
  total_actual_hrs    NUMERIC,
  total_credit_hrs    NUMERIC,
  deadhead_hrs        NUMERIC,
  flight_count        BIGINT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(f.block_scheduled_hrs), 0),
    COALESCE(SUM(f.block_actual_hrs), 0),
    COALESCE(SUM(GREATEST(f.block_scheduled_hrs, COALESCE(f.block_actual_hrs, 0))), 0),
    COALESCE(SUM(CASE WHEN f.is_deadhead THEN f.block_scheduled_hrs ELSE 0 END), 0),
    COUNT(*)
  FROM public.flights f
  WHERE f.pilot_id = p_pilot_id
    AND f.scheduled_out_utc::date BETWEEN p_start_date AND p_end_date
    AND f.is_cancelled = false;
$$;
