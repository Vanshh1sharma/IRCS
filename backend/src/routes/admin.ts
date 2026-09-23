import type { IncomingMessage, ServerResponse } from "node:http";
import busboy from "busboy";
import { requirePool } from "../db/database.js";
import { hashPassword } from "../services/password.js";
import {
  uploadContentImage,
  StorageUploadError,
} from "../services/storage.js";
import {
  ADMIN_ROLES,
  authenticateAdmin,
  clearAdminCookies,
  csrfValid,
  getAdminContext,
  isAllowedOrigin,
  normalizeAdminEmail,
  revokeAdminSession,
  sendAdminError,
  sendAdminJson,
  setAdminCookies,
  type AdminContext,
  type AdminRole,
} from "../services/admin-auth.js";
import {
  parseJsonBody,
  RequestBodyError,
} from "../utils/body.js";

const APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "inactive",
] as const;

const BLOOD_REQUEST_STATUSES = [
  "open",
  "matched",
  "fulfilled",
  "cancelled",
  "expired",
] as const;

const EMERGENCY_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "closed",
] as const;

const CONTACT_STATUSES = [
  "new",
  "in_progress",
  "resolved",
  "spam",
] as const;

const DONATION_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
] as const;

const PROGRAM_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

const EVENT_STATUSES = [
  "draft",
  "published",
  "cancelled",
  "completed",
  "archived",
] as const;

const NEWS_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

const PROGRAM_CATEGORIES = [
  "blood_donation",
  "disaster_relief",
  "health_first_aid",
  "community_welfare",
  "youth_activities",
] as const;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function bad(
  message = "Invalid request",
): never {
  throw new RequestBodyError(
    400,
    "VALIDATION_ERROR",
    message,
  );
}

function requiredString(
  data: Record<string, unknown>,
  key: string,
  max = 500,
): string {
  if (typeof data[key] !== "string") {
    bad();
  }

  const value = data[key].trim();

  if (!value || value.length > max) {
    bad();
  }

  return value;
}

function optionalString(
  data: Record<string, unknown>,
  key: string,
  max = 500,
): string | null {
  if (
    data[key] === undefined ||
    data[key] === null ||
    data[key] === ""
  ) {
    return null;
  }

  return requiredString(data, key, max);
}

function oneOf<T extends readonly string[]>(
  data: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = requiredString(
    data,
    key,
    100,
  );

  if (!values.includes(value)) {
    bad();
  }

  return value as T[number];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function pathId(
  pathname: string,
  prefix: string,
): string | null {
  const value = decodeURIComponent(
    pathname.slice(prefix.length),
  );

  return isUuid(value) ? value : null;
}

async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const value = await parseJsonBody(request);

  if (!isObject(value)) {
    bad();
  }

  return value;
}

function ensureAllowedFields(
  data: Record<string, unknown>,
  allowed: readonly string[],
): void {
  if (
    Object.keys(data).some(
      (key) => !allowed.includes(key),
    )
  ) {
    bad();
  }
}

async function audit(
  context: AdminContext,
  request: IncomingMessage,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const requestId =
    typeof request.headers["x-request-id"] ===
    "string"
      ? request.headers["x-request-id"].slice(
          0,
          100,
        )
      : null;

  await requirePool().query(
    "INSERT INTO admin_audit_logs (admin_user_id, action, resource_type, resource_id, metadata, request_id) VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
    [
      context.id,
      action,
      resourceType,
      resourceId,
      JSON.stringify(metadata),
      requestId,
    ],
  );
}

function roleAllowed(
  context: AdminContext,
  required: "admin" | "super_admin",
): boolean {
  return required === "admin"
    ? ADMIN_ROLES.includes(context.role)
    : context.role === "super_admin";
}

async function requireContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<AdminContext | null> {
  if (!isAllowedOrigin(request)) {
    sendAdminError(
      request,
      response,
      403,
      "Origin is not allowed.",
      "FORBIDDEN",
    );

    return null;
  }

  const context =
    await getAdminContext(request);

  if (!context) {
    sendAdminError(
      request,
      response,
      401,
      "Authentication required.",
      "UNAUTHENTICATED",
    );

    return null;
  }

  if (!csrfValid(request)) {
    sendAdminError(
      request,
      response,
      403,
      "CSRF validation failed.",
      "CSRF_FAILED",
    );

    return null;
  }

  return context;
}

function requireRole(
  context: AdminContext,
  request: IncomingMessage,
  response: ServerResponse,
  role: "admin" | "super_admin",
): boolean {
  if (!roleAllowed(context, role)) {
    sendAdminError(
      request,
      response,
      403,
      "You do not have permission to perform this action.",
      "FORBIDDEN",
    );

    return false;
  }

  return true;
}

function listParams(
  searchParams: URLSearchParams,
): {
  limit: number;
  offset: number;
  search: string;
} {
  const limit = Math.min(
    Math.max(
      Number(
        searchParams.get("limit") ?? 25,
      ),
      1,
    ),
    100,
  );

  const offset = Math.max(
    Number(
      searchParams.get("offset") ?? 0,
    ),
    0,
  );

  if (
    !Number.isInteger(limit) ||
    !Number.isInteger(offset)
  ) {
    bad("Invalid pagination");
  }

  return {
    limit,
    offset,
    search:
      searchParams.get("search")?.trim() ??
      "",
  };
}

async function listApplications(
  request: IncomingMessage,
  response: ServerResponse,
  table: "members" | "volunteers",
): Promise<void> {
  const {
    limit,
    offset,
    search,
  } = listParams(
    new URL(
      request.url ?? "",
      "http://localhost",
    ).searchParams,
  );

  const status =
    new URL(
      request.url ?? "",
      "http://localhost",
    ).searchParams.get("status");

  if (
    status &&
    !APPLICATION_STATUSES.includes(
      status as typeof APPLICATION_STATUSES[number],
    )
  ) {
    sendAdminError(
      request,
      response,
      400,
      "Invalid status.",
      "VALIDATION_ERROR",
    );

    return;
  }

  const fields =
    table === "members"
      ? "id, full_name, email, phone, membership_type, contribution_area, message, status, joined_at, created_at, updated_at, chapter_id, blood_group, city, college, membership_number, email_verified_at"
      : "id, full_name, email, phone, volunteer_area, skills, availability, message, status, created_at, updated_at, chapter_id, blood_group, city, college, email_verified_at";

  const values: (
    | string
    | number
  )[] = [];

  const filters: string[] = [];

  if (status) {
    values.push(status);
    filters.push(
      `status = $${values.length}`,
    );
  }

  if (search) {
    values.push(`%${search}%`);

    filters.push(
      `(full_name ILIKE $${values.length} OR email ILIKE $${values.length} OR city ILIKE $${values.length})`,
    );
  }

  const where = filters.length
    ? `WHERE ${filters.join(" AND ")}`
    : "";

  values.push(limit, offset);

  const result =
    await requirePool().query(
      `SELECT ${fields} FROM ${table} ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: {
        items: result.rows,
        pagination: {
          limit,
          offset,
          returned: result.rowCount,
        },
      },
    },
  );
}

async function patchApplication(
  request: IncomingMessage,
  response: ServerResponse,
  context: AdminContext,
  table: "members" | "volunteers",
  id: string,
): Promise<void> {
  const data = await body(request);

  ensureAllowedFields(
    data,
    ["status"],
  );

  const status = oneOf(
    data,
    "status",
    APPLICATION_STATUSES,
  );

  const result =
    await requirePool().query(
      `UPDATE ${table} SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, id],
    );

  if (!result.rowCount) {
    sendAdminError(
      request,
      response,
      404,
      "Application not found.",
      "NOT_FOUND",
    );

    return;
  }

  await audit(
    context,
    request,
    "status_changed",
    table,
    id,
    { status },
  );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: result.rows[0],
    },
  );
}

const contentConfig = {
  programs: {
    fields:
      "id, title, description, category, image_url, impact, is_active, created_at, updated_at, slug, status, image",
    table: "programs",
    statuses: PROGRAM_STATUSES,
    allowed: [
      "title",
      "description",
      "category",
      "image_url",
      "impact",
      "is_active",
      "slug",
      "status",
      "image",
    ] as const,
  },

  events: {
    fields:
      "id, title, description, event_date, location, program_id, image_url, registration_enabled, created_at, updated_at, slug, chapter_id, image, registration_required, status",
    table: "events",
    statuses: EVENT_STATUSES,
    allowed: [
      "title",
      "description",
      "event_date",
      "location",
      "program_id",
      "image_url",
      "registration_enabled",
      "slug",
      "chapter_id",
      "image",
      "registration_required",
      "status",
    ] as const,
  },

  news: {
    fields:
      "id, title, summary, content, image_url, published_at, is_published, created_at, updated_at, slug, image, author, status",
    table: "news",
    statuses: NEWS_STATUSES,
    allowed: [
      "title",
      "summary",
      "content",
      "image_url",
      "published_at",
      "is_published",
      "slug",
      "image",
      "author",
      "status",
    ] as const,
  },
} as const;

