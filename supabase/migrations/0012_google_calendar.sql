-- Google Calendar OAuth credentials per user
CREATE TABLE google_credentials (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_at     TIMESTAMPTZ NOT NULL,
  calendar_id   TEXT NOT NULL DEFAULT 'primary',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only access their own credentials
CREATE POLICY "gc_own" ON google_credentials USING (auth.uid() = user_id);

-- Track exported Google Calendar event IDs to enable updates (not duplicates)
ALTER TABLE flights ADD COLUMN IF NOT EXISTS google_event_id TEXT;
