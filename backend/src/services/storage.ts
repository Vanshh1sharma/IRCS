import { randomUUID } from "node:crypto";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ?? ""
).replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const STORAGE_BUCKET = "ircs-content";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class StorageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUploadError";
  }
}

function assertConfigured(): void {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new StorageUploadError(
      "Server storage is not configured.",
    );
  }
}

export function validateImage(
  mimeType: string,
  size: number,
): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new StorageUploadError(
      "Only JPEG, PNG, and WebP images are allowed.",
    );
  }

  if (size <= 0) {
    throw new StorageUploadError(
      "The uploaded image is empty.",
    );
  }

  if (size > MAX_FILE_SIZE) {
    throw new StorageUploadError(
      "The image must be 5 MB or smaller.",
    );
  }
}

export async function uploadContentImage({
  buffer,
  mimeType,
  contentType,
}: {
  buffer: Buffer;
  mimeType: string;
  contentType: "programs" | "events" | "news";
}): Promise<string> {
  assertConfigured();

  validateImage(
    mimeType,
    buffer.length,
  );

  const extension =
    MIME_EXTENSIONS[mimeType];

  const filename =
    `${contentType}/${new Date().getUTCFullYear()}/` +
    `${String(new Date().getUTCMonth() + 1).padStart(2, "0")}/` +
    `${randomUUID()}.${extension}`;

  const uploadUrl =
    `${SUPABASE_URL}/storage/v1/object/` +
    `${STORAGE_BUCKET}/${filename}`;

  const response = await fetch(
    uploadUrl,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: buffer,
    },
  );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new StorageUploadError(
      `Image upload failed (${response.status}). ${responseText || "Storage rejected the upload."}`,
    );
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/` +
    `${STORAGE_BUCKET}/${filename}`
  );
}