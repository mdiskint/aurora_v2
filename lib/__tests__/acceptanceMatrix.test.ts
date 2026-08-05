/**
 * BETA-12 acceptance-matrix registrar.
 *
 * Encodes the BETA-12 two-account authorization acceptance matrix as data and
 * re-runs the pure-logic assertions for every cell that is unit-decidable.
 * Cells that require the live BETA-13 preview (real OAuth, real DB, real
 * Upstash, real Vercel Blob) are encoded with `liveOnly: true` and asserted to
 * be honestly flagged — so the matrix cannot silently claim a live-only
 * outcome as unit-covered.
 *
 * It also cross-checks the matrix's unit-coverage mapping: every referenced
 * existing test file must exist, so the matrix does not rot as the harness
 * evolves.
 *
 * Run with: npx tsx lib/__tests__/acceptanceMatrix.test.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireUser, type SessionResolver } from '../authz';
import { isBetaAccessGranted, BETA_SIGNUP_STATUS } from '../betaAccess';
import {
  validateInviteForRedemption,
  signInviteTicket,
  verifyInviteTicket,
  INVITE_TICKET_TTL_MS,
} from '../inviteRedemption';
import {
  shouldRejectVersionConflict,
  validateClientId,
  validateUniversePayload,
} from '../universeSchema';
import {
  buildOpaquePathname,
  isVercelBlobUrl,
} from '../uploadAuth';
import { buildEvalBody, EVAL_SCRIPT, getClientIp } from '../rateLimit';
import {
  setPersistenceNamespace,
  storageKeyMain,
  storageKeyBackup,
  importKeyConversation,
} from '../persistenceContext';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

const anonResolver: SessionResolver = async () => null;

// ============================================
// Matrix cell table
// ============================================

interface MatrixCell {
  id: string;
  area: string;
  scenario: string;
  expected: string;
  unitCovered: boolean;
  liveOnly: boolean;
  /** Unit test file(s) that cover the pure-logic portion of this cell. */
  unitTestFiles: string[];
  /** Optional pure-logic assertion to run now (unit-decidable cells). */
  verify?: () => void | Promise<void>;
}

const UNIT_DIR = __dirname;
const DOC_FILE = join(UNIT_DIR, 'BETA-12_ACCEPTANCE_MATRIX.md');

