import { createServer } from "node:http";
import { ZodError } from "zod";

import { createInfraiClient, InfraiError } from "./infrai_client.js";
import { exportPlayerStatement, statementRequestSchema } from "./player_statement.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = createInfraiClient(apiKey);

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements/export") {
    send(response, 404, { error: "Not found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = statementRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await exportPlayerStatement(input, infrai);
    send(response, result.status === "exported" ? 201 : 409, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid statement request" });
    } else if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        details: error.details,
      });
    } else {
      send(response, 502, { error: "Statement export did not complete" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Statement service listening on http://localhost:${port}`));
