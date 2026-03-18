-- Pilot Logbook - Initial Schema
-- Run via: supabase db reset  OR  supabase migration up

-- ─────────────────────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_number   VARCHAR(10) UNIQUE NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'pilot' CHECK (role IN ('pilot', 'admin')),
  base              TEXT,
  seat              TEXT CHECK (seat IN ('CA', 'FO')),
  hire_date         DATE,
  is_active         BOOLEAN DEFAULT true,
  operating_carrier TEXT,         -- carrier key, e.g. "YV_AA" (Mesa for American Eagle)
  flight_prefix     VARCHAR(3),   -- IATA prefix for flight lookups, e.g. "AA"
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- AIRCRAFT
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aircraft (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tail_number   TEXT UNIQUE NOT NULL,
  aircraft_type TEXT NOT NULL CHECK (aircraft_type IN ('E170', 'E175')),
  airline_code  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- SEQUENCES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id        UUID NOT NULL REFERENCES public.profiles(id),
  sequence_number TEXT NOT NULL,
  raw_text        TEXT NOT NULL,
  report_date     DATE NOT NULL,
  release_date    DATE NOT NULL,
  domicile        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'dropped', 'traded', 'reassigned')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pilot_id, sequence_number, report_date)
);

-- ─────────────────────────────────────────────────────────
-- DUTY PERIODS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.duty_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  pilot_id            UUID NOT NULL REFERENCES public.profiles(id),
  duty_start_utc      TIMESTAMPTZ NOT NULL,
  duty_end_utc        TIMESTAMPTZ,
  rest_before_hrs     NUMERIC(5,2),
  max_flight_time_hrs NUMERIC(5,2),
  is_augmented        BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- FLIGHTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  duty_period_id      UUID REFERENCES public.duty_periods(id) ON DELETE SET NULL,
  pilot_id            UUID NOT NULL REFERENCES public.profiles(id),
  copilot_id          UUID REFERENCES public.profiles(id),
  aircraft_id         UUID REFERENCES public.aircraft(id),

  flight_number       TEXT NOT NULL,
  origin_icao         TEXT NOT NULL,
  destination_icao    TEXT NOT NULL,
  diverted_to_icao    TEXT,

  scheduled_out_utc   TIMESTAMPTZ NOT NULL,
  scheduled_in_utc    TIMESTAMPTZ NOT NULL,
  actual_out_utc      TIMESTAMPTZ,
  actual_off_utc      TIMESTAMPTZ,
  actual_on_utc       TIMESTAMPTZ,
  actual_in_utc       TIMESTAMPTZ,

  block_scheduled_hrs NUMERIC(5,2),
  block_actual_hrs    NUMERIC(5,2),
  flight_time_hrs     NUMERIC(5,2),
  night_time_hrs      NUMERIC(5,2),
  cross_country       BOOLEAN DEFAULT true,

  pilot_flying        TEXT CHECK (pilot_flying IN ('CA', 'FO', 'unknown')),
  pilot_monitoring    TEXT CHECK (pilot_monitoring IN ('CA', 'FO', 'unknown')),

  aircraft_type       TEXT CHECK (aircraft_type IN ('E170', 'E175')),
  tail_number         TEXT,

  approach_type       TEXT CHECK (approach_type IN (
                        'visual', 'ILS', 'RNAV', 'RNP', 'VOR', 'NDB', 'LOC', 'other'
                      )),
  approach_runway     TEXT,
  landing_pilot       TEXT CHECK (landing_pilot IN ('CA', 'FO')),

  metar_raw           TEXT,
  ceiling_ft          INT,
  visibility_sm       NUMERIC(4,1),
  weather_conditions  JSONB,

  is_deadhead         BOOLEAN DEFAULT false,
  is_positioning      BOOLEAN DEFAULT false,
  is_cancelled        BOOLEAN DEFAULT false,
  cancellation_code   TEXT,

  had_diversion       BOOLEAN DEFAULT false,
  had_go_around       BOOLEAN DEFAULT false,
  had_return_to_gate  BOOLEAN DEFAULT false,
  rtg_reason          TEXT,

  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- PAY RECORDS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pay_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id            UUID NOT NULL REFERENCES public.profiles(id),
  sequence_id         UUID REFERENCES public.sequences(id),
  flight_id           UUID REFERENCES public.flights(id),
  pay_period_start    DATE NOT NULL,
  pay_period_end      DATE NOT NULL,
  scheduled_block_hrs NUMERIC(6,2) DEFAULT 0,
  actual_block_hrs    NUMERIC(6,2) DEFAULT 0,
  credit_hrs          NUMERIC(6,2) DEFAULT 0,
  guarantee_hrs       NUMERIC(6,2) DEFAULT 0,
  misconnect_hrs      NUMERIC(6,2) DEFAULT 0,
  overtime_hrs        NUMERIC(6,2) DEFAULT 0,
  pay_type            TEXT NOT NULL CHECK (pay_type IN (
                        'block', 'guarantee', 'misconnect', 'deadhead', 'training', 'other'
                      )),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- FAR 117 RECORDS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.far117_records (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id               UUID NOT NULL REFERENCES public.profiles(id),
  duty_period_id         UUID REFERENCES public.duty_periods(id),
  record_date            DATE NOT NULL,
  flight_time_28d_hrs    NUMERIC(6,2),
  flight_time_365d_hrs   NUMERIC(6,2),
  flight_time_cal_yr_hrs NUMERIC(6,2),
  duty_time_7d_hrs       NUMERIC(6,2),
  rest_waiver_used       BOOLEAN DEFAULT false,
  split_duty_used        BOOLEAN DEFAULT false,
  acclimation_status     TEXT CHECK (acclimation_status IN ('unknown', 'acclimated', 'not_acclimated')),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- SEQUENCE EVENTS (changes, RTG, diversions, etc.)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sequence_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  flight_id     UUID REFERENCES public.flights(id),
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'reassignment', 'change', 'cancellation',
                  'diversion', 'return_to_gate', 'delay', 'deadhead_add'
                )),
  occurred_at   TIMESTAMPTZ,
  description   TEXT,
  original_data JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- CACHES (ACARS + METAR)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acars_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number TEXT NOT NULL,
  flight_date   DATE NOT NULL,
  origin_icao   TEXT NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  out_utc       TIMESTAMPTZ,
  off_utc       TIMESTAMPTZ,
  on_utc        TIMESTAMPTZ,
  in_utc        TIMESTAMPTZ,
  raw_response  JSONB,
  UNIQUE (flight_number, flight_date, origin_icao)
);

