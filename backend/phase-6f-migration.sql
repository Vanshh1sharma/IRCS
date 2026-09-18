BEGIN;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS volunteer_area text,
  ADD CONSTRAINT volunteers_volunteer_area_check
    CHECK (volunteer_area IS NULL OR volunteer_area IN (
      'blood_donation',
      'community_outreach',
      'awareness_campaigns',
      'event_support',
      'coordination_logistics',
      'digital_technical',
      'media_documentation'
    ));

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS contribution_area text,
  ADD CONSTRAINT members_contribution_area_check
    CHECK (contribution_area IS NULL OR contribution_area IN (
      'blood_donation',
      'community_outreach',
      'awareness_campaigns',
      'event_support',
      'digital_technical',
      'media_documentation',
      'general_support'
    ));

COMMIT;
