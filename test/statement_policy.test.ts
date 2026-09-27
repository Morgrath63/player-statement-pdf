import assert from "node:assert/strict";
import test from "node:test";

import { decideStatementExport, statementRequestSchema } from "../src/player_statement.js";

test("holds a statement while generated assets await moderation", () => {
  const input = statementRequestSchema.parse({
    statementId: "065c2215-a80d-4f14-b826-21c0058f3e9c",
    playerId: "player-2048",
    period: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
    assets: [{ name: "Clinic Courtyard", kind: "map", earnedUnits: 75 }],
    liveEvents: [{ name: "August Cup", settled: true, earnedUnits: 25 }],
    moderationQueue: [{ assetName: "Clinic Courtyard", status: "pending" }],
  });

  assert.deepEqual(decideStatementExport(input), {
    eligible: false,
    reasons: ["A generated asset is awaiting moderation"],
  });
});