CREATE TABLE IF NOT EXISTS public.metar_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_icao    TEXT NOT NULL,
  observation_utc TIMESTAMPTZ NOT NULL,
  raw_metar       TEXT NOT NULL,
  parsed          JSONB,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (station_icao, observation_utc)
);

-- ─────────────────────────────────────────────────────────
-- INVITATIONS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by      UUID REFERENCES public.profiles(id),
  email           TEXT NOT NULL UNIQUE,
  employee_number TEXT UNIQUE,
  role            TEXT DEFAULT 'pilot',
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_flights_pilot_id         ON public.flights(pilot_id);
CREATE INDEX IF NOT EXISTS idx_flights_scheduled_out    ON public.flights(scheduled_out_utc DESC);
CREATE INDEX IF NOT EXISTS idx_flights_sequence_id      ON public.flights(sequence_id);
CREATE INDEX IF NOT EXISTS idx_duty_periods_pilot_id    ON public.duty_periods(pilot_id);
CREATE INDEX IF NOT EXISTS idx_duty_periods_start       ON public.duty_periods(duty_start_utc DESC);
CREATE INDEX IF NOT EXISTS idx_pay_records_pilot_period ON public.pay_records(pilot_id, pay_period_start);
CREATE INDEX IF NOT EXISTS idx_far117_pilot_date        ON public.far117_records(pilot_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_acars_cache_lookup       ON public.acars_cache(flight_number, flight_date);
CREATE INDEX IF NOT EXISTS idx_metar_cache_lookup       ON public.metar_cache(station_icao, observation_utc DESC);
CREATE INDEX IF NOT EXISTS idx_sequences_pilot_id       ON public.sequences(pilot_id);
