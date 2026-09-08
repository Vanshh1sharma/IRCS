import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHealth } from "./health.js";
import { handlePublicRoute } from "./public.js";
import { handleSubmission } from "./submissions.js";
import { sendError, sendSuccess } from "../utils/response.js";

export async function routeRequest(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  if (request.method === "GET" && pathname === "/api/healthz") {
    await handleHealth(response);
    return;
  }

  if (request.method === "GET" && pathname === "/api") {
    sendSuccess(response, { name: "Indian Red Cross Society - NIET API" });
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
    if (await handlePublicRoute(response, segments)) return;
  }

  sendError(response, 404, "Route not found");
}
