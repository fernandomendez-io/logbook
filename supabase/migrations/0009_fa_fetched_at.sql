-- Track when FlightAware data was last pulled for a flight.
-- Used to show a "data fetched" indicator and gate re-fetch to admins only.
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS fa_fetched_at TIMESTAMPTZ;
