import type { EventItem, NewsItem, Program } from "../types";

export type VolunteerSubmission = {
  full_name: string;
  email: string;
  phone: string;
  volunteer_area: "blood_donation" | "community_outreach" | "awareness_campaigns" | "event_support" | "coordination_logistics" | "digital_technical" | "media_documentation";
  skills?: string;
  availability?: string;
  message?: string;
  blood_group?: string;
  city: string;
  college: string;
};
export type MemberSubmission = { full_name: string; email: string; phone: string; membership_type: "student" | "general" | "supporting"; contribution_area: "blood_donation" | "community_outreach" | "awareness_campaigns" | "event_support" | "digital_technical" | "media_documentation" | "general_support"; message?: string; blood_group?: string; city: string; college?: string };
export type ContactSubmission = { name: string; email: string; phone?: string; subject: string; message: string };
export type EmergencySubmission = { name: string; phone: string; location: string; emergency_type: "medical" | "blood_requirement" | "disaster" | "accident" | "other"; description: string; urgency?: "low" | "medium" | "high" | "critical" };
export type BloodRequestSubmission = { blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown"; city: string; hospital: string; hospital_location?: string; units_required: number; contact_name: string; contact_phone: string; urgency?: "low" | "medium" | "high" | "critical" };
export type DonationSubmission = { donor_name: string; email: string; phone?: string; amount: number; frequency: "one_time" | "monthly"; purpose: "general_support" | "blood_donation" | "disaster_relief" | "health_camps" };
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type BloodAvailability = { id: string; blood_group: BloodGroup; city: string; units_available: number; status: "available" | "limited" | "unavailable"; last_updated: string };
export type SubmissionResult = { id: string; emailVerification?: { status: "sent" | "not_configured" } };

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:5000";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error?: { message?: string } };
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error("Unable to connect to the content service.");
  }

  let payload: ApiResponse<T>;
  try {
    const candidate: unknown = await response.json();
    if (!isObject(candidate) || typeof candidate.success !== "boolean") {
      throw new Error("invalid response");
    }
    payload = candidate as ApiResponse<T>;
  } catch {
    throw new Error("The content service returned an invalid response.");
  }

  if (!payload.success) {
    throw new Error(payload.error?.message ?? "The content could not be loaded.");
  }
  if (!response.ok) throw new Error("The content could not be loaded.");
  return payload.data;
}

async function submit<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(data) });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireList<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error("The content service returned an invalid response.");
  return value as T[];
}

function requireItem<T>(value: unknown): T {
  if (!isObject(value)) throw new Error("The content service returned an invalid response.");
  return value as T;
}

export function getHealthStatus() {
  return request<{ status: string }>("/api/healthz");
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("This application action will be connected after the corresponding API route is available.");
    this.name = "ApiNotConfiguredError";
  }
}

export async function getPrograms(): Promise<Program[]> { return requireList<Program>(await request<unknown>("/api/programs")); }
export async function getProgram(slug: string): Promise<Program> { return requireItem<Program>(await request<unknown>(`/api/programs/${encodeURIComponent(slug)}`)); }
export async function getEvents(): Promise<EventItem[]> { return requireList<EventItem>(await request<unknown>("/api/events")); }
export async function getEvent(slug: string): Promise<EventItem> { return requireItem<EventItem>(await request<unknown>(`/api/events/${encodeURIComponent(slug)}`)); }
export async function getNews(): Promise<NewsItem[]> { return requireList<NewsItem>(await request<unknown>("/api/news")); }
export async function getNewsArticle(slug: string): Promise<NewsItem> { return requireItem<NewsItem>(await request<unknown>(`/api/news/${encodeURIComponent(slug)}`)); }
export function submitVolunteer(data: VolunteerSubmission): Promise<SubmissionResult> { return submit("/api/volunteers", data); }
export function submitMember(data: MemberSubmission): Promise<SubmissionResult> { return submit("/api/members", data); }
export function submitContact(data: ContactSubmission): Promise<SubmissionResult> { return submit("/api/contact", data); }
export function submitEmergency(data: EmergencySubmission): Promise<SubmissionResult> { return submit("/api/emergencies", data); }
export function submitBloodRequest(data: BloodRequestSubmission): Promise<SubmissionResult> { return submit("/api/blood-requests", data); }
export function findBlood(group: string, city: string): Promise<BloodAvailability[]> {
  const params = new URLSearchParams();
  const normalizedGroup = group.trim();
  const normalizedCity = city.trim();
  if (normalizedGroup) params.set("blood_group", normalizedGroup);
  if (normalizedCity) params.set("city", normalizedCity);
  const query = params.toString();
  return request<unknown>(`/api/blood-availability${query ? `?${query}` : ""}`).then(requireList<BloodAvailability>);
}
export function createDonation(data: DonationSubmission): Promise<SubmissionResult> { return submit("/api/donations", data); }
