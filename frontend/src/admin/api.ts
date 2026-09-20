export type AdminRole = "admin" | "super_admin";
export type AdminContext = { id: string; email: string; role: AdminRole };

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:5000";

function csrfToken(): string {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("ircs_admin_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET") headers.set("X-CSRF-Token", decodeURIComponent(csrfToken()));
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers, credentials: "include" });
  let payload: ApiEnvelope<T>;
  try { payload = await response.json() as ApiEnvelope<T>; } catch { throw new Error("The admin service returned an invalid response."); }
  if (!payload.success || !response.ok) {
    if (response.status === 401) throw new Error("AUTHENTICATION_REQUIRED");
    throw new Error(payload.success ? "The admin service returned an invalid response." : payload.error?.message ?? "The admin request failed.");
  }
  return payload.data;
}

export function login(email: string, password: string) { return adminRequest<AdminContext>("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
export function logout() { return adminRequest<{ loggedOut: boolean }>("/api/admin/logout", { method: "POST" }); }
export function getMe() { return adminRequest<AdminContext>("/api/admin/me"); }
export function getSummary() { return adminRequest<Record<string, number>>("/api/admin/summary"); }
export function getResource(path: string) { return adminRequest<{ items: Record<string, unknown>[]; pagination: { returned: number } }>(path); }
export function patchResource(path: string, data: Record<string, unknown>) { return adminRequest<Record<string, unknown>>(path, { method: "PATCH", body: JSON.stringify(data) }); }