type ContentResource =
  keyof typeof contentConfig;

function contentInput(
  resource: ContentResource,
  data: Record<string, unknown>,
  partial: boolean,
): Record<string, unknown> {
  const config =
    contentConfig[resource];

  ensureAllowedFields(
    data,
    config.allowed,
  );

  const output: Record<
    string,
    unknown
  > = {};

  for (const key of config.allowed) {
    if (data[key] !== undefined) {
      output[key] = data[key];
    }
  }

  if (!partial) {
    for (
      const key of
        resource === "programs"
          ? [
              "title",
              "description",
              "category",
              "slug",
            ]
          : resource === "events"
            ? [
                "title",
                "description",
                "event_date",
                "location",
                "slug",
              ]
            : [
                "title",
                "summary",
                "content",
                "slug",
              ]
    ) {
      if (
        typeof output[key] !==
          "string" ||
        !String(output[key]).trim()
      ) {
        bad();
      }
    }
  }

  if (
    output.status !== undefined &&
    !config.statuses.includes(
      output.status as never,
    )
  ) {
    bad();
  }

  if (
    output.category !== undefined &&
    !PROGRAM_CATEGORIES.includes(
      output.category as typeof PROGRAM_CATEGORIES[number],
    )
  ) {
    bad();
  }

  if (
    output.slug !== undefined &&
    (typeof output.slug !==
      "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        output.slug,
      ))
  ) {
    bad();
  }

  if (
    output.event_date !== undefined &&
    (typeof output.event_date !==
      "string" ||
      Number.isNaN(
        Date.parse(
          output.event_date,
        ),
      ))
  ) {
    bad();
  }

  return output;
}

