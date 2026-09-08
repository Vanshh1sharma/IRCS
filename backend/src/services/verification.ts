import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function createVerificationToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isVerificationTokenFormatValid(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
