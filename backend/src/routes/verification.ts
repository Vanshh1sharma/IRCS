import type { ServerResponse } from "node:http";
import { requirePool } from "../db/database.js";
import { hashVerificationToken, isVerificationTokenFormatValid } from "../services/verification.js";
import { sendError, sendSuccess } from "../utils/response.js";

export async function handleEmailVerification(response: ServerResponse, token: string | null): Promise<void> {
  if (!token || !isVerificationTokenFormatValid(token)) {
    sendError(response, 400, "Invalid or expired verification link.", "VERIFICATION_INVALID");
    return;
  }

  try {
    const database = requirePool();
    const tokenHash = hashVerificationToken(token);
    const result = await database.query(
      "SELECT 'members' AS table_name, id FROM members WHERE email_verification_token_hash = $1 AND email_verified_at IS NULL AND email_verification_expires_at > now() UNION ALL SELECT 'volunteers' AS table_name, id FROM volunteers WHERE email_verification_token_hash = $1 AND email_verified_at IS NULL AND email_verification_expires_at > now()",
      [tokenHash],
    );

    if (result.rows.length === 0) {
      const used = await database.query(
        "SELECT 1 FROM members WHERE email_verification_token_hash = $1 AND email_verified_at IS NOT NULL UNION ALL SELECT 1 FROM volunteers WHERE email_verification_token_hash = $1 AND email_verified_at IS NOT NULL",
        [tokenHash],
      );
      if (used.rowCount) {
        sendError(response, 400, "This email address has already been verified.", "VERIFICATION_USED");
        return;
      }
      sendError(response, 400, "That verification link has expired. Please request a new verification email.", "VERIFICATION_EXPIRED");
      return;
    }

    const record = result.rows[0] as { table_name: "members" | "volunteers"; id: string };
    if (record.table_name === "members") {
      await database.query("UPDATE members SET email_verified_at = now(), email_verification_expires_at = NULL WHERE id = $1", [record.id]);
    } else {
      await database.query("UPDATE volunteers SET email_verified_at = now(), email_verification_expires_at = NULL WHERE id = $1", [record.id]);
    }
    sendSuccess(response, { message: "Your email address has been verified." });
  } catch {
    sendError(response, 500, "Internal server error");
  }
}