const MATRIX: MatrixCell[] = [
  // ---- AM-01 Signup / invite / OAuth / onboard ----
  {
    id: 'AM-01.1',
    area: 'AM-01',
    scenario: 'Approved + invited email signs in',
    expected: 'granted',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['inviteRedemption.test.ts', 'betaAccess.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      const future = new Date(now.getTime() + 60_000);
      const row = {
        status: BETA_SIGNUP_STATUS.APPROVED,
        revokedAt: null,
        inviteExpires: future,
      };
      assert(isBetaAccessGranted(row, now), 'AM-01.1 approved+unexpired granted');
      const v = validateInviteForRedemption(
        { ...row, redeemedAt: null, invitedEmail: 'a@x.io', email: 'a@x.io' },
        'a@x.io',
        now,
      );
      assert(v.ok === true, 'AM-01.1 approved+unredeemed+matching email valid');
    },
  },
  {
    id: 'AM-01.2',
    area: 'AM-01',
    scenario: 'Wrong email rejected',
    expected: 'denied',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['inviteRedemption.test.ts', 'betaAccess.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      const future = new Date(now.getTime() + 60_000);
      const v = validateInviteForRedemption(
        { status: BETA_SIGNUP_STATUS.APPROVED, revokedAt: null, inviteExpires: future, redeemedAt: null, invitedEmail: 'a@x.io', email: 'a@x.io' },
        'evil@x.io',
        now,
      );
      assert(v.ok === false, 'AM-01.2 mismatched invited email denied');
    },
  },
  {
    id: 'AM-01.3',
    area: 'AM-01',
    scenario: 'Expired invite rejected',
    expected: 'denied',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['betaAccess.test.ts', 'inviteRedemption.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      const past = new Date(now.getTime() - 60_000);
      assert(
        !isBetaAccessGranted({ status: BETA_SIGNUP_STATUS.APPROVED, revokedAt: null, inviteExpires: past }, now),
        'AM-01.3 expired invite denied',
      );
    },
  },
  {
    id: 'AM-01.4',
    area: 'AM-01',
    scenario: 'Revoked invite rejected',
    expected: 'denied',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['betaAccess.test.ts', 'betaAdmin.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      assert(
        !isBetaAccessGranted({ status: BETA_SIGNUP_STATUS.REVOKED, revokedAt: now, inviteExpires: null }, now),
        'AM-01.4 revoked invite denied',
      );
    },
  },
  {
    id: 'AM-01.5',
    area: 'AM-01',
    scenario: 'Used (single-use) invite rejected',
    expected: 'denied',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['inviteRedemption.test.ts', 'betaAccess.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      const future = new Date(now.getTime() + 60_000);
      const v = validateInviteForRedemption(
        { status: BETA_SIGNUP_STATUS.REDEEMED, revokedAt: null, inviteExpires: future, redeemedAt: now, invitedEmail: 'a@x.io', email: 'a@x.io' },
        'a@x.io',
        now,
      );
      assert(v.ok === false, 'AM-01.5 redeemed invite denied');
    },
  },
  {
    id: 'AM-01.6',
    area: 'AM-01',
    scenario: 'Invite ticket tamper/expiry rejected',
    expected: 'denied',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['inviteRedemption.test.ts'],
    verify() {
      const now = new Date('2026-08-04T00:00:00Z');
      const secret = 'test-secret-for-invite-tickets';
      const payload = { tokenHash: 'a'.repeat(64), invitedEmail: 'invitee@example.com' };
      const ticket = signInviteTicket(payload, secret, now);
      assert(ticket.includes('.'), 'AM-01.6 ticket is signed dot-separated value');

      // Tamper with the payload (keep signature) -> HMAC must fail.
      const [, sigArg] = ticket.split('.');
      const tamperedBody = Buffer.from(
        JSON.stringify({ tokenHash: payload.tokenHash, invitedEmail: 'evil@example.com', exp: now.getTime() + INVITE_TICKET_TTL_MS }),
      ).toString('base64url');
      assert(verifyInviteTicket(`${tamperedBody}.${sigArg}`, secret, now) === null, 'AM-01.6 payload tamper rejected');

      // Wrong secret -> must fail.
      assert(verifyInviteTicket(ticket, 'different-secret', now) === null, 'AM-01.6 wrong secret rejected');

      // Expired ticket -> must fail; just-before-expiry still valid.
      const after = new Date(now.getTime() + INVITE_TICKET_TTL_MS + 1);
      assert(verifyInviteTicket(ticket, secret, after) === null, 'AM-01.6 expired ticket rejected');
      const before = new Date(now.getTime() + INVITE_TICKET_TTL_MS - 1);
      assert(verifyInviteTicket(ticket, secret, before) !== null, 'AM-01.6 ticket valid before expiry');
    },
  },

  // ---- AM-02 Anonymous access ----
  {
    id: 'AM-02.1',
    area: 'AM-02',
    scenario: 'Protected pages redirect to /auth/signin',
    expected: 'redirect',
    unitCovered: false,
    liveOnly: true,
    unitTestFiles: ['../../middleware.ts'],
  },
  {
    id: 'AM-02.2',
    area: 'AM-02',
    scenario: 'Protected API returns 401 for anonymous',
    expected: '401',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['authz.test.ts', 'universeSecurity.test.ts'],
    async verify() {
      // requireUser is the exact gate every protected API short-circuits on.
      const anon = await requireUser(anonResolver);
      assert(anon.response !== null && anon.response.status === 401, 'AM-02.2 anonymous protected API is 401');
      assert(anon.user === null, 'AM-02.2 anonymous carries no user');
    },
  },

  // ---- AM-03 Universe CRUD isolation ----
  {
    id: 'AM-03.1',
    area: 'AM-03',
    scenario: 'A cannot read B universe',
    expected: 'no cross-user read',
    unitCovered: false,
    liveOnly: true,
    unitTestFiles: ['universeSecurity.test.ts', 'universeRoute.test.ts'],
  },
  {
    id: 'AM-03.2',
    area: 'AM-03',
    scenario: 'A cannot overwrite B universe',
    expected: 'no overwrite',
    unitCovered: false,
    liveOnly: true,
    unitTestFiles: ['universeRoute.test.ts', 'universeSecurity.test.ts'],
  },
  {
    id: 'AM-03.3',
    area: 'AM-03',
    scenario: 'A cannot delete B universe',
    expected: 'no delete',
    unitCovered: false,
    liveOnly: true,
    unitTestFiles: ['universeRoute.test.ts'],
  },
  {
    id: 'AM-03.4',
    area: 'AM-03',
    scenario: 'Version conflict -> 409',
    expected: '409 on stale write; ok on current',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['universeSecurity.test.ts', 'universeRoute.test.ts'],
    verify() {
      assert(shouldRejectVersionConflict(3, 4) === true, 'AM-03.4 stale version conflicts (409)');
      assert(shouldRejectVersionConflict(4, 4) === false, 'AM-03.4 equal version ok');
      assert(shouldRejectVersionConflict(5, 4) === false, 'AM-03.4 newer version ok');
      assert(shouldRejectVersionConflict(undefined, 4) === false, 'AM-03.4 missing ver ok');
    },
  },
  {
    id: 'AM-03.5',
    area: 'AM-03',
    scenario: 'clientId bounded',
    expected: '400 on empty/overlong/unsafe id',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['universeSecurity.test.ts', 'universeRoute.test.ts'],
    verify() {
      assert(validateClientId('') === 'clientId must be a non-empty string', 'AM-03.5 empty id rejected');
      assert(validateClientId('x'.repeat(129)) !== null, 'AM-03.5 overlong id rejected');
      assert(validateClientId('bad id!') !== null, 'AM-03.5 unsafe id rejected');
      assert(validateClientId('known-universe-id') === null, 'AM-03.5 safe id accepted');
      assert(validateUniversePayload({ clientId: 'a', data: 42 }).ok === false, 'AM-03.5 non-object data rejected');
    },
  },

  // ---- AM-04 Account switch / browser cache isolation ----
  {
    id: 'AM-04.1',
    area: 'AM-04',
    scenario: 'Namespaced storage keys per account',
    expected: 'A != B keys',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['persistenceContext.test.ts', 'persistenceContextStore.test.ts'],
    verify() {
      setPersistenceNamespace('user-A');
      const aKey = storageKeyMain();
      setPersistenceNamespace('user-B');
      const bKey = storageKeyMain();
      assert(aKey === 'aurora-portal-data:user-A', 'AM-04.1 A main key namespaced');
      assert(bKey === 'aurora-portal-data:user-B', 'AM-04.1 B main key namespaced');
      assert(aKey !== bKey, 'AM-04.1 A and B keys differ');
      assert(storageKeyBackup() === 'aurora-portal-data-backup:user-B', 'AM-04.1 B backup key namespaced');
      setPersistenceNamespace(null);
    },
  },
  {
    id: 'AM-04.2',
    area: 'AM-04',
    scenario: 'Legacy data not crossed between accounts',
    expected: 'first account claims; second gets none',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['persistenceContext.test.ts'],
    verify() {
      // Key-level cross-account separation is pure; the legacy migration is
      // fully asserted in persistenceContext.test.ts. Here we assert the
      // namespace keys are distinct so a second account cannot read a first
      // account's key.
      setPersistenceNamespace('user-A');
      const a = storageKeyMain();
      setPersistenceNamespace('user-B');
      assert(storageKeyMain() !== a, 'AM-04.2 B cannot reference A key');
      setPersistenceNamespace(null);
    },
  },
  {
    id: 'AM-04.3',
    area: 'AM-04',
    scenario: 'In-memory library dropped on account switch',
    expected: 'no cross-account save',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['persistenceContextStore.test.ts'],
    verify() {
      // The store-level drop is asserted end-to-end in
      // persistenceContextStore.test.ts. Here we confirm the account-scoped
      // import key is distinct so a later account cannot inherit a prior
      // account's pending import.
      setPersistenceNamespace('user-A');
      const aImp = importKeyConversation();
      setPersistenceNamespace('user-B');
      assert(importKeyConversation() !== aImp, 'AM-04.3 B import key differs from A');
      setPersistenceNamespace(null);
    },
  },

  // ---- AM-05 Upload / analyze ownership ----
  {
    id: 'AM-05.1',
    area: 'AM-05',
    scenario: 'Opaque user-scoped blob pathname',
    expected: 'videos/<uuid>.<ext>',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['uploadAuth.test.ts'],
    verify() {
      const id = '12345678-1234-4234-8234-123456789abc';
      assert(buildOpaquePathname(id, 'MP4') === `videos/${id}.mp4`, 'AM-05.1 opaque pathname video/<uuid>.mp4');
    },
  },
  {
    id: 'AM-05.2',
    area: 'AM-05',
    scenario: 'SSRF / arbitrary URL rejected',
    expected: 'reject before network I/O',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['uploadAuth.test.ts'],
    verify() {
      assert(!isVercelBlobUrl('http://169.254.169.254/latest/meta-data/'), 'AM-05.2 AWS metadata rejected');
      assert(!isVercelBlobUrl('https://evil.com/x.mp4'), 'AM-05.2 arbitrary host rejected');
      assert(isVercelBlobUrl('https://abc.public.blob.vercel-storage.com/videos/u.mp4'), 'AM-05.2 vercel blob accepted');
    },
  },
  {
    id: 'AM-05.3',
    area: 'AM-05',
    scenario: 'A cannot analyze/delete B blob',
    expected: '404/403 for non-owner',
    unitCovered: false,
    liveOnly: true,
    unitTestFiles: ['uploadAuth.test.ts'],
  },

  // ---- AM-06 Rate limits ----
  {
    id: 'AM-06.1',
    area: 'AM-06',
    scenario: 'Per-IP signup limit',
    expected: '429 functional; deny-closed on failure',
    unitCovered: true,
    liveOnly: true,
    unitTestFiles: ['rateLimit.test.ts'],
    verify() {
      // The limiter semantics are encoded here; the live per-IP wiring is live-only.
      const body = JSON.parse(buildEvalBody('rl:signup:ip:1.2.3.4', 10, 3600)) as unknown[];
      assert(body[0] === 'EVAL', 'AM-06.1 command verb EVAL');
      assert(body[4] === '10', 'AM-06.1 limit cast to string');
      assert(body[5] === '3600', 'AM-06.1 window cast to string');
      assert(EVAL_SCRIPT.includes("return {0, current, ttl}"), 'AM-06.1 deny shape');
    },
  },
  {
    id: 'AM-06.2',
    area: 'AM-06',
    scenario: 'Per-user AI budget',
    expected: '429 functional; deny-closed on failure',
    unitCovered: true,
    liveOnly: true,
    unitTestFiles: ['rateLimit.test.ts'],
    verify() {
      const body = JSON.parse(buildEvalBody('rl:chat:user:u1', 100, 86400)) as unknown[];
      assert(body[3] === 'rl:chat:user:u1', 'AM-06.2 per-user key');
      assert(EVAL_SCRIPT.includes("redis.call('INCR'"), 'AM-06.2 atomic INCR');
    },
  },
  {
    id: 'AM-06.3',
    area: 'AM-06',
    scenario: 'Rate-limit key derivation',
    expected: 'x-forwarded-for first IP; fallback ip; unknown; body shape',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['rateLimit.test.ts'],
    verify() {
      // buildEvalBody emits the exact Upstash array command with correct key/limit/window.
      const body = JSON.parse(buildEvalBody('rl:signup:ip:1.2.3.4', 10, 3600)) as unknown[];
      assert(body.length === 6, 'AM-06.3 array length 6');
      assert(body[0] === 'EVAL', 'AM-06.3 command verb EVAL');
      assert(body[1] === EVAL_SCRIPT, 'AM-06.3 script element matches EVAL_SCRIPT');
      assert(body[2] === '1', 'AM-06.3 numkeys as string "1"');
      assert(body[3] === 'rl:signup:ip:1.2.3.4', 'AM-06.3 key');
      assert(body[4] === '10', 'AM-06.3 limit cast to string');
      assert(body[5] === '3600', 'AM-06.3 window cast to string');

      // getClientIp derives x-forwarded-for first IP, falls back to ip, then unknown.
      const forwarded = new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
      assert(getClientIp(forwarded) === '1.2.3.4', 'AM-06.3 x-forwarded-for first IP');
      const ipFallback = new Request('https://x') as Request & { ip?: string };
      ipFallback.ip = '9.9.9.9';
      assert(getClientIp(ipFallback) === '9.9.9.9', 'AM-06.3 ip fallback');
      assert(getClientIp(new Request('https://x')) === 'unknown', 'AM-06.3 unknown fallback');
    },
  },

  // ---- AM-07 Private route authz ----
  {
    id: 'AM-07.1',
    area: 'AM-07',
    scenario: 'chat/extract/upload anonymous -> 401',
    expected: '401 before route work',
    unitCovered: true,
    liveOnly: false,
    unitTestFiles: ['authz.test.ts'],
    async verify() {
      const anon = await requireUser(anonResolver);
      assert(anon.response !== null && anon.response.status === 401, 'AM-07.1 anonymous chat/extract/upload route is 401');
    },
  },
];

