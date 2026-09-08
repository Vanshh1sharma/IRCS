export type Program = {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  impact: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  slug: string;
  status: string;
  image: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  program_id: string | null;
  image_url: string | null;
  registration_enabled: boolean;
  created_at: string;
  updated_at: string;
  slug: string;
  chapter_id: string | null;
  image: string | null;
  registration_required: boolean;
  status: string;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  image_url: string | null;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  slug: string;
  image: string | null;
  author: string | null;
  status: string;
};
