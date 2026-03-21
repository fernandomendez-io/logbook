-- Airport cache: stores FA /airports/{id} data to avoid repeated API calls.
-- Used for timezone resolution at sequence/flight import time.

CREATE TABLE airports (
  airport_code TEXT PRIMARY KEY,   -- ICAO (FA's primary key for this endpoint)
  code_icao    TEXT,
  code_iata    TEXT,
  code_lid     TEXT,
  name         TEXT,
  type         TEXT,
  elevation    INTEGER,
  city         TEXT,
  state        TEXT,
  country_code TEXT,
  longitude    NUMERIC(10, 6),
  latitude     NUMERIC(10, 6),
  timezone     TEXT,               -- IANA e.g. "America/Chicago"
  wiki_url     TEXT,
  fetched_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read airport reference data
CREATE POLICY "airports_read"   ON airports FOR SELECT USING (auth.role() = 'authenticated');
-- Any authenticated user can insert/update airports (shared reference data, no PII)
CREATE POLICY "airports_insert" ON airports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "airports_update" ON airports FOR UPDATE USING (auth.role() = 'authenticated');
