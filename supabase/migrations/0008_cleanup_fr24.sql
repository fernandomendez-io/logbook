-- Migration: Remove FR24-specific columns
-- FlightAware (fa_flight_id, fa_track) has fully replaced FR24 as the tracking source.
-- fr24_flight_id and fr24_raw are no longer written to; airspace_transitions is no
-- longer populated (not available from FlightAware AeroAPI).

-- ── flights table ─────────────────────────────────────────────────────────────
ALTER TABLE public.flights
  DROP COLUMN IF EXISTS fr24_flight_id,
  DROP COLUMN IF EXISTS fr24_raw,
  DROP COLUMN IF EXISTS airspace_transitions;

-- ── acars_cache table ──────────────────────────────────────────────────────────
ALTER TABLE public.acars_cache
  DROP COLUMN IF EXISTS fr24_flight_id;
