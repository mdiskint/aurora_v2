import {
  setPersistenceNamespace,
  getNamespace,
  isAnonymous,
  storageKeyMain,
  storageKeyBackup,
  importKeyConversation,
  importKeyHighlight,
  ANONYMOUS_NAMESPACE,
  LEGACY_CLAIM_MARKER,
  migrateLegacyLocalStorage,
  clearForeignImportKeys,
} from '../persistenceContext';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

// BETA-06: browser persistence namespaced by authenticated account id.
// Anonymous (signed out) keeps the legacy base keys so offline data and the
// localStorage -> IndexedDB migration are preserved.

setPersistenceNamespace(null);
assert(getNamespace() === ANONYMOUS_NAMESPACE, 'no user -> anonymous');
assert(isAnonymous() === true, 'anonymous flag true when signed out');

// Anonymous keeps legacy base keys untouched.
assert(storageKeyMain() === 'aurora-portal-data', 'anonymous main key unchanged');
assert(storageKeyBackup() === 'aurora-portal-data-backup', 'anonymous backup key unchanged');
assert(importKeyConversation() === 'astryon_import', 'anonymous conversation import key base');
assert(importKeyHighlight() === 'astryon_highlight_import', 'anonymous highlight import key base');

// Signed-in account A gets its own namespaced keys.
setPersistenceNamespace('user-A');
assert(getNamespace() === 'user-A', 'namespace is user id');
assert(isAnonymous() === false, 'not anonymous when signed in');
assert(storageKeyMain() === 'aurora-portal-data:user-A', 'A main key namespaced');
assert(storageKeyBackup() === 'aurora-portal-data-backup:user-A', 'A backup key namespaced');
assert(importKeyConversation() === 'astryon_import:user-A', 'A conversation import key namespaced');
assert(importKeyHighlight() === 'astryon_highlight_import:user-A', 'A highlight import key namespaced');

// Account B must never resolve to A's keys.
setPersistenceNamespace('user-B');
assert(storageKeyMain() === 'aurora-portal-data:user-B', 'B main key differs from A');
assert(storageKeyMain() !== 'aurora-portal-data:user-A', 'B main key != A main key');
assert(importKeyConversation() === 'astryon_import:user-B', 'B import key differs from A');
assert(importKeyConversation() !== 'astryon_import:user-A', 'B import key != A import key');

// Switching back to anonymous restores legacy keys.
setPersistenceNamespace(null);
assert(storageKeyMain() === 'aurora-portal-data', 'switch back to anonymous restores base key');

// ── BETA-06 P1-1: legacy (pre-isolation) local data migration on sign-in ──
// The migration functions touch localStorage / window; provide a minimal mock
// (node has no DOM by default).

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

const memStorage = new MemoryStorage();
(globalThis as any).localStorage = memStorage;
(globalThis as any).window = globalThis; // makes `typeof window !== 'undefined'` true

// Seed pre-BETA-06 base-key local data, then sign in as the FIRST account.
// The claiming account's sign-in migrates base data into its namespace and
// clears the legacy source so a different account can never re-migrate it.
setPersistenceNamespace(null);
memStorage.setItem('aurora-portal-data', '{"universeLibrary":{"u1":{}}}');
memStorage.setItem('aurora-portal-data-backup', 'backup-snapshot');

setPersistenceNamespace('user-A');
migrateLegacyLocalStorage();
assert(
  memStorage.getItem('aurora-portal-data:user-A') === '{"universeLibrary":{"u1":{}}}',
  'first sign-in migrates legacy main data into A namespace'
);
assert(
  memStorage.getItem('aurora-portal-data-backup:user-A') === 'backup-snapshot',
  'first sign-in migrates legacy backup into A namespace'
);
assert(memStorage.getItem('aurora-portal-data') === null, 'legacy base main source cleared after claim');
assert(memStorage.getItem('aurora-portal-data-backup') === null, 'legacy base backup source cleared after claim');
assert(memStorage.getItem(LEGACY_CLAIM_MARKER) === 'user-A', 'claim marker records the first account');

