BEGIN;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash text,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash text,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS volunteers_active_email_unique
  ON volunteers (lower(btrim(email)))
  WHERE status IN ('pending', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS members_active_email_unique
  ON members (lower(btrim(email)))
  WHERE status IN ('pending', 'approved');

COMMIT;
