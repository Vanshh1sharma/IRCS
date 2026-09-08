import type { ServerResponse } from "node:http";
import { requirePool } from "../db/database.js";
import { sendError, sendSuccess } from "../utils/response.js";

const PUBLISHED = "published";

function decodeSlug(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export async function handlePublicRoute(response: ServerResponse, segments: string[]): Promise<boolean> {
  const [resource, rawSlug] = segments;
  if (!resource || segments.length > 2 || (segments.length === 2 && !rawSlug)) {
    return false;
  }

  const slug = rawSlug === undefined ? undefined : decodeSlug(rawSlug);
  if (slug === null) {
    sendError(response, 400, "Malformed URL encoding", "BAD_REQUEST");
    return true;
  }

  if (resource !== "programs" && resource !== "events" && resource !== "news") {
    return false;
  }

  let result;
  try {
    const database = requirePool();
    if (resource === "programs") {
      result = slug === undefined
        ? await database.query("SELECT * FROM programs WHERE status = $1 ORDER BY created_at DESC", [PUBLISHED])
        : await database.query("SELECT * FROM programs WHERE status = $1 AND slug = $2", [PUBLISHED, slug]);
    } else if (resource === "events") {
      result = slug === undefined
        ? await database.query(
            "SELECT * FROM events WHERE status = $1 ORDER BY CASE WHEN event_date >= now() THEN 0 ELSE 1 END, CASE WHEN event_date >= now() THEN event_date END ASC NULLS LAST, CASE WHEN event_date < now() THEN event_date END DESC NULLS LAST",
            [PUBLISHED],
          )
        : await database.query("SELECT * FROM events WHERE status = $1 AND slug = $2", [PUBLISHED, slug]);
    } else if (resource === "news") {
      result = slug === undefined
        ? await database.query("SELECT * FROM news WHERE status = $1 ORDER BY published_at DESC, created_at DESC", [PUBLISHED])
        : await database.query("SELECT * FROM news WHERE status = $1 AND slug = $2", [PUBLISHED, slug]);
    } else {
      return false;
    }
  } catch {
    sendError(response, 500, "Internal server error");
    return true;
  }

  if (slug !== undefined && result.rows.length === 0) {
    sendError(response, 404, "Resource not found", "NOT_FOUND");
    return true;
  }

  sendSuccess(response, slug === undefined ? result.rows : result.rows[0]);
  return true;
}