// ============================================
// Matrix integrity checks
// ============================================

function checkMatrixIntegrity(): void {
  const ids = new Set<string>();
  for (const cell of MATRIX) {
    assert(!ids.has(cell.id), `duplicate matrix cell id ${cell.id}`);
    ids.add(cell.id);

    // Every live-only cell that claims unit coverage must have a real
    // pure-logic sub-assertion (verify) so the unit coverage is genuine, not
    // overstated. A fully live-only cell (no unit sub-assertion) must not
    // claim unit coverage.
    if (cell.liveOnly && cell.unitCovered) {
      assert(cell.verify !== undefined, `${cell.id}: live-only cell claims unit coverage but has no offline verify()`);
    } else if (!cell.verify) {
      assert(!cell.unitCovered, `${cell.id}: cell with no verify() must not claim unit coverage`);
    }

    // Every referenced unit test file must exist.
    for (const ref of cell.unitTestFiles) {
      const p = join(UNIT_DIR, ref);
      assert(existsSync(p), `${cell.id}: referenced unit file missing: ${ref}`);
    }
  }

  // Every matrix area AM-01..AM-07 must be present.
  const areas = new Set(MATRIX.map((c) => c.area));
  for (const a of ['AM-01', 'AM-02', 'AM-03', 'AM-04', 'AM-05', 'AM-06', 'AM-07']) {
    assert(areas.has(a), `matrix missing area ${a}`);
  }
}

