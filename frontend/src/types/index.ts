export type Program = {
  id: string;
  title: string;
  category: string;
  description: string;
  impact: string;
  activities: string[];
  image: string;
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  program: string;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedDate: string;
};
