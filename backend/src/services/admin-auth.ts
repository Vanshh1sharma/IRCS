import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { requirePool } from "../db/database.js";
import { sendJson, type ResponseOptions } from "../utils/response.js";

export const ADMIN_ROLES = ["super_admin", "admin"] as const;
export type AdminRole = typeof ADMIN_ROLES[number];
export type AdminContext = {
  id: string;
  email: string;
  role: AdminRole;
};

const SESSION_COOKIE =
  process.env.ADMIN_SESSION_COOKIE_NAME?.trim() ||
  "ircs_admin_session";

const CSRF_COOKIE = "ircs_admin_csrf";

const SESSION_TTL_SECONDS = Number(
  process.env.ADMIN_SESSION_TTL_SECONDS ?? 8 * 60 * 60,
);

const LOCKOUT_SECONDS = Number(
  process.env.ADMIN_LOGIN_LOCKOUT_SECONDS ?? 15 * 60,
);

const MAX_FAILED_LOGINS = Number(
  process.env.ADMIN_LOGIN_RATE_LIMIT ?? 5,
);

const failedByIp = new Map<
  string,
  { count: number; resetAt: number }
>();

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_COOKIE_SECURE === "true"
  );
}

export function allowedAdminOrigins(): string[] {
  return (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function requestOrigin(
  request: IncomingMessage,
): string | null {
  return typeof request.headers.origin === "string"
    ? request.headers.origin
    : null;
}

export function isAllowedOrigin(
  request: IncomingMessage,
): boolean {
  const origin = requestOrigin(request);

  return (
    !origin ||
    allowedAdminOrigins().includes(origin)
  );
}

export function adminResponseOptions(
  request: IncomingMessage,
): ResponseOptions {
  const origin = requestOrigin(request);

  return {
    corsOrigin:
      origin &&
      allowedAdminOrigins().includes(origin)
        ? origin
        : "null",
    credentials: true,
  };
}

export function sendAdminJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  sendJson(
    response,
    statusCode,
    body,
    adminResponseOptions(request),
  );
}

export function sendAdminError(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  message: string,
  code: string,
): void {
  sendAdminJson(
    request,
    response,
    statusCode,
    {
      success: false,
      error: {
        code,
        message,
      },
    },
  );
}

function parseCookies(
  request: IncomingMessage,
): Record<string, string> {
  const header = request.headers.cookie;

  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("=", 2))
      .filter(
        ([name, value]) =>
          Boolean(name) && Boolean(value),
      )
      .map(([name, value]) => [
        name,
        decodeURIComponent(value),
      ]),
  );
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

/**
 * Build an admin cookie.
 *
 * Session cookie:
 *   Path=/api/admin
 *   HttpOnly
 *
 * CSRF cookie:
 *   Path=/
 *   readable by frontend JavaScript
 */
function cookieHeader(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAge: number;
    path?: string;
  },
): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];

  if (options.httpOnly) {
    attributes.push("HttpOnly");
  }

  if (isProduction()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function expiredCookieHeader(
  name: string,
  httpOnly: boolean,
  path: string,
): string {
  return cookieHeader(name, "", {
    httpOnly,
    maxAge: 0,
    path,
  });
}

function setCookies(
  response: ServerResponse,
  values: string[],
): void {
  response.setHeader("Set-Cookie", values);
}

export function setAdminCookies(
  response: ServerResponse,
  sessionToken: string,
  csrfToken: string,
): void {
  setCookies(response, [
    // Keep the session cookie restricted to admin API requests.
    cookieHeader(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      maxAge: SESSION_TTL_SECONDS,
      path: "/api/admin",
    }),

    // CSRF token must be readable by frontend JavaScript.
    cookieHeader(CSRF_COOKIE, csrfToken, {
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    }),
  ]);
}

export function clearAdminCookies(
  response: ServerResponse,
): void {
  setCookies(response, [
    expiredCookieHeader(
      SESSION_COOKIE,
      true,
      "/api/admin",
    ),

    expiredCookieHeader(
      CSRF_COOKIE,
      false,
      "/",
    ),
  ]);
}

function sameToken(
  left: string,
  right: string,
): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function csrfValid(
  request: IncomingMessage,
): boolean {
  const method = request.method ?? "GET";

  if (
    ["GET", "HEAD", "OPTIONS"].includes(method)
  ) {
    return true;
  }

  if (!isAllowedOrigin(request)) {
    return false;
  }

  const csrfCookie =
    parseCookies(request)[CSRF_COOKIE];

  const csrfHeader =
    request.headers["x-csrf-token"];

  return Boolean(
    csrfCookie &&
      typeof csrfHeader === "string" &&
      sameToken(csrfCookie, csrfHeader),
  );
}

