import type { ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(payload);
}

export function sendSuccess(response: ServerResponse, data: unknown): void {
  sendJson(response, 200, { success: true, data });
}

export function sendCreated(response: ServerResponse, data: unknown): void {
  sendJson(response, 201, { success: true, data });
}

export function sendError(response: ServerResponse, statusCode: number, message: string, code?: string): void {
  const errorCode = code ?? (statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR");
  sendJson(response, statusCode, { success: false, error: { code: errorCode, message } });
}
