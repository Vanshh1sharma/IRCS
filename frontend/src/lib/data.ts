import type { EventItem, NewsItem, Program } from "../types";

const communityImage = "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80";

export const programs: Program[] = [
  {
    id: "blood-donation",
    title: "Blood Donation",
    category: "Health access",
    description: "Student-led blood donation awareness and collection initiatives, prepared for coordination with authorised partners.",
    impact: "Placeholder impact figures will be added after verified programme reporting.",
    activities: ["Donor awareness drives", "Blood group education", "Partner coordination"],
    image: communityImage,
  },
  {
    id: "disaster-relief",
    title: "Disaster Relief",
    category: "Preparedness",
    description: "Community preparedness and relief support shaped around verified local needs and trained guidance.",
    impact: "Programme outcomes will be published after official records are available.",
    activities: ["Preparedness sessions", "Relief kit planning", "Community outreach"],
    image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "health-first-aid",
    title: "Health & First Aid",
    category: "Wellbeing",
    description: "Practical first-aid awareness and health education for the campus and surrounding community.",
    impact: "Verified participation and training numbers are pending.",
    activities: ["First-aid awareness", "Health education", "Safety demonstrations"],
    image: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "community-welfare",
    title: "Community Welfare",
    category: "Community",
    description: "Small, practical acts of service that connect student volunteers with community priorities.",
    impact: "Impact reporting will be added as initiatives are formally documented.",
    activities: ["Needs listening", "Service days", "Resource awareness"],
    image: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "youth-activities",
    title: "Youth Activities",
    category: "Student leadership",
    description: "A welcoming pathway for students to learn, serve and build dependable community leadership habits.",
    impact: "Volunteer participation figures are intentionally left as placeholders.",
    activities: ["Student orientation", "Peer learning", "Volunteer opportunities"],
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
  },
];

export const events: EventItem[] = [
  { id: "first-aid-session", title: "First Aid Awareness Session", description: "Placeholder event details awaiting official programme confirmation.", date: "Date to be announced", location: "NIET campus, location to be confirmed", program: "Health & First Aid" },
  { id: "blood-awareness", title: "Blood Donation Awareness Drive", description: "An upcoming awareness activity prepared for partner and campus coordination.", date: "Date to be announced", location: "NIET campus, location to be confirmed", program: "Blood Donation" },
  { id: "student-orientation", title: "Student Volunteer Orientation", description: "Meet the initiative, understand volunteering pathways and ask practical questions.", date: "Date to be announced", location: "NIET campus, location to be confirmed", program: "Youth Activities" },
];

export const news: NewsItem[] = [
  { id: "launch-note", title: "Building a culture of service at NIET", summary: "This space will carry verified updates from the initiative and its student volunteers.", publishedDate: "Publication date to be announced" },
  { id: "programme-updates", title: "Programme updates will appear here", summary: "Official activity reports and community stories will be shared after review.", publishedDate: "Publication date to be announced" },
];
