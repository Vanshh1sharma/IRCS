import type { ServerResponse } from "node:http";
import { pool } from "../db/database.js";
import { sendSuccess } from "../utils/response.js";

export async function handleHealth(response: ServerResponse): Promise<void> {
  if (!pool) {
    sendSuccess(response, { status: "ok" });
    return;
  }

  try {
    await pool.query("SELECT 1");
    sendSuccess(response, { status: "ok", database: "connected" });
  } catch {
    sendSuccess(response, { status: "ok", database: "disconnected" });
  }
}
