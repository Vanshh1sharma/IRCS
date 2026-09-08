import { createServer } from "node:http";
import { URL } from "node:url";
import { routeRequest } from "./routes/index.js";
import { sendError, sendJson } from "./utils/response.js";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer.");
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    void routeRequest(request, response, requestUrl.pathname, requestUrl.searchParams).catch(() => {
      if (!response.headersSent) sendError(response, 500, "Internal server error");
    });
  } catch {
    if (!response.headersSent) sendError(response, 500, "Internal server error");
  }
});

server.listen(port, () => {
  console.log(`IRCS-NIET API listening on port ${port}`);
});
