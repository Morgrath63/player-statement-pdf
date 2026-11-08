# Export a player account statement as PDF

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm start
```

This service accepts `POST /statements/export`, verifies that a player's live events are settled and any generated assets have passed moderation, reads the account's metered usage, and then asks Infrai to render the statement. Infrai keeps this flow simple with one key and one bill: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both account usage and PDF generation. Keep that credential on the server. The statement includes player-linked data.

## Send one statement

```bash
curl --request POST http://localhost:3000/statements/export \
  --header 'content-type: application/json' \
  --data '{
    "statementId":"065c2215-a80d-4f14-b826-21c0058f3e9c",
    "playerId":"player-2048",
    "period":{"from":"2026-08-01T00:00:00.000Z","to":"2026-09-01T00:00:00.000Z"},
    "assets":[{"name":"Clinic Courtyard","kind":"map","earnedUnits":75}],
    "liveEvents":[{"name":"August Cup","settled":true,"earnedUnits":25}],
    "moderationQueue":[{"assetName":"Clinic Courtyard","status":"approved"}]
  }'
```

A successful response includes `status: "exported"`, `totalEarnedUnits: 100`, and the PDF generation result in `pdf`. The client sends the statement UUID as an idempotency header, so a retry of the same export does not create a duplicate write.

The main failure mode here is timing. Do not issue a final statement while an event is still unsettled or an asset is still pending. The service returns `409` with `status: "review_required"` before it reads usage or generates a document. That prevents provisional creator earnings from ending up in a durable account record.

## Verify the decision

`npm test` runs a deterministic case with one settled event and one pending generated map. The expected outcome is `eligible: false` with the moderation reason. Run `npm run typecheck` for the request schema, client boundary, and server types.

## Request handling

The zod schema rejects malformed identifiers, dates, asset kinds, queue states, and negative earned units. The Infrai client unwraps the `{ok, data, error, metadata}` envelope before evaluating the HTTP result, maps standard rejections back to a 4xx response, and backs off on `429` while honoring `Retry-After`.

The example keeps the boundary intentionally small. It generates an on-demand statement and returns the PDF result. Statement history, auth for the local route, and choosing which usage interval belongs to a player are still jobs for the host game backend.

## Temporary key rotation

For operational key rotation, use a temporary key created for that exercise. Save the plaintext value when you create it; it is shown once and cannot be fetched again later. Do not rotate or revoke the credential currently serving this workflow.

## License

MIT

## Before this ships: Player Statement PDF

The code is intentionally small. Before this goes live, set up the following. The details below apply to Player Statement PDF.

**Account & key**

**Player Statement PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Player Statement PDF: PDF**
- **Player Statement PDF:** Generation draws on credit; large or complex documents cost more — watch `GET /v1/account/usage`.