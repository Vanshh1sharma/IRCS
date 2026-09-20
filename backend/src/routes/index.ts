import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHealth } from "./health.js";
import { handlePublicRoute } from "./public.js";
import { handleSubmission } from "./submissions.js";
import { handleEmailVerification } from "./verification.js";
import { handleAdminRoute } from "./admin.js";
import { sendError, sendSuccess } from "../utils/response.js";

function hasMalformedQueryEncoding(rawSearch: string): boolean {
  return rawSearch.slice(1).split("&").some((part) => {
    const [rawKey, rawValue = ""] = part.split("=", 2);
    try {
      decodeURIComponent(rawKey.replace(/\+/g, " "));
      decodeURIComponent(rawValue.replace(/\+/g, " "));
      return false;
    } catch {
      return true;
    }
  });
}

export async function routeRequest(request: IncomingMessage, response: ServerResponse, pathname: string, searchParams = new URLSearchParams(), rawSearch = ""): Promise<void> {
  if (request.method === "GET" && hasMalformedQueryEncoding(rawSearch)) {
    sendError(response, 400, "Malformed URL encoding", "BAD_REQUEST");
    return;
  }

  if (request.method === "GET" && pathname === "/api/healthz") {
    await handleHealth(response);
    return;
  }

  if (pathname.startsWith("/api/admin")) {
    if (await handleAdminRoute(request, response, pathname)) return;
  }

  if (request.method === "GET" && pathname === "/api") {
    sendSuccess(response, { name: "Indian Red Cross Society - NIET API" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/verify-email") {
    await handleEmailVerification(response, searchParams.get("token"));
    return;
  }

  if (request.method === "POST" && pathname.startsWith("/api/")) {
    const resource = pathname.slice("/api/".length);
    if (["volunteers", "members", "contact", "emergencies", "blood-requests", "donations"].includes(resource)) {
      await handleSubmission(request, response, resource);
      return;
    }
  }

  if (request.method === "GET" && pathname.startsWith("/api/")) {
    const segments = pathname.slice("/api/".length).split("/");
    if (await handlePublicRoute(response, segments, searchParams)) return;
  }

  sendError(response, 404, "Route not found");
}
