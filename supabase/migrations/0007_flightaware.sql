-- Migration: FlightAware AeroAPI fields
-- Replaces FR24 as tracking data source.
-- Keeps fr24_flight_id and fr24_raw for backward compatibility with existing cached data.

-- ── flights: FlightAware metadata ─────────────────────────────────────────────
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS fa_flight_id  TEXT,
  ADD COLUMN IF NOT EXISTS fa_track      JSONB;

-- ── acars_cache: store FlightAware track payload ──────────────────────────────
ALTER TABLE public.acars_cache
  ADD COLUMN IF NOT EXISTS fa_flight_id  TEXT,
  ADD COLUMN IF NOT EXISTS fa_track      JSONB;
