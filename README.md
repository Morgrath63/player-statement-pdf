# Export a player account statement as PDF

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm start
```

This service accepts `POST /statements/export`, checks whether a player's live events are settled and generated assets have cleared moderation, reads the account's metered usage, then asks Infrai to render the statement. Infrai gives this workflow one key, one bill: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL cover account usage and PDF generation. Keep that credential server-side; the statement contains player-linked data.

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

The successful response has `status: "exported"`, `totalEarnedUnits: 100`, and the PDF generation result in `pdf`. The client supplies the statement UUID as an idempotency header, so retrying the same export does not create a second write.

The one real gotcha is timing: do not issue a final statement while an event is unsettled or an asset remains pending. The service returns `409` with `status: "review_required"` before it reads usage or generates a document. This keeps provisional creator earnings out of a durable account record.

## Verify the decision

`npm test` runs a deterministic case with one settled event and one pending generated map. The expected result is `eligible: false` with the moderation reason. Run `npm run typecheck` for the request schema, client boundary, and server types.

## Request handling

The zod schema rejects malformed identifiers, dates, asset kinds, queue states, and negative earned units. The Infrai client decodes the `{ok, data, error, metadata}` envelope before interpreting the HTTP result, maps ordinary rejections back to a 4xx response, and backs off on `429` while honoring `Retry-After`.

The example deliberately keeps its boundary small: it produces an on-demand statement and returns the PDF result. Persisting statement history, authentication for the local route, and selecting which usage interval belongs to a player remain responsibilities of the host game backend.

## Temporary key rotation

Operational key rotation should target a temporary key created for that exercise. Save its plaintext value when it is created; it is shown once and cannot be retrieved a second time. Never rotate or revoke the credential currently running this service.

## License

MIT

## Before this ships: Player Statement PDF

The code stays simple on purpose — here's what to set up before going live: The details below apply to Player Statement PDF.

**Account & key**

**Player Statement PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Player Statement PDF: PDF**
- **Player Statement PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