async function listContent(
  request: IncomingMessage,
  response: ServerResponse,
  resource: ContentResource,
): Promise<void> {
  const {
    limit,
    offset,
    search,
  } = listParams(
    new URL(
      request.url ?? "",
      "http://localhost",
    ).searchParams,
  );

  const config =
    contentConfig[resource];

  const values: (
    | string
    | number
  )[] = [];

  let filter = "";

  if (search) {
    values.push(`%${search}%`);
    filter =
      `WHERE title ILIKE $${values.length}`;
  }

  values.push(limit, offset);

  const result =
    await requirePool().query(
      `SELECT ${config.fields} FROM ${config.table} ${filter} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: {
        items: result.rows,
        pagination: {
          limit,
          offset,
          returned: result.rowCount,
        },
      },
    },
  );
}

async function mutateContent(
  request: IncomingMessage,
  response: ServerResponse,
  context: AdminContext,
  resource: ContentResource,
  id: string | null,
  method: "POST" | "PATCH" | "DELETE",
): Promise<void> {
  const config =
    contentConfig[resource];

  if (method === "DELETE") {
    if (!id) {
      sendAdminError(
        request,
        response,
        400,
        "Invalid resource ID.",
        "VALIDATION_ERROR",
      );

      return;
    }

    const result =
      await requirePool().query(
        `DELETE FROM ${config.table} WHERE id = $1 RETURNING id`,
        [id],
      );

    if (!result.rowCount) {
      sendAdminError(
        request,
        response,
        404,
        "Resource not found.",
        "NOT_FOUND",
      );

      return;
    }

    await audit(
      context,
      request,
      "deleted",
      resource,
      id,
    );

    sendAdminJson(
      request,
      response,
      200,
      {
        success: true,
        data: { id },
      },
    );

    return;
  }

  const data = contentInput(
    resource,
    await body(request),
    method === "PATCH",
  );

  const keys = Object.keys(data);

  if (!keys.length) {
    bad();
  }

  const values = keys.map(
    (key) => data[key],
  );

  let result;

  if (method === "POST") {
    const columns =
      keys.join(", ");

    const placeholders =
      keys
        .map(
          (_, index) =>
            `$${index + 1}`,
        )
        .join(", ");

    result =
      await requirePool().query(
        `INSERT INTO ${config.table} (${columns}) VALUES (${placeholders}) RETURNING ${config.fields}`,
        values,
      );

    await audit(
      context,
      request,
      "created",
      resource,
      result.rows[0].id,
      { fields: keys },
    );
  } else {
    if (!id) {
      sendAdminError(
        request,
        response,
        400,
        "Invalid resource ID.",
        "VALIDATION_ERROR",
      );

      return;
    }

    const assignments =
      keys
        .map(
          (key, index) =>
            `${key} = $${index + 1}`,
        )
        .join(", ");

    values.push(id);

    result =
      await requirePool().query(
        `UPDATE ${config.table} SET ${assignments} WHERE id = $${values.length} RETURNING ${config.fields}`,
        values,
      );

    if (!result.rowCount) {
      sendAdminError(
        request,
        response,
        404,
        "Resource not found.",
        "NOT_FOUND",
      );

      return;
    }

    await audit(
      context,
      request,
      "updated",
      resource,
      id,
      { fields: keys },
    );
  }

  sendAdminJson(
    request,
    response,
    method === "POST" ? 201 : 200,
    {
      success: true,
      data: result.rows[0],
    },
  );
}

type ContentImageType =
  | "programs"
  | "events"
  | "news";

type UploadedImage = {
  buffer: Buffer;
  mimeType: string;
};

async function parseContentImageUpload(
  request: IncomingMessage,
): Promise<{
  contentType: ContentImageType;
  image: UploadedImage;
}> {
  const contentTypeHeader =
    request.headers["content-type"];

  if (
    typeof contentTypeHeader !==
      "string" ||
    !contentTypeHeader
      .toLowerCase()
      .startsWith(
        "multipart/form-data",
      )
  ) {
    throw new RequestBodyError(
      400,
      "VALIDATION_ERROR",
      "Expected multipart/form-data.",
    );
  }

  return new Promise(
    (resolve, reject) => {
      let parser: ReturnType<
        typeof busboy
      >;

      try {
        parser = busboy({
          headers: request.headers,
          limits: {
            files: 1,
            fileSize:
              5 * 1024 * 1024,
            fields: 5,
          },
        });
      } catch {
        reject(
          new RequestBodyError(
            400,
            "VALIDATION_ERROR",
            "Invalid multipart request.",
          ),
        );

        return;
      }

      let contentType:
        | ContentImageType
        | null = null;

      let uploadedImage:
        | UploadedImage
        | null = null;

      let fileSeen = false;
      let fileLimitExceeded =
        false;
      let settled = false;

      const fail = (
        error: Error,
      ): void => {
        if (settled) return;

        settled = true;
        reject(error);
      };

      parser.on(
        "field",
        (name, value) => {
          if (
            name !==
            "contentType"
          ) {
            return;
          }

          const normalized =
            value.trim();

          if (
            normalized ===
              "programs" ||
            normalized ===
              "events" ||
            normalized ===
              "news"
          ) {
            contentType =
              normalized;
          } else {
            fail(
              new RequestBodyError(
                400,
                "VALIDATION_ERROR",
                "Invalid content type.",
              ),
            );
          }
        },
      );

      parser.on(
        "file",
        (
          _fieldName,
          file,
          info,
        ) => {
          if (fileSeen) {
            file.resume();

            fail(
              new RequestBodyError(
                400,
                "VALIDATION_ERROR",
                "Only one image can be uploaded at a time.",
              ),
            );

            return;
          }

          fileSeen = true;

          const chunks: Buffer[] =
            [];

          let totalSize = 0;

          if (
            ![
              "image/jpeg",
              "image/png",
              "image/webp",
            ].includes(
              info.mimeType,
            )
          ) {
            file.resume();

            fail(
              new RequestBodyError(
                400,
                "VALIDATION_ERROR",
                "Only JPEG, PNG, and WebP images are allowed.",
              ),
            );

            return;
          }

          file.on(
            "data",
            (chunk: Buffer) => {
              totalSize +=
                chunk.length;

              if (
                totalSize <=
                5 *
                  1024 *
                  1024
              ) {
                chunks.push(chunk);
              }
            },
          );

          file.on(
            "limit",
            () => {
              fileLimitExceeded =
                true;
            },
          );

          file.on(
            "end",
            () => {
              if (
                fileLimitExceeded
              ) {
                fail(
                  new RequestBodyError(
                    400,
                    "VALIDATION_ERROR",
                    "The image must be 5 MB or smaller.",
                  ),
                );

                return;
              }

              uploadedImage = {
                buffer:
                  Buffer.concat(
                    chunks,
                  ),
                mimeType:
                  info.mimeType,
              };
            },
          );
        },
      );

      parser.on(
        "error",
        () => {
          fail(
            new RequestBodyError(
              400,
              "VALIDATION_ERROR",
              "Invalid multipart request.",
            ),
          );
        },
      );

      parser.on(
        "finish",
        () => {
          if (settled) {
            return;
          }

          if (!contentType) {
            fail(
              new RequestBodyError(
                400,
                "VALIDATION_ERROR",
                "Content type is required.",
              ),
            );

            return;
          }

          if (
            !fileSeen ||
            !uploadedImage
          ) {
            fail(
              new RequestBodyError(
                400,
                "VALIDATION_ERROR",
                "An image file is required.",
              ),
            );

            return;
          }

          settled = true;

          resolve({
            contentType,
            image:
              uploadedImage,
          });
        },
      );

      request.pipe(parser);
    },
  );
}

async function handleContentImageUpload(
  request: IncomingMessage,
  response: ServerResponse,
  context: AdminContext,
): Promise<void> {
  const {
    contentType,
    image,
  } =
    await parseContentImageUpload(
      request,
    );

  try {
    const url =
      await uploadContentImage({
        buffer: image.buffer,
        mimeType: image.mimeType,
        contentType,
      });

    await audit(
      context,
      request,
      "uploaded",
      `${contentType}_image`,
      null,
      {
        content_type:
          contentType,
        mime_type:
          image.mimeType,
        size:
          image.buffer.length,
      },
    );

    sendAdminJson(
      request,
      response,
      201,
      {
        success: true,
        data: { url },
      },
    );
  } catch (error) {
    if (
      error instanceof
      StorageUploadError
    ) {
      sendAdminError(
        request,
        response,
        400,
        error.message,
        "UPLOAD_FAILED",
      );

      return;
    }

    throw error;
  }
}

async function listOperational(
  request: IncomingMessage,
  response: ServerResponse,
  resource:
    | "blood-requests"
    | "emergencies"
    | "contact-messages"
    | "donations",
): Promise<void> {
  const config = {
    "blood-requests": {
      table: "blood_requests",
      fields:
        "id, blood_group, city, hospital, hospital_location, units_required, contact_name, contact_phone, urgency, status, created_at, updated_at",
    },

    emergencies: {
      table: "emergencies",
      fields:
        "id, name, phone, location, emergency_type, description, status, created_at, updated_at, urgency",
    },

    "contact-messages": {
      table: "contact_messages",
      fields:
        "id, name, email, phone, subject, message, status, created_at, updated_at",
    },

    donations: {
      table: "donations",
      fields:
        "id, donor_name, email, phone, amount, currency, frequency, purpose, payment_status, transaction_id, created_at, payment_provider, payment_reference, updated_at",
    },
  }[resource];

  const {
    limit,
    offset,
  } = listParams(
    new URL(
      request.url ?? "",
      "http://localhost",
    ).searchParams,
  );

  const values = [
    limit,
    offset,
  ];

  const result =
    await requirePool().query(
      `SELECT ${config.fields} FROM ${config.table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      values,
    );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: {
        items: result.rows,
        pagination: {
          limit,
          offset,
          returned: result.rowCount,
        },
      },
    },
  );
}

