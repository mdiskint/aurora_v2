# Security Test Harness (BETA-10)

Automated coverage for the authorization and security work shipped in
BETA-02..09. All tests run with `npx tsx lib/__tests__/<name>.test.ts` — no
database, no Upstash, no real AI, no production secrets. Where a real
service seam is required the test injects a stub/mock; end-to-end integration
against a deployed environment is deferred to **BETA-12 (acceptance matrix)**.

## Running

```bash
cd app
npm test          # runs the full suite including the security harness
# or individually:
npx tsx lib/__tests__/authz.test.ts
npx tsx lib/__tests__/universeSecurity.test.ts
npx tsx lib/__tests__/rateLimit.test.ts
npx tsx lib/__tests__/inviteRedemption.test.ts
npx tsx lib/__tests__/betaAccess.test.ts
npx tsx lib/__tests__/betaAdmin.test.ts
npx tsx lib/__tests__/uploadAuth.test.ts
npx tsx lib/__tests__/universeRoute.test.ts
```

## Coverage matrix

| Area | File | Cases |
|------|------|-------|
| requireUser / getSessionUser | `authz.test.ts` | anonymous → 401; authenticated → user; session without verified email → 401 |
| Beta-administrator operator gating | `authz.test.ts` | anonymous → 401; authenticated non-operator → 403; operator → allowed |
| Private route authz (chat/extract/upload) | `authz.test.ts` | anonymous refused (401) before any route work; refusal is env-independent |
| Universe decision logic | `universeSecurity.test.ts` | anonymous → 401; malformed payload → 400; oversized → 413; version conflict → 409; clientId bounded |
| Universe route decision helpers | `universeRoute.test.ts` | pure decision helpers the handlers rely on: `validateUniversePayload` → 400; `isPayloadWithinLimit` / `readBodyWithLimit` → 413; `shouldRejectVersionConflict` → 409; `validateClientId` bounding; and `requireUser` gate → anonymous 401. Does NOT execute the route handlers themselves. |
| Invite redemption matrix | `inviteRedemption.test.ts` | valid; wrong email; expired; revoked; used (single-use atomic redeem) |
| Beta access lifecycle | `betaAccess.test.ts` | approved/unrevoked/unexpired grant; pending/revoked/expired deny |
| Beta admin transitions | `betaAdmin.test.ts` | approve/revoke/reinvite; operator allowlist |
| Blob upload authz | `uploadAuth.test.ts` | SSRF host allowlist; opaque user-scoped pathname; type/size limits; expiry |
| Rate-limit deny-closed | `rateLimit.test.ts` | missing config → deny-closed; fetch error → deny-closed; HTTP error → deny-closed; malformed result → deny-closed; allow path; over-limit → 429 (not deny-closed) |

## How the harness avoids production secrets

- **Auth**: `getSessionUser` / `requireUser` / `requireOperator` accept an
  injectable `SessionResolver` (a test seam added in BETA-10). Production
  routes call them with no argument and use the default NextAuth resolver;
  tests inject a stub session so the decision logic runs without a live OAuth
  session or database. The default resolver is never invoked in tests.
- **Rate limit**: `evalRateLimit` reads `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` at call time instead of module load. Tests set
  the env inline and mock `globalThis.fetch` (restored after the run) to
  exercise every deny-closed branch without a real Upstash token or network.
- **Universe**: the pure decision logic (`validateUniversePayload`,
  `isPayloadWithinLimit`, `shouldRejectVersionConflict`, `readBodyWithLimit`)
  and the `requireUser` gate are tested directly in `universeRoute.test.ts`.
  The route handlers themselves are not executed; the handlers take a single
  `req: Request` and call `requireUser()` with the default NextAuth resolver,
  with no injectable resolver seam and no mocked Prisma. Owner / non-owner DB
  scoping via the `(userId, clientId)` Prisma composite key is therefore NOT
  exercised here and is deferred to the BETA-12 live two-account acceptance
  matrix against a real database.

## Deferred integration (BETA-12)

The following require a real database / OAuth / deployed environment and are
exercised in the BETA-12 acceptance matrix, not here:

- Live owner / non-owner universe reads, upserts, and deletes against Prisma
  with real database rows and two authenticated accounts (BETA-12 acceptance
  matrix). This integration is NOT covered by `universeRoute.test.ts`, which
  exercises only the pure decision helpers and the `requireUser` gate.
- Live OAuth round-trip through Google and the invite ticket cookie.
- Live Upstash REST counter over the network.
- Full route-handler integration for chat / upload / extract with real
  providers and blob storage.