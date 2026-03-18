-- Migration: FR24 rich flight data fields
-- Run in Supabase SQL Editor for the live DB, or via: supabase migration up

-- ── flights: FR24 metadata ────────────────────────────────────────────────────
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS fr24_flight_id       TEXT,
  ADD COLUMN IF NOT EXISTS departure_gate        TEXT,
  ADD COLUMN IF NOT EXISTS arrival_gate          TEXT,
  ADD COLUMN IF NOT EXISTS departure_runway      TEXT,
  ADD COLUMN IF NOT EXISTS cruise_gspeed_kts     INTEGER,
  ADD COLUMN IF NOT EXISTS cruise_alt_ft         INTEGER,
  ADD COLUMN IF NOT EXISTS descent_start_utc     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS airspace_transitions  JSONB,
  ADD COLUMN IF NOT EXISTS fr24_raw              JSONB;

-- ── acars_cache: store full FR24 payload so we never re-fetch ─────────────────
ALTER TABLE public.acars_cache
  ADD COLUMN IF NOT EXISTS fr24_flight_id        TEXT,
  ADD COLUMN IF NOT EXISTS tail_number           TEXT,
  ADD COLUMN IF NOT EXISTS aircraft_type         TEXT,
  ADD COLUMN IF NOT EXISTS origin_iata           TEXT,
  ADD COLUMN IF NOT EXISTS dest_iata             TEXT,
  ADD COLUMN IF NOT EXISTS departure_gate        TEXT,
  ADD COLUMN IF NOT EXISTS arrival_gate          TEXT,
  ADD COLUMN IF NOT EXISTS departure_runway      TEXT,
  ADD COLUMN IF NOT EXISTS landing_runway        TEXT,
  ADD COLUMN IF NOT EXISTS cruise_gspeed_kts     INTEGER,
  ADD COLUMN IF NOT EXISTS cruise_alt_ft         INTEGER,
  ADD COLUMN IF NOT EXISTS descent_start_utc     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS airspace_transitions  JSONB;
