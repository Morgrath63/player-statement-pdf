import { z } from "zod";

import type { InfraiClient } from "./infrai_client.js";

export const statementRequestSchema = z.object({
  statementId: z.string().uuid(),
  playerId: z.string().min(1).max(100),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  assets: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(["skin", "map", "item"]),
    earnedUnits: z.number().nonnegative(),
  })),
  liveEvents: z.array(z.object({
    name: z.string().min(1),
    settled: z.boolean(),
    earnedUnits: z.number().nonnegative(),
  })),
  moderationQueue: z.array(z.object({
    assetName: z.string().min(1),
    status: z.enum(["pending", "approved", "rejected"]),
  })),
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export type ExportDecision =
  | { eligible: false; reasons: string[] }
  | { eligible: true; totalEarnedUnits: number };

export function decideStatementExport(input: StatementRequest): ExportDecision {
  const reasons: string[] = [];
  if (input.period.from >= input.period.to) reasons.push("Statement period is not ordered");
  if (input.liveEvents.some((event) => !event.settled)) reasons.push("A live event is unsettled");
  if (input.moderationQueue.some((item) => item.status === "pending")) {
    reasons.push("A generated asset is awaiting moderation");
  }
  if (reasons.length > 0) return { eligible: false, reasons };

  const totalEarnedUnits = [...input.assets, ...input.liveEvents]
    .reduce((sum, item) => sum + item.earnedUnits, 0);
  return { eligible: true, totalEarnedUnits };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] as string);
}

function statementHtml(input: StatementRequest, total: number, usage: unknown): string {
  const assetRows = input.assets.map((asset) =>
    `<tr><td>${escapeHtml(asset.name)}</td><td>${asset.kind}</td><td>${asset.earnedUnits}</td></tr>`,
  ).join("");
  const eventRows = input.liveEvents.map((event) =>
    `<tr><td>${escapeHtml(event.name)}</td><td>settled</td><td>${event.earnedUnits}</td></tr>`,
  ).join("");
  return `<!doctype html><html><body><h1>Player account statement</h1>
<p>Player: ${escapeHtml(input.playerId)}</p><p>Period: ${input.period.from} to ${input.period.to}</p>
<table><thead><tr><th>Entry</th><th>Type</th><th>Earned units</th></tr></thead>
<tbody>${assetRows}${eventRows}</tbody></table><p>Total earned units: ${total}</p>
<h2>Metered service usage</h2><pre>${escapeHtml(JSON.stringify(usage, null, 2))}</pre></body></html>`;
}

export async function exportPlayerStatement(input: StatementRequest, client: InfraiClient) {
  const decision = decideStatementExport(input);
  if (!decision.eligible) return { status: "review_required" as const, reasons: decision.reasons };

  const usage = await client.usageTimeseries();
  const pdf = await client.generatePdf(
    statementHtml(input, decision.totalEarnedUnits, usage),
    input.statementId,
  );
  return { status: "exported" as const, totalEarnedUnits: decision.totalEarnedUnits, pdf };
}
