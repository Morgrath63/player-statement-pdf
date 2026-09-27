import assert from "node:assert/strict";
import test from "node:test";

import { createInfraiClient } from "../src/infrai_client.js";

test("PDF generation sends the statement ID as the request idempotency key", async () => {
  const statementId = "065c2215-a80d-4f14-b826-21c0058f3e9c";
  const calls: RequestInit[] = [];
  const request: typeof fetch = async (_url, init) => {
    calls.push(init ?? {});
    return new Response(JSON.stringify({ ok: true, data: { id: "pdf-1" } }), {
      headers: { "content-type": "application/json" },
    });
  };

  const client = createInfraiClient("test-key", request);
  await client.generatePdf("<p>Statement</p>", statementId);
  await client.generatePdf("<p>Statement</p>", statementId);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(JSON.parse(String(call.body)).idempotency_key, statementId);
    assert.equal((call.headers as Record<string, string>)["Idempotency-Key"], undefined);
  }
});
