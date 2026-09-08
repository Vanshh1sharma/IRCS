import type { EventItem, NewsItem, Program } from "../types";

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
export function submitVolunteer(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitMember(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitContact(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitEmergency(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function findBlood(_group: string, _city: string): never { throw new ApiNotConfiguredError(); }
export function createDonation(_data: unknown): never { throw new ApiNotConfiguredError(); }
