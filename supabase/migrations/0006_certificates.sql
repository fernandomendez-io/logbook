-- Certificate & medical tracking
-- Run this in Supabase SQL editor or via `supabase db push`

-- Add date_of_birth to profiles (needed for medical expiry calculation)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cert_type    TEXT NOT NULL CHECK (cert_type IN (
                 'medical_1st','medical_2nd','medical_3rd',
                 'type_rating','bfr','other'
               )),
  cert_name    TEXT NOT NULL,
  issued_date  DATE,
  expires_date DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS certificates_pilot_id_idx ON certificates(pilot_id);

-- RLS
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots can view own certificates"
  ON certificates FOR SELECT
  USING (pilot_id = auth.uid());

CREATE POLICY "Pilots can insert own certificates"
  ON certificates FOR INSERT
  WITH CHECK (pilot_id = auth.uid());

CREATE POLICY "Pilots can update own certificates"
  ON certificates FOR UPDATE
  USING (pilot_id = auth.uid());

CREATE POLICY "Pilots can delete own certificates"
  ON certificates FOR DELETE
  USING (pilot_id = auth.uid());

-- updated_at trigger (reuse existing function if present)
CREATE OR REPLACE TRIGGER set_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
