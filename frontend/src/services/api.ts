const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:5000";

export type ApiResponse<T> = { success: boolean; data: T };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const payload = (await response.json()) as ApiResponse<T> & { message?: string };
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "The request could not be completed.");
  }
  return payload.data;
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

export function getPrograms(): never { throw new ApiNotConfiguredError(); }
export function getProgram(_id: string): never { throw new ApiNotConfiguredError(); }
export function getEvents(): never { throw new ApiNotConfiguredError(); }
export function getEvent(_id: string): never { throw new ApiNotConfiguredError(); }
export function getNews(): never { throw new ApiNotConfiguredError(); }
export function getNewsArticle(_id: string): never { throw new ApiNotConfiguredError(); }
export function submitVolunteer(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitMember(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitContact(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function submitEmergency(_data: unknown): never { throw new ApiNotConfiguredError(); }
export function findBlood(_group: string, _city: string): never { throw new ApiNotConfiguredError(); }
export function createDonation(_data: unknown): never { throw new ApiNotConfiguredError(); }