async function patchOperational(
  request: IncomingMessage,
  response: ServerResponse,
  context: AdminContext,
  resource:
    | "blood-requests"
    | "emergencies"
    | "contact-messages"
    | "donations",
  id: string,
): Promise<void> {
  const statuses = {
    "blood-requests":
      BLOOD_REQUEST_STATUSES,
    emergencies:
      EMERGENCY_STATUSES,
    "contact-messages":
      CONTACT_STATUSES,
    donations:
      DONATION_STATUSES,
  }[resource];

  const table = {
    "blood-requests":
      "blood_requests",
    emergencies:
      "emergencies",
    "contact-messages":
      "contact_messages",
    donations:
      "donations",
  }[resource];

  const data = await body(request);

  ensureAllowedFields(
    data,
    [
      "status",
      "payment_status",
    ],
  );

  const field =
    resource === "donations"
      ? "payment_status"
      : "status";

  const status = oneOf(
    data,
    field,
    statuses,
  );

  const result =
    await requirePool().query(
      `UPDATE ${table} SET ${field} = $1 WHERE id = $2 RETURNING id, ${field}`,
      [status, id],
    );

  if (!result.rowCount) {
    sendAdminError(
      request,
      response,
      404,
      "Resource not found.",
      "NOT_FOUND",
    );

    return;
  }

  await audit(
    context,
    request,
    "status_changed",
    resource,
    id,
    { [field]: status },
  );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: result.rows[0],
    },
  );
}

async function summary(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const result =
    await requirePool().query(`
      SELECT
        (SELECT COUNT(*)::int FROM members WHERE status = 'pending') AS pending_members,
        (SELECT COUNT(*)::int FROM volunteers WHERE status = 'pending') AS pending_volunteers,
        (SELECT COUNT(*)::int FROM blood_requests WHERE status = 'open') AS pending_blood_requests,
        (SELECT COUNT(*)::int FROM emergencies WHERE status IN ('open', 'acknowledged', 'in_progress')) AS open_emergencies,
        (SELECT COUNT(*)::int FROM contact_messages WHERE status = 'new') AS new_contact_messages,
        (SELECT COUNT(*)::int FROM donations WHERE payment_status = 'pending') AS pending_donations
    `);

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: result.rows[0],
    },
  );
}