/**
 * Doc <-> registrar cell-id parity.
 *
 * Parses the `### AM-<id>` headings out of BETA-12_ACCEPTANCE_MATRIX.md and
 * diffs them against the MATRIX ids, so a cell added to (or dropped from) the
 * doc can never drift silently out of the registrar (or vice versa). This
 * replaces the silent omission with an explicit failure.
 */
function checkDocParity(): void {
  assert(existsSync(DOC_FILE), 'acceptance matrix doc missing');
  const text = readFileSync(DOC_FILE, 'utf8');
  const docIds = new Set<string>();
  const re = /^###\s+(AM-\d+\.\d+)\b/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) docIds.add(m[1]);

  const matrixIds = new Set(MATRIX.map((c) => c.id));
  for (const id of docIds) {
    assert(matrixIds.has(id), `doc cell ${id} not registered in MATRIX`);
  }
  for (const id of matrixIds) {
    assert(docIds.has(id), `MATRIX cell ${id} missing from doc`);
  }
}

// ============================================
// Runner
// ============================================

async function main(): Promise<void> {
  let failures = 0;

  // 1. Matrix integrity.
  try {
    checkMatrixIntegrity();
    console.log(`PASS matrixIntegrity (${MATRIX.length} cells)`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL matrixIntegrity: ${(err as Error).message}`);
  }

  // 1b. Doc <-> registrar cell-id parity.
  try {
    checkDocParity();
    console.log(`PASS docParity (${MATRIX.length} cells match doc)`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL docParity: ${(err as Error).message}`);
  }

  // 2. Run each unit-decidable cell's pure-logic assertion.
  for (const cell of MATRIX) {
    if (cell.liveOnly) {
      console.log(`SKIP ${cell.id} ${cell.scenario} (live-only; run in BETA-13 preview)`);
      continue;
    }
    try {
      await cell.verify?.();
      console.log(`PASS ${cell.id} ${cell.scenario}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${cell.id} ${cell.scenario}: ${(err as Error).message}`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} acceptance-matrix group(s) failed`);
    process.exit(1);
  }
  console.log(`All acceptance-matrix unit-decidable assertions passed; ${MATRIX.filter((c) => c.liveOnly).length} cell(s) deferred to BETA-13`);
}

void main();