export function clientAddress(
  request: IncomingMessage,
): string {
  return request.socket.remoteAddress ?? "unknown";
}

function ipAllowed(address: string): boolean {
  const now = Date.now();

  const current = failedByIp.get(address);

  if (
    !current ||
    current.resetAt <= now
  ) {
    failedByIp.set(address, {
      count: 0,
      resetAt:
        now + LOCKOUT_SECONDS * 1000,
    });

    return true;
  }

  return current.count < MAX_FAILED_LOGINS;
}

function recordIpFailure(
  address: string,
): void {
  const now = Date.now();

  const current = failedByIp.get(address);

  if (
    !current ||
    current.resetAt <= now
  ) {
    failedByIp.set(address, {
      count: 1,
      resetAt:
        now + LOCKOUT_SECONDS * 1000,
    });
  } else {
    current.count += 1;
  }
}

export function normalizeAdminEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

export async function authenticateAdmin(
  email: string,
  password: string,
  address: string,
): Promise<{
  context: AdminContext;
  sessionToken: string;
  csrfToken: string;
} | null> {
  const database = requirePool();

  const normalizedEmail =
    normalizeAdminEmail(email);

  if (!ipAllowed(address)) {
    return null;
  }

  const result = await database.query(
    "SELECT admin_users.id, admin_users.email, admin_users.password_hash, admin_users.is_active, admin_users.failed_login_count, admin_users.locked_until, admin_roles.name AS role FROM admin_users JOIN admin_roles ON admin_roles.id = admin_users.role_id WHERE lower(btrim(admin_users.email)) = $1",
    [normalizedEmail],
  );

  const user = result.rows[0] as
    | {
        id: string;
        email: string;
        password_hash: string;
        is_active: boolean;
        failed_login_count: number;
        locked_until: Date | null;
        role: AdminRole;
      }
    | undefined;

  const now = Date.now();

  const locked =
    user?.locked_until &&
    user.locked_until.getTime() > now;

  const valid = Boolean(
    user &&
      user.is_active &&
      !locked &&
      ADMIN_ROLES.includes(user.role) &&
      (await import("./password.js").then(
        ({ verifyPassword }) =>
          verifyPassword(
            password,
            user.password_hash,
          ),
      )),
  );

  if (!valid) {
    recordIpFailure(address);

    if (user) {
      const nextCount =
        user.failed_login_count + 1;

      await database.query(
        "UPDATE admin_users SET failed_login_count = $1, locked_until = CASE WHEN $1 >= $2 THEN now() + ($3 * interval '1 second') ELSE locked_until END WHERE id = $4",
        [
          nextCount,
          MAX_FAILED_LOGINS,
          LOCKOUT_SECONDS,
          user.id,
        ],
      );
    }

    return null;
  }

  if (!user) {
    return null;
  }

  failedByIp.delete(address);

  const sessionToken =
    randomBytes(32).toString("hex");

  const csrfToken =
    randomBytes(32).toString("hex");

  await database.query(
    "UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1",
    [user.id],
  );

  await database.query(
    "INSERT INTO admin_sessions (admin_user_id, session_token_hash, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 second'))",
    [
      user.id,
      hashSessionToken(sessionToken),
      SESSION_TTL_SECONDS,
    ],
  );

  return {
    context: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    sessionToken,
    csrfToken,
  };
}

export async function getAdminContext(
  request: IncomingMessage,
): Promise<AdminContext | null> {
  const token =
    parseCookies(request)[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const database = requirePool();

  const result = await database.query(
    "SELECT admin_users.id, admin_users.email, admin_roles.name AS role FROM admin_sessions JOIN admin_users ON admin_users.id = admin_sessions.admin_user_id JOIN admin_roles ON admin_roles.id = admin_users.role_id WHERE admin_sessions.session_token_hash = $1 AND admin_sessions.revoked_at IS NULL AND admin_sessions.expires_at > now() AND admin_users.is_active = true",
    [hashSessionToken(token)],
  );

  const row = result.rows[0] as
    | {
        id: string;
        email: string;
        role: AdminRole;
      }
    | undefined;

  if (
    !row ||
    !ADMIN_ROLES.includes(row.role)
  ) {
    return null;
  }

  await database.query(
    "UPDATE admin_sessions SET last_seen_at = now() WHERE session_token_hash = $1",
    [hashSessionToken(token)],
  );

  return {
    id: row.id,
    email: row.email,
    role: row.role,
  };
}

export async function revokeAdminSession(
  request: IncomingMessage,
): Promise<void> {
  const token =
    parseCookies(request)[SESSION_COOKIE];

  if (!token) {
    return;
  }

  await requirePool().query(
    "UPDATE admin_sessions SET revoked_at = now() WHERE session_token_hash = $1",
    [hashSessionToken(token)],
  );
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}