async function listAdmins(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const result =
    await requirePool().query(
      "SELECT admin_users.id, admin_users.email, admin_users.is_active, admin_users.created_at, admin_users.updated_at, admin_users.last_login_at, admin_roles.name AS role FROM admin_users JOIN admin_roles ON admin_roles.id = admin_users.role_id ORDER BY admin_users.created_at DESC",
    );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: result.rows,
    },
  );
}

async function mutateAdmin(
  request: IncomingMessage,
  response: ServerResponse,
  context: AdminContext,
  id: string | null,
  method: "POST" | "PATCH",
): Promise<void> {
  if (method === "POST") {
    const data =
      await body(request);

    ensureAllowedFields(
      data,
      [
        "email",
        "password",
        "role",
      ],
    );

    const email =
      normalizeAdminEmail(
        requiredString(
          data,
          "email",
          320,
        ),
      );

    const password =
      requiredString(
        data,
        "password",
        200,
      );

    if (password.length < 12) {
      bad(
        "Password must be at least 12 characters.",
      );
    }

    const role = oneOf(
      data,
      "role",
      ADMIN_ROLES,
    );

    const roleResult =
      await requirePool().query(
        "SELECT id FROM admin_roles WHERE name = $1",
        [role],
      );

    const result =
      await requirePool().query(
        "INSERT INTO admin_users (email, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, email, is_active, created_at",
        [
          email,
          await hashPassword(
            password,
          ),
          roleResult.rows[0].id,
        ],
      );

    await audit(
      context,
      request,
      "created",
      "admin_user",
      result.rows[0].id,
      { role },
    );

    sendAdminJson(
      request,
      response,
      201,
      {
        success: true,
        data: result.rows[0],
      },
    );

    return;
  }

  if (!id) {
    sendAdminError(
      request,
      response,
      400,
      "Invalid admin ID.",
      "VALIDATION_ERROR",
    );

    return;
  }

  const data =
    await body(request);

  ensureAllowedFields(
    data,
    ["is_active", "role"],
  );

  const current =
    await requirePool().query(
      "SELECT admin_users.id, admin_users.is_active, admin_roles.name AS role FROM admin_users JOIN admin_roles ON admin_roles.id = admin_users.role_id WHERE admin_users.id = $1",
      [id],
    );

  if (!current.rowCount) {
    sendAdminError(
      request,
      response,
      404,
      "Admin not found.",
      "NOT_FOUND",
    );

    return;
  }

  const currentRow =
    current.rows[0] as {
      id: string;
      is_active: boolean;
      role: AdminRole;
    };

  const nextRole =
    data.role === undefined
      ? currentRow.role
      : oneOf(
          data,
          "role",
          ADMIN_ROLES,
        );

  const nextActive =
    data.is_active === undefined
      ? currentRow.is_active
      : data.is_active;

  if (
    typeof nextActive !==
    "boolean"
  ) {
    bad();
  }

  if (
    currentRow.role ===
      "super_admin" &&
    (nextRole !==
      "super_admin" ||
      !nextActive)
  ) {
    const count =
      await requirePool().query(
        "SELECT COUNT(*)::int AS count FROM admin_users JOIN admin_roles ON admin_roles.id = admin_users.role_id WHERE admin_users.is_active = true AND admin_roles.name = 'super_admin'",
      );

    if (
      count.rows[0].count <=
      1
    ) {
      sendAdminError(
        request,
        response,
        409,
        "The last active super admin cannot be removed.",
        "LAST_SUPER_ADMIN",
      );

      return;
    }
  }

  const roleResult =
    await requirePool().query(
      "SELECT id FROM admin_roles WHERE name = $1",
      [nextRole],
    );

  const result =
    await requirePool().query(
      "UPDATE admin_users SET is_active = $1, role_id = $2 WHERE id = $3 RETURNING id, email, is_active, updated_at",
      [
        nextActive,
        roleResult.rows[0].id,
        id,
      ],
    );

  await audit(
    context,
    request,
    "updated",
    "admin_user",
    id,
    {
      is_active:
        nextActive,
      role: nextRole,
    },
  );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: result.rows[0],
    },
  );
}

