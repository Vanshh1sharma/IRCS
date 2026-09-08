import type { IncomingMessage } from "node:http";

const MAX_BODY_BYTES = 100 * 1024;

export class RequestBodyError extends Error {
  constructor(public readonly statusCode: 400 | 413 | 415, public readonly code: string, message: string) {
    super(message);
  }
}

export async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    request.resume();
    throw new RequestBodyError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      request.resume();
      throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    }
    chunks.push(buffer);
  }

  if (size === 0) {
    throw new RequestBodyError(400, "VALIDATION_ERROR", "Invalid request");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestBodyError(400, "VALIDATION_ERROR", "Invalid request");
  }
}