// A SECOND account must never receive the same legacy data, even though it is
// now signing in (the claimed data belongs to A).
setPersistenceNamespace('user-B');
migrateLegacyLocalStorage();
assert(memStorage.getItem('aurora-portal-data:user-B') === null, 'second account never receives A legacy main');
assert(memStorage.getItem('aurora-portal-data-backup:user-B') === null, 'second account never receives A legacy backup');

// Migration must never clobber data that already lives in the account's
// namespace (legacy base payload is superseded and its source cleared).
setPersistenceNamespace('user-A');
memStorage.setItem('aurora-portal-data:user-A', '{"universeLibrary":{"uFresh":{}}}');
memStorage.setItem('aurora-portal-data', '{"universeLibrary":{"uOld":{}}}');
migrateLegacyLocalStorage();
assert(
  memStorage.getItem('aurora-portal-data:user-A') === '{"universeLibrary":{"uFresh":{}}}',
  'migration keeps existing namespaced data, never clobbers it'
);
assert(memStorage.getItem('aurora-portal-data') === null, 'superseded legacy source cleared');

// ── BETA-06 P1-2: extension base-key import adoption on sign-in ─────────
// A pending import lands on the base key when the app's active-namespace
// marker was not yet published. Resolving the sign-in must ADOPT it into the
// account's namespace, never delete it.
setPersistenceNamespace(null);
memStorage.setItem('astryon_import', '{"messages":[{"role":"user","content":"hi"}]}');

setPersistenceNamespace('user-C');
clearForeignImportKeys();
assert(
  memStorage.getItem('astryon_import:user-C') === '{"messages":[{"role":"user","content":"hi"}]}',
  'base-key pending import adopted into resolving account namespace'
);
assert(memStorage.getItem('astryon_import') === null, 'base-key import source cleared after adoption');

// Unclaimed base-key highlight import is adopted the same way.
setPersistenceNamespace(null);
memStorage.setItem('astryon_highlight_import', '{"highlightedSection":"x"}');
setPersistenceNamespace('user-C');
clearForeignImportKeys();
assert(
  memStorage.getItem('astryon_highlight_import:user-C') === '{"highlightedSection":"x"}',
  'base-key highlight import adopted into resolving account namespace'
);
assert(memStorage.getItem('astryon_highlight_import') === null, 'base-key highlight source cleared after adoption');

// An initial anonymous session (no prior signed-in account) keeps the base
// import keys: they are the anonymous user's own landing spot.
setPersistenceNamespace(null);
clearForeignImportKeys();
memStorage.setItem('astryon_import', 'pending-anonymous');
setPersistenceNamespace(null); // anonymous -> anonymous: no account change
clearForeignImportKeys();
assert(memStorage.getItem('astryon_import') === 'pending-anonymous', 'anonymous session keeps its own base import');

// An import written to the anonymous-namespace key while signed out (the
// extension saw the marker as 'anonymous') is also an unclaimed pending
// import; on sign-in it is adopted into the account, never deleted.
setPersistenceNamespace(null);
clearForeignImportKeys(); // keep base import (anonymous session) then discard it
memStorage.removeItem('astryon_import'); // avoid base key shadowing the :anonymous key
memStorage.setItem('astryon_import:anonymous', '{"messages":[{"role":"user","content":"anon"}]}');
setPersistenceNamespace('user-E');
clearForeignImportKeys();
assert(
  memStorage.getItem('astryon_import:user-E') === '{"messages":[{"role":"user","content":"anon"}]}',
  'anonymous-namespace pending import adopted into signing-in account'
);
assert(memStorage.getItem('astryon_import:anonymous') === null, 'anonymous import source cleared after adoption');

// Explicit sign-out from a real account DOES clear its leftover base import so
// a later account can never adopt a previous account's leftover.
setPersistenceNamespace('user-D');
memStorage.setItem('astryon_import', 'leftover-from-D');
setPersistenceNamespace(null); // sign out of D
clearForeignImportKeys();
assert(memStorage.getItem('astryon_import') === null, 'explicit sign-out clears leftover base import');

console.log('✔ persistenceContext namespace + legacy migration tests passed');