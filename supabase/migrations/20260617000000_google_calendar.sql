-- Google Calendar integration
-- Single-tenant: one row with a fixed id

CREATE TABLE IF NOT EXISTS google_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token  text        NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- Column to store the GCal event id on each audiencia
ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS google_event_id text;
