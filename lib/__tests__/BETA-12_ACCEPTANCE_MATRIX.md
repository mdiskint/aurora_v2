# BETA-12 — Beta Authorization Acceptance Matrix

Two-account (A and B) acceptance procedure that proves the BETA-02..11
authorization and security controls work end to end. This is the independent
acceptance gate before deploy (BETA-13).

This document is the **executable procedure**. For each item it gives exact
steps, expected results, and how to run it against the deployed BETA-13
preview. It also maps every matrix cell to the unit-test coverage that encodes
the pure-logic portion (runnable here, without a live environment) versus the
portion that **requires** the live preview.

The companion automated check is `acceptanceMatrix.test.ts`, which encodes the
matrix as data, re-runs the pure-logic assertions, and cross-checks that every
live-only cell is honestly flagged.

---

## 1. Preconditions

You need the deployed BETA-13 preview and two distinct Google accounts.

| Requirement | Value |
|---|---|
| Preview URL | `https://<preview>.vercel.app` (BETA-13) |
| Account A | a genuine Google account, email `A@...` |
| Account B | a DIFFERENT genuine Google account, email `B@...` |
| Operator | a third browser/private window signed into the beta-admin console |
| Admin email | the operator's `ADMIN_EMAILS` allowlist must include the operator |
| IP | both accounts must exercise rate limits from the reviewer's IP; use a second IP (mobile hotspot / VPN) to prove per-IP separation |

Because Google refuses to sign into two accounts in one browser profile, use
**separate browser profiles** (or incognito + a normal profile) so A and B are
never simultaneously signed in with cross-contamination.

---

## 2. Matrix at a glance

| ID | Area | Unit-covered assertion | Needs live preview |
|----|------|------------------------|--------------------|
| AM-01 | Signup / invite / OAuth / onboard | approved+invited email OK; wrong/expired/revoked/used invite rejected; ticket tamper/expiry | OAuth round-trip, DB rows |
| AM-02 | Anonymous access | protected API → 401 (requireUser) | middleware redirect |
| AM-03 | Universe CRUD isolation | version conflict → 409; clientId bounded | owner/non-owner DB scoping |
| AM-04 | Account switch / cache isolation | namespaced storage keys; legacy data not crossed; in-memory drop | browser profile switch |
| AM-05 | Upload / analyze ownership | opaque user-scoped pathname; SSRF reject | upload record + blob ownership |
| AM-06 | Rate limits | limiter deny-closed; body shape; key derivation | live Upstash counters |
| AM-07 | Private route authz | chat/extract/upload anonymous → 401 | live route handlers |

---

## 3. Setup the two accounts

1. Operator signs into the beta-admin console (`/beta-admin`), approves
   account A's invite and account B's invite (each via `approve`, which issues
   a unique invite token/email).
2. Record A's invite token and B's invite token (from the admin console or the
   emailed invite link).
3. Both accounts are `approved`, `inviteExpires` in the future, `revokedAt`
   null, `redeemedAt` null.

---

## 4. AM-01 — Signup / invite / OAuth / onboard

### AM-01.1 Approved + invited email signs in — PASS expected

- **Steps**: In profile A, open `/join?token=<A-token>`. Click "Sign in with
  Google", authenticate as A. Complete onboarding.
- **Expected**: A reaches the app (course-builder/explore). A DB `user` row and
  `betaSignup` row exist with `status=REDEEMED`, `redeemedAt` set. The invite
  ticket cookie is consumed.
- **Unit**: `inviteRedemption.test.ts` (`validateApproved`, `redeemOnce`),
  `betaAccess.test.ts` (`isBetaAccessGranted`).

### AM-01.2 Wrong email rejected — PASS expected

- **Steps**: In a fresh profile, with a fresh (unused) invite token for A, sign
  in with a Google account whose email is **not** A's invited email.
- **Expected**: Sign-in is rejected; the user is **not** granted access. No app
  data is created.
- **Unit**: `inviteRedemption.test.ts` (`validateRejections` → mismatched
  invited email row), `betaAccess.test.ts` (`emailMatchesInvite`).

### AM-01.3 Expired invite rejected — PASS expected

- **Steps**: Operator sets A's invite expired (or uses a token past
  `inviteExpires`). Profile A tries `/join?token=<expired>`.
