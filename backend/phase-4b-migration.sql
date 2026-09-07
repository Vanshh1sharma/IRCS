BEGIN;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
UPDATE chapters SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status IS NULL;
ALTER TABLE chapters ALTER COLUMN status SET NOT NULL;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS chapter_id uuid,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE volunteers ALTER COLUMN city SET NOT NULL;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS chapter_id uuid,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS membership_number text;
ALTER TABLE members ALTER COLUMN city SET NOT NULL;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS image text;
UPDATE programs SET category = 'youth_activities' WHERE category = 'youth';
UPDATE programs SET slug = regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(id::text, 8) WHERE slug IS NULL;
UPDATE programs SET status = CASE WHEN is_active = true THEN 'published' ELSE 'archived' END;
UPDATE programs SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL;
ALTER TABLE programs ALTER COLUMN slug SET NOT NULL, ALTER COLUMN status SET NOT NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS chapter_id uuid,
  ADD COLUMN IF NOT EXISTS image text,
  ADD COLUMN IF NOT EXISTS registration_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
UPDATE events SET slug = regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(id::text, 8) WHERE slug IS NULL;
UPDATE events SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL;
UPDATE events SET registration_required = registration_enabled WHERE registration_required IS NULL;
ALTER TABLE events ALTER COLUMN slug SET NOT NULL, ALTER COLUMN status SET NOT NULL, ALTER COLUMN description SET NOT NULL, ALTER COLUMN registration_required SET NOT NULL;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS image text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
UPDATE news SET slug = regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(id::text, 8) WHERE slug IS NULL;
UPDATE news SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL;
UPDATE news SET status = CASE WHEN is_published = true THEN 'published' ELSE 'draft' END;
ALTER TABLE news ALTER COLUMN slug SET NOT NULL, ALTER COLUMN status SET NOT NULL, ALTER COLUMN summary SET NOT NULL;

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE donations SET payment_reference = transaction_id WHERE payment_reference IS NULL AND transaction_id IS NOT NULL;
ALTER TABLE donations ALTER COLUMN currency SET NOT NULL, ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE contact_messages ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE emergencies ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'high';
UPDATE emergencies SET status = 'open' WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_group text NOT NULL,
  city text NOT NULL,
  hospital text NOT NULL,
  hospital_location text,
  units_required smallint NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  urgency text NOT NULL DEFAULT 'high',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blood_requests_units_check CHECK (units_required > 0),
  CONSTRAINT blood_requests_blood_group_check CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  CONSTRAINT blood_requests_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT blood_requests_status_check CHECK (status IN ('open', 'matched', 'fulfilled', 'cancelled', 'expired'))
);

ALTER TABLE chapters
  DROP CONSTRAINT IF EXISTS chapters_status_check,
  DROP CONSTRAINT IF EXISTS chapters_name_nonempty,
  DROP CONSTRAINT IF EXISTS chapters_city_nonempty,
  ADD CONSTRAINT chapters_status_check CHECK (status IN ('active', 'inactive', 'archived')),
  ADD CONSTRAINT chapters_name_nonempty CHECK (btrim(name) <> ''),
  ADD CONSTRAINT chapters_city_nonempty CHECK (btrim(city) <> '');

ALTER TABLE volunteers
  DROP CONSTRAINT IF EXISTS volunteers_status_check,
  DROP CONSTRAINT IF EXISTS volunteers_blood_group_check,
  DROP CONSTRAINT IF EXISTS volunteers_full_name_nonempty,
  DROP CONSTRAINT IF EXISTS volunteers_email_check,
  ADD CONSTRAINT volunteers_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  ADD CONSTRAINT volunteers_blood_group_check CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  ADD CONSTRAINT volunteers_full_name_nonempty CHECK (btrim(full_name) <> ''),
  ADD CONSTRAINT volunteers_email_check CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_status_check,
  DROP CONSTRAINT IF EXISTS members_membership_type_check,
  DROP CONSTRAINT IF EXISTS members_blood_group_check,
  DROP CONSTRAINT IF EXISTS members_full_name_nonempty,
  DROP CONSTRAINT IF EXISTS members_email_check,
  ADD CONSTRAINT members_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  ADD CONSTRAINT members_membership_type_check CHECK (membership_type IN ('student', 'general', 'supporting')),
  ADD CONSTRAINT members_blood_group_check CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  ADD CONSTRAINT members_full_name_nonempty CHECK (btrim(full_name) <> ''),
  ADD CONSTRAINT members_email_check CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_status_check,
  DROP CONSTRAINT IF EXISTS programs_category_check,
  DROP CONSTRAINT IF EXISTS programs_slug_check,
  DROP CONSTRAINT IF EXISTS programs_title_nonempty,
  ADD CONSTRAINT programs_status_check CHECK (status IN ('draft', 'published', 'archived')),
  ADD CONSTRAINT programs_category_check CHECK (category IN ('blood_donation', 'disaster_relief', 'health_first_aid', 'community_welfare', 'youth_activities')),
  ADD CONSTRAINT programs_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT programs_title_nonempty CHECK (btrim(title) <> '');

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_status_check,
  DROP CONSTRAINT IF EXISTS events_slug_check,
  DROP CONSTRAINT IF EXISTS events_title_nonempty,
  ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'archived')),
  ADD CONSTRAINT events_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT events_title_nonempty CHECK (btrim(title) <> '');

ALTER TABLE news
  DROP CONSTRAINT IF EXISTS news_status_check,
  DROP CONSTRAINT IF EXISTS news_slug_check,
  DROP CONSTRAINT IF EXISTS news_title_nonempty,
  DROP CONSTRAINT IF EXISTS news_published_at_check,
  ADD CONSTRAINT news_status_check CHECK (status IN ('draft', 'published', 'archived')),
  ADD CONSTRAINT news_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT news_title_nonempty CHECK (btrim(title) <> ''),
  ADD CONSTRAINT news_published_at_check CHECK (status <> 'published' OR published_at IS NOT NULL);

ALTER TABLE donations
  DROP CONSTRAINT IF EXISTS donations_frequency_check,
  DROP CONSTRAINT IF EXISTS donations_payment_status_check,
  DROP CONSTRAINT IF EXISTS donations_amount_check,
  ADD CONSTRAINT donations_frequency_check CHECK (frequency IN ('one_time', 'monthly')),
  ADD CONSTRAINT donations_payment_status_check CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  ADD CONSTRAINT donations_amount_check CHECK (amount > 0);

ALTER TABLE contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_status_check,
  ALTER COLUMN status SET DEFAULT 'new',
  ADD CONSTRAINT contact_messages_status_check CHECK (status IN ('new', 'in_progress', 'resolved', 'spam'));

ALTER TABLE emergencies
  DROP CONSTRAINT IF EXISTS emergencies_urgency_check,
  DROP CONSTRAINT IF EXISTS emergencies_status_check,
  ALTER COLUMN status SET DEFAULT 'open',
  ADD CONSTRAINT emergencies_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  ADD CONSTRAINT emergencies_status_check CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed'));

ALTER TABLE volunteers ADD CONSTRAINT volunteers_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;
ALTER TABLE members ADD CONSTRAINT members_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_program_id_fkey,
  ADD CONSTRAINT events_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  ADD CONSTRAINT events_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS programs_slug_unique ON programs(slug);
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique ON events(slug);
CREATE UNIQUE INDEX IF NOT EXISTS news_slug_unique ON news(slug);
CREATE UNIQUE INDEX IF NOT EXISTS members_membership_number_unique ON members(membership_number) WHERE membership_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_reference_unique ON donations(payment_provider, payment_reference) WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS volunteers_status_created_at_idx ON volunteers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS members_status_created_at_idx ON members(status, created_at DESC);
CREATE INDEX IF NOT EXISTS members_membership_type_idx ON members(membership_type);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_status_event_date_idx ON events(status, event_date);
CREATE INDEX IF NOT EXISTS events_program_id_idx ON events(program_id);
CREATE INDEX IF NOT EXISTS events_chapter_id_idx ON events(chapter_id);
CREATE INDEX IF NOT EXISTS programs_status_category_idx ON programs(status, category);
CREATE INDEX IF NOT EXISTS news_status_published_at_idx ON news(status, published_at DESC);
CREATE INDEX IF NOT EXISTS donations_payment_status_created_at_idx ON donations(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_created_at_idx ON contact_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS emergencies_status_urgency_created_at_idx ON emergencies(status, urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS blood_requests_status_blood_group_city_idx ON blood_requests(status, blood_group, city);
CREATE INDEX IF NOT EXISTS chapters_status_city_idx ON chapters(status, city);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['chapters','volunteers','members','programs','events','news','donations','contact_messages','emergencies','blood_requests']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name);
  END LOOP;
END;
$$;

COMMIT;