async function auditLogs(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const {
    limit,
    offset,
  } = listParams(
    new URL(
      request.url ?? "",
      "http://localhost",
    ).searchParams,
  );

  const result =
    await requirePool().query(
      "SELECT admin_audit_logs.id, admin_audit_logs.action, admin_audit_logs.resource_type, admin_audit_logs.resource_id, admin_audit_logs.created_at, admin_audit_logs.metadata, admin_audit_logs.request_id, admin_users.email AS admin_email FROM admin_audit_logs LEFT JOIN admin_users ON admin_users.id = admin_audit_logs.admin_user_id ORDER BY admin_audit_logs.created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );

  sendAdminJson(
    request,
    response,
    200,
    {
      success: true,
      data: {
        items: result.rows,
        pagination: {
          limit,
          offset,
          returned: result.rowCount,
        },
      },
    },
  );
}

export async function handleAdminRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (
    !pathname.startsWith(
      "/api/admin",
    )
  ) {
    return false;
  }

  try {
    if (
      pathname ===
        "/api/admin/login" &&
      request.method === "POST"
    ) {
      if (
        !isAllowedOrigin(
          request,
        )
      ) {
        sendAdminError(
          request,
          response,
          403,
          "Origin is not allowed.",
          "FORBIDDEN",
        );

        return true;
      }

      const data =
        await body(request);

      ensureAllowedFields(
        data,
        ["email", "password"],
      );

      const email =
        requiredString(
          data,
          "email",
          320,
        );

      const password =
        requiredString(
          data,
          "password",
          200,
        );

      const result =
        await authenticateAdmin(
          email,
          password,
          request.socket
            .remoteAddress ??
            "unknown",
        );

      if (!result) {
        sendAdminError(
          request,
          response,
          401,
          "Invalid email or password.",
          "AUTHENTICATION_FAILED",
        );

        return true;
      }

      setAdminCookies(
        response,
        result.sessionToken,
        result.csrfToken,
      );

      sendAdminJson(
        request,
        response,
        200,
        {
          success: true,
          data: {
            id: result.context.id,
            email:
              result.context.email,
            role:
              result.context.role,
          },
        },
      );

      return true;
    }

    if (
      pathname ===
        "/api/admin/logout" &&
      request.method === "POST"
    ) {
      if (
        !isAllowedOrigin(
          request,
        ) ||
        !csrfValid(request)
      ) {
        sendAdminError(
          request,
          response,
          403,
          "CSRF validation failed.",
          "CSRF_FAILED",
        );

        return true;
      }

      await revokeAdminSession(
        request,
      );

      clearAdminCookies(
        response,
      );

      sendAdminJson(
        request,
        response,
        200,
        {
          success: true,
          data: {
            loggedOut: true,
          },
        },
      );

      return true;
    }

    const context =
      await requireContext(
        request,
        response,
      );

    if (!context) {
      return true;
    }

    /*
     * Admin content image upload
     *
     * This route is protected by:
     * - admin session authentication
     * - allowed-origin validation
     * - CSRF validation
     *
     * The actual upload is performed server-side
     * using the Supabase service-role key.
     */
    if (
      pathname ===
        "/api/admin/uploads/content-image" &&
      request.method === "POST"
    ) {
      await handleContentImageUpload(
        request,
        response,
        context,
      );

      return true;
    }

    if (
      pathname ===
        "/api/admin/me" &&
      request.method === "GET"
    ) {
      sendAdminJson(
        request,
        response,
        200,
        {
          success: true,
          data: context,
        },
      );

      return true;
    }

    if (
      pathname ===
        "/api/admin/summary" &&
      request.method === "GET"
    ) {
      await summary(
        request,
        response,
      );

      return true;
    }

    if (
      pathname ===
        "/api/admin/audit-logs" &&
      request.method === "GET"
    ) {
      if (
        requireRole(
          context,
          request,
          response,
          "super_admin",
        )
      ) {
        await auditLogs(
          request,
          response,
        );
      }

      return true;
    }

    if (
      pathname ===
      "/api/admin/admins"
    ) {
      if (
        !requireRole(
          context,
          request,
          response,
          "super_admin",
        )
      ) {
        return true;
      }

      if (
        request.method === "GET"
      ) {
        await listAdmins(
          request,
          response,
        );
      } else if (
        request.method === "POST"
      ) {
        await mutateAdmin(
          request,
          response,
          context,
          null,
          "POST",
        );
      } else {
        sendAdminError(
          request,
          response,
          405,
          "Method not allowed.",
          "METHOD_NOT_ALLOWED",
        );
      }

      return true;
    }

    const adminId =
      pathname.startsWith(
        "/api/admin/admins/",
      )
        ? pathId(
            pathname,
            "/api/admin/admins/",
          )
        : null;

    if (
      adminId !== null ||
      pathname.startsWith(
        "/api/admin/admins/",
      )
    ) {
      if (
        !requireRole(
          context,
          request,
          response,
          "super_admin",
        )
      ) {
        return true;
      }

      if (!adminId) {
        sendAdminError(
          request,
          response,
          400,
          "Invalid admin ID.",
          "VALIDATION_ERROR",
        );
      } else if (
        request.method ===
        "PATCH"
      ) {
        await mutateAdmin(
          request,
          response,
          context,
          adminId,
          "PATCH",
        );
      } else {
        sendAdminError(
          request,
          response,
          405,
          "Method not allowed.",
          "METHOD_NOT_ALLOWED",
        );
      }

      return true;
    }

    for (
      const resource of [
        "members",
        "volunteers",
      ] as const
    ) {
      const prefix =
        `/api/admin/${resource}`;

      if (
        pathname === prefix &&
        request.method === "GET"
      ) {
        await listApplications(
          request,
          response,
          resource,
        );

        return true;
      }

      if (
        pathname.startsWith(
          `${prefix}/`,
        )
      ) {
        const id = pathId(
          pathname,
          `${prefix}/`,
        );

        if (!id) {
          sendAdminError(
            request,
            response,
            400,
            "Invalid resource ID.",
            "VALIDATION_ERROR",
          );

          return true;
        }

        if (
          request.method ===
          "PATCH"
        ) {
          await patchApplication(
            request,
            response,
            context,
            resource,
            id,
          );
        } else {
          sendAdminError(
            request,
            response,
            405,
            "Method not allowed.",
            "METHOD_NOT_ALLOWED",
          );
        }

        return true;
      }
    }

    for (
      const resource of Object.keys(
        contentConfig,
      ) as ContentResource[]
    ) {
      const prefix =
        `/api/admin/${resource}`;

      if (
        pathname === prefix &&
        request.method === "GET"
      ) {
        await listContent(
          request,
          response,
          resource,
        );

        return true;
      }

      if (
        pathname === prefix &&
        request.method === "POST"
      ) {
        await mutateContent(
          request,
          response,
          context,
          resource,
          null,
          "POST",
        );

        return true;
      }

      if (
        pathname.startsWith(
          `${prefix}/`,
        )
      ) {
        const id = pathId(
          pathname,
          `${prefix}/`,
        );

        if (!id) {
          sendAdminError(
            request,
            response,
            400,
            "Invalid resource ID.",
            "VALIDATION_ERROR",
          );

          return true;
        }

        if (
          ["PATCH", "DELETE"].includes(
            request.method ?? "",
          )
        ) {
          await mutateContent(
            request,
            response,
            context,
            resource,
            id,
            request.method as
              | "PATCH"
              | "DELETE",
          );
        } else {
          sendAdminError(
            request,
            response,
            405,
            "Method not allowed.",
            "METHOD_NOT_ALLOWED",
          );
        }

        return true;
      }
    }

    for (
      const resource of [
        "blood-requests",
        "emergencies",
        "contact-messages",
        "donations",
      ] as const
    ) {
      const prefix =
        `/api/admin/${resource}`;

      if (
        pathname === prefix &&
        request.method === "GET"
      ) {
        await listOperational(
          request,
          response,
          resource,
        );

        return true;
      }

      if (
        pathname.startsWith(
          `${prefix}/`,
        )
      ) {
        const id = pathId(
          pathname,
          `${prefix}/`,
        );

        if (!id) {
          sendAdminError(
            request,
            response,
            400,
            "Invalid resource ID.",
            "VALIDATION_ERROR",
          );

          return true;
        }

        if (
          request.method ===
          "PATCH"
        ) {
          await patchOperational(
            request,
            response,
            context,
            resource,
            id,
          );
        } else {
          sendAdminError(
            request,
            response,
            405,
            "Method not allowed.",
            "METHOD_NOT_ALLOWED",
          );
        }

        return true;
      }
    }

    sendAdminError(
      request,
      response,
      404,
      "Admin route not found.",
      "NOT_FOUND",
    );
  } catch (error) {
    if (
      error instanceof
      RequestBodyError
    ) {
      sendAdminError(
        request,
        response,
        error.statusCode,
        error.message,
        error.code,
      );
    } else {
      sendAdminError(
        request,
        response,
        500,
        "Internal server error",
        "INTERNAL_ERROR",
      );
    }
  }

  return true;
}