- **Expected**: `POST /api/auth/invite` returns **403**; no OAuth redirect to a
  granting path; access denied.
- **Unit**: `betaAccess.test.ts` (`isBetaAccessGranted` expired row),
  `inviteRedemption.test.ts` (`validateRejections` expired row,
  `ticketExpiry`).

### AM-01.4 Revoked invite rejected — PASS expected

- **Steps**: Operator revokes A (status → `REVOKED`). Profile A (signed out)
  tries `/join?token=<A-token>`.
- **Expected**: `POST /api/auth/invite` returns **403**; access denied even
  with a previously-issued valid ticket.
- **Unit**: `betaAccess.test.ts` (`isBetaAccessGranted` revoked),
  `betaAdmin.test.ts` (`revoke`, re-invite), `inviteRedemption.test.ts`
  (revoked row).

### AM-01.5 Used (single-use) invite rejected — PASS expected

- **Steps**: After AM-01.1, A's token is already redeemed. In a fresh profile,
  try `/join?token=<A-token>` again.
- **Expected**: `POST /api/auth/invite` returns **403**; the spent token cannot
  be reused.
- **Unit**: `inviteRedemption.test.ts` (`redeemOnce` → second redemption
  fails), `betaAccess.test.ts` (redeemed status).

### AM-01.6 Invite ticket tamper/expiry rejected — PASS expected

- **Steps**: Capture a valid invite cookie; tamper with its payload or wait past
  its 10-minute TTL; replay it.
- **Expected**: Cookie fails HMAC verification (tamper) or is expired; sign-in
  is rejected.
- **Unit**: `inviteRedemption.test.ts` (`tamperRejected`, `ticketExpiry`).

> **Live-only portion**: real Google OAuth redirect, real DB `betaSignup`
> rows, the `astryon_invite` HttpOnly cookie set by `/api/auth/invite`. The
> pure decision logic and ticket crypto are fully unit-covered.

---

## 5. AM-02 — Anonymous access

### AM-02.1 Protected pages redirect — PASS expected (live)

- **Steps**: In a clean, signed-out profile, browse protected pages:
  `/course-builder`, `/explore`, `/memories`, `/create`, `/chat`.
- **Expected**: Anonymous navigation redirects to `/auth/signin?callbackUrl=<path>`.
  No page content renders.
- **Unit**: middleware `PUBLIC_PREFIXES` / `isPublicPath` allowlist. This is
  **not** unit-exported, so it is asserted live here. (The middleware is
  exercised via the live preview; the 401 API side is unit-covered in AM-02.2.)

### AM-02.2 Protected API → 401 — PASS expected

- **Steps**: Signed out, call protected APIs directly with no session cookie:
  `GET /api/universes`, `POST /api/chat`, `POST /api/extract-text`,
  `POST /api/upload`, `POST /api/analyze-video`, `POST /api/generate-title`,
  `POST /api/export-universe`, `POST /api/user/onboard`.
- **Expected**: Each returns **401** with `{ error: "Unauthorized" }`. No
  route work runs.
- **Unit**: `authz.test.ts` (`requireUser` anonymous → 401;
  `privateRouteAuthz`), `universeSecurity.test.ts` (`anonymousRejected`).

---

## 6. AM-03 — Universe CRUD isolation

Setup: A creates a universe (clientId `uA`) via `POST /api/universes` with
version 1. B creates its own (clientId `uB`). Record A's universe `id`,
`clientId`, and `version`.

### AM-03.1 A cannot read B's universe — PASS expected (live)

- **Steps**: Signed in as A, call `GET /api/universes`. Attempt to read B's
  universe by its known `clientId` (e.g. craft a GET scoped to B's id, or a
  cross-user upsert with B's `clientId`).
- **Expected**: A's GET returns only A's universes. Any direct read keyed to
  B's `clientId` (not under A's `userId`) returns nothing / 404 — never B's
  data.
- **Unit**: `universeSecurity.test.ts` (`ownerScopingContract`),
  `universeRoute.test.ts` (`ownerScopingContract`). The composite-key DB
  scoping itself is live-only.

### AM-03.2 A cannot overwrite B's universe — PASS expected (live)

- **Steps**: Signed in as A, `POST /api/universes` with B's `clientId` and a
  payload.
- **Expected**: The upsert is keyed by `(A.userId, B.clientId)` — it creates a
  **new** row owned by A rather than overwriting B's row. B's data is
  untouched. B's own `GET` still returns B's original universe.
- **Unit**: `universeRoute.test.ts` (`ownerScopingContract`), `universeSchema`
  (`validateUniversePayload`). Success/overwrite semantics are DB/live.

### AM-03.3 A cannot delete B's universe — PASS expected (live)

- **Steps**: Signed in as A, `DELETE /api/universes` with B's `clientId`.
- **Expected**: The delete scoped by `(A.userId, B.clientId)` finds no row →
  P2025 → returns `{ success: true }` but does **not** delete B's universe. B
  still has it on its next GET.
- **Unit**: `universeRoute.test.ts` (`ownerScopingContract`). The P2025
  mapping is live-only.

### AM-03.4 Version conflict → 409 — PASS expected

- **Steps**: Signed in as A, obtain current version `v`. Submit a write with
  `version: v` (current) → should succeed. Then submit with `version: v - 1`
  (stale) → should conflict.
- **Expected**: Stale write returns **409** with `{ error: "Conflict" }` and the
  current universe. Current/equal or missing version does not conflict.
- **Unit**: `universeSecurity.test.ts` (`versionConflict`),
  `universeRoute.test.ts` (`versionConflict`).

### AM-03.5 clientId bounded — PASS expected

- **Steps**: Submit a universe with an empty, overlong (>128 chars), or
  unsafe-character `clientId`.
- **Expected**: `POST /api/universes` returns **400**.
- **Unit**: `universeSecurity.test.ts` (`malformedPayload, clientId`),
  `universeRoute.test.ts` (`malformedPayload, ownerScopingContract`).

---

## 7. AM-04 — Account switch / browser cache isolation

### AM-04.1 Namespaced storage keys — PASS expected (live + unit)

- **Steps**: A signs in and creates data (local `aurora-portal-data:user-A`).
  Sign out. Sign in as B in the same browser profile. Inspect `localStorage`.
- **Expected**: B's keys are `aurora-portal-data:user-B`, distinct from A's.
  B never sees A's cached universes/imports.
- **Unit**: `persistenceContext.test.ts` (namespace separation for A/B,
  `storageKeyMain()` differs), `persistenceContextStore.test.ts`.

### AM-04.2 Legacy data not crossed between accounts — PASS expected (live + unit)

- **Steps**: With pre-BETA-06 base-key data present, sign in first as A (claims
  the legacy data), sign out, sign in as B.
- **Expected**: A receives the legacy data in its namespace; B receives none.
  The legacy source is cleared after A claims it.
- **Unit**: `persistenceContext.test.ts` (legacy migration, second account
  never receives A's legacy data).

### AM-04.3 In-memory library dropped on account switch — PASS expected (live + unit)

- **Steps**: A hydrates its library into memory, signs out, B signs in on the
  same profile.
- **Expected**: The in-memory library is synchronously dropped; B cannot
  trigger a save that writes A's data into B's namespace.
- **Unit**: `persistenceContextStore.test.ts` (scenario 1: A hydrates then
  switch to B).

---

## 8. AM-05 — Upload / analyze ownership

### AM-05.1 Opaque user-scoped blob pathname — PASS expected (unit)

- **Steps / assertion**: A uploaded blob pathname is `videos/<uuid>.<ext>`, a
  non-enumerable UUID, not derived from a guessable user id.
- **Expected**: `buildOpaquePathname` returns a user-agnostic opaque path.
- **Unit**: `uploadAuth.test.ts` (`opaquePathname`).

### AM-05.2 SSRF / arbitrary URL rejected — PASS expected (unit)

- **Steps**: Signed in as A, `POST /api/analyze-video` with an arbitrary URL
  (e.g. `http://169.254.169.254/...`, `https://evil.com/x.mp4`).
- **Expected**: Rejected as **400** before any network I/O.
- **Unit**: `uploadAuth.test.ts` (`rejectsArbitraryUrls`).

### AM-05.3 A cannot analyze or delete B's blob — PASS expected (live)

- **Steps**: A uploads a video (blob). B, signed in, calls
  `POST /api/analyze-video` with A's `uploadId` and A's blob URL. B also
  attempts to delete A's blob.
- **Expected**: Analysis is rejected because the upload record is scoped to
  A's `userId` (`findFirst({ where: { id, userId } })`) → 404 "Upload not
  found"; and even with a matching record the client URL pathname must equal
  the owner's recorded pathname (403 otherwise). B cannot delete A's blob (no
  delete path exists for a non-owner; analyze-video does not delete the blob).
- **Unit**: `uploadAuth.test.ts` (pathname + SSRF). The DB upload-record
  `userId` scoping and blob lifecycle are live-only.

---

## 9. AM-06 — Rate limits

### AM-06.1 Per-IP signup limit — PASS expected (live)

- **Steps**: From one IP, attempt signups beyond the configured per-IP limit
  (see `beta-signup` route config). Then repeat from a second IP.
- **Expected**: The controller is deny-closed — on limiter failure/missing
  config the request is denied. Functional over-limit returns **429**.
  Different IPs get independent counters.
- **Unit**: `rateLimit.test.ts` (deny-closed branches, `allowPath`,
  `limitExceeded`), `buildEvalBody` shape.

### AM-06.2 Per-user AI budget — PASS expected (live)

- **Steps**: As A, drive AI-consuming routes (`/api/chat`, `/api/extract-text`,
  `/api/analyze-video`) past the per-user budget in a window.
- **Expected**: Functional over-limit returns **429**; limiter failure returns
  **429** deny-closed (never a free pass).
- **Unit**: `rateLimit.test.ts`.

### AM-06.3 Key derivation — PASS expected (unit)

- **Assertion**: `getClientIp` derives `x-forwarded-for` first IP correctly,
  falls back to `ip`, then `unknown`; `buildEvalBody` emits the Upstash array
  command with the correct key/limit/window.
- **Unit**: `rateLimit.test.ts` (`buildEvalBody`, `EVAL_SCRIPT`).

> **Live-only portion**: the actual Upstash Redis counters and the per-IP /
> per-user key wiring in the live routes. The limiter semantics and body shape
> are unit-covered.

---

## 10. AM-07 — Private route authz

### AM-07.1/2/3 chat / extract / upload reject anonymous — PASS expected

- **Steps**: Signed out, call `POST /api/chat`, `POST /api/extract-text`,
  `POST /api/upload`, `POST /api/analyze-video`, `POST /api/generate-title`,
  `POST /api/export-universe`.
- **Expected**: Each returns **401** before any route work (requireUser gate).
- **Unit**: `authz.test.ts` (`privateRouteAuthz`, `requireUser` anonymous →
  401). The live route-handler invocation is the only live portion.

---

## 11. Acceptance criteria

For each AM-01..07 cell record `PASS` / `FAIL` in the evidence table. The
acceptance criteria for BETA-12 are met when:

1. **Evidence table records each pass/fail** — the execution evidence lists
   every cell and its observed result.
2. **No P0/P1 findings remain** — any failed cell is either fixed+reopened, or
   escalated as a P0/P1 finding with remediation.
3. **Residual P2 risks accepted explicitly** — any P2 residual (e.g. functional
   429 vs deny-closed nuance, timing) is recorded with an explicit PM waiver.

---

## 12. Live vs unit coverage summary

| Matrix item | Unit-testable now | Requires live BETA-13 |
|---|---|---|
| AM-01 invite/OAuth | ticket crypto, redemption decision, status gates | OAuth redirect, DB rows |
| AM-02 anonymous | API 401 (requireUser) | middleware page redirect |
| AM-03 universe isolation | 409, clientId bound, payload validation | composite-key DB scoping (read/overwrite/delete) |
| AM-04 account switch | namespaced keys, legacy migration, in-memory drop | browser profile switch |
| AM-05 upload ownership | opaque pathname, SSRF reject | upload-record userId scoping, blob lifecycle |
| AM-06 rate limits | deny-closed, body shape, key derivation | live Upstash counters |
| AM-07 private route authz | requireUser 401 | live route handlers |

The pure-logic portions are encoded (and re-run) by `acceptanceMatrix.test.ts`.
The live-only portions are **not** fabricated here — they remain to be executed
against the BETA-13 preview, and their results recorded in the execution
evidence.