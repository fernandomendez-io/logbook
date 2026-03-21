-- Extended FlightAware AeroAPI fields: timezones, filed route data, terminal/baggage info.
-- Timezones come directly from origin.timezone / destination.timezone in FA response,
-- eliminating the need for the static airport-timezones.ts lookup.

-- ── acars_cache ───────────────────────────────────────────────────────────────
ALTER TABLE public.acars_cache
  ADD COLUMN IF NOT EXISTS origin_timezone       TEXT,
  ADD COLUMN IF NOT EXISTS dest_timezone         TEXT,
  ADD COLUMN IF NOT EXISTS origin_icao_fa        TEXT,
  ADD COLUMN IF NOT EXISTS dest_icao_fa          TEXT,
  ADD COLUMN IF NOT EXISTS route                 TEXT,
  ADD COLUMN IF NOT EXISTS route_distance_nm     INTEGER,
  ADD COLUMN IF NOT EXISTS filed_airspeed_kts    INTEGER,
  ADD COLUMN IF NOT EXISTS filed_altitude_ft     INTEGER,
  ADD COLUMN IF NOT EXISTS terminal_origin       TEXT,
  ADD COLUMN IF NOT EXISTS terminal_destination  TEXT,
  ADD COLUMN IF NOT EXISTS baggage_claim         TEXT,
  ADD COLUMN IF NOT EXISTS departure_delay_sec   INTEGER,
  ADD COLUMN IF NOT EXISTS arrival_delay_sec     INTEGER;

-- ── flights ───────────────────────────────────────────────────────────────────
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS origin_timezone       TEXT,
  ADD COLUMN IF NOT EXISTS dest_timezone         TEXT,
  ADD COLUMN IF NOT EXISTS route                 TEXT,
  ADD COLUMN IF NOT EXISTS route_distance_nm     INTEGER,
  ADD COLUMN IF NOT EXISTS filed_airspeed_kts    INTEGER,
  ADD COLUMN IF NOT EXISTS filed_altitude_ft     INTEGER,
  ADD COLUMN IF NOT EXISTS terminal_origin       TEXT,
  ADD COLUMN IF NOT EXISTS terminal_destination  TEXT,
  ADD COLUMN IF NOT EXISTS baggage_claim         TEXT;
