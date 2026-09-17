// This test exercises the real store (`lib/store.ts`) and the real
// persistence-context module together. Node has no DOM/Dexie/cloud backend, so
// localStorage is mocked up front (before any store call) and Dexie/cloud
// calls degrade to their built-in safe fallbacks (empty Dexie, caught cloud
// error); the localStorage-driven paths that matter for the account boundary
// run for real.
//
// BETA-06 P1: a stale in-memory library must never cross the account boundary
// on write. `setUserContext` now synchronously drops the previous account's
// in-memory library and blocks every save/sync path until the target
// namespace is rehydrated.

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
(globalThis as any).window = globalThis;
(globalThis as any).alert = () => {};

import { useCanvasStore } from '../store';
import { getNamespace } from '../persistenceContext';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

function store() {
  return useCanvasStore.getState();
}

const A_KEY = 'aurora-portal-data:user-A';
const B_KEY = 'aurora-portal-data:user-B';
const C_KEY = 'aurora-portal-data:user-C';

async function main() {
  // ── Scenario 1: A hydrates its library into memory, then switch to B ──
  const aPayload = {
    universeLibrary: {
      'univ-A1': {
        title: 'A private universe',
        nexuses: [],
        nodes: {},
        createdAt: 1,
        lastModified: 1,
        folderId: 'default',
      },
      'univ-A2': {
        title: 'A second private universe',
        nexuses: [],
        nodes: {},
        createdAt: 2,
        lastModified: 2,
        folderId: 'default',
      },
    },
  };
  memStorage.setItem(A_KEY, JSON.stringify(aPayload));

  // Sign in as A through the real path (namespace + rehydration).
  await useCanvasStore.getState().setUserContext('user-A');
  assert(getNamespace() === 'user-A', 'context is A after A sign-in');
  assert(
    Object.keys(store().universeLibrary).length === 2,
    'A hydrated its localStorage library into memory'
  );
  assert('univ-A1' in store().universeLibrary, 'A memory holds A universe 1');
  assert(
    (store().universeLibrary['univ-A1'] as any).title === 'A private universe',
    'A memory holds A universe 1 payload'
  );
  assert(store().isPersistenceTransitioning === false, 'transition settled for A');

  // Same-tab switch to B (sign-out/sign-in or account switch).
  await useCanvasStore.getState().setUserContext('user-B');
  assert(getNamespace() === 'user-B', 'context is B after switch');
  assert(
    Object.keys(store().universeLibrary).length === 0,
    'B in-memory library is empty after switch'
  );
  assert(
    !('univ-A1' in store().universeLibrary),
    'B in-memory library has none of A data (1)'
  );
  assert(
    !('univ-A2' in store().universeLibrary),
    'B in-memory library has none of A data (2)'
  );
  assert(store().isPersistenceTransitioning === false, 'transition settled for B');
  assert(store().lastHydratedNamespace === 'user-B', 'hydration recorded for B');

  // ── Scenario 2: B cannot write A's data ──────────────────────────────
  // A's persisted namespace payload must survive B-context saves untouched.
  const aKeyBefore = memStorage.getItem(A_KEY);
  const aBackupBefore = memStorage.getItem('aurora-portal-data-backup:user-A');

  store().saveToLocalStorage(); // autosave path fires under B context
  const bSavedRaw = memStorage.getItem(B_KEY);
  assert(bSavedRaw !== null, 'B-context save wrote into B namespace');
  const bSaved = JSON.parse(bSavedRaw!);
  assert(
    !('univ-A1' in bSaved.universeLibrary),
    'B namespace contains none of A data after B save'
  );
  assert(
    !('univ-A2' in bSaved.universeLibrary),
    'B namespace contains none of A data after B save (2)'
  );
  assert(
    memStorage.getItem(A_KEY) === aKeyBefore,
    'A localStorage main key untouched by B save'
  );
  assert(
    memStorage.getItem('aurora-portal-data-backup:user-A') === aBackupBefore,
    'A localStorage backup key untouched by B save'
  );

  // Sanity: switching back to A restores A's library from A's namespace.
  await useCanvasStore.getState().setUserContext('user-A');
  assert('univ-A1' in store().universeLibrary, 'switching back to A restores A library');
  assert(
    Object.keys(store().universeLibrary).length === 2,
    'A library fully restored on re-hydration'
  );

  // ── Scenario 3: saves are blocked during the namespace transition ────
  const switchPromise = useCanvasStore.getState().setUserContext('user-C'); // NOT awaited yet
  assert(store().isPersistenceTransitioning === true, 'transition flag set synchronously');
  assert(store().isStoreInitialized === false, 'store re-locked during transition');
  assert(
    Object.keys(store().universeLibrary).length === 0,
    'in-memory library cleared synchronously on switch'
  );

  // Autosave / explicit save fired mid-transition -> must be refused, and must
  // not write into the target namespace or force initialization.
  store().saveToLocalStorage();
  assert(memStorage.getItem(C_KEY) === null, 'saveToLocalStorage blocked during transition');
  store().saveCurrentUniverse();
  assert(
    store().isStoreInitialized === false,
    'saveCurrentUniverse cannot force initialization during transition'
  );
  assert(
    memStorage.getItem('aurora-portal-data:user-C') === null,
    'saveCurrentUniverse wrote nothing during transition'
  );

  // Explicit sync mid-transition is guarded too (dirty set is cleared anyway).
  await store().syncToCloud();

  await switchPromise;
  assert(store().isPersistenceTransitioning === false, 'transition cleared after rehydration');
  assert(store().isStoreInitialized === true, 'store re-initialized after rehydration');
  assert(store().lastHydratedNamespace === 'user-C', 'hydration recorded for C');
  assert(
    Object.keys(store().universeLibrary).length === 0,
    'C starts with its own empty library'
  );

  // ── Scenario 4: in-flight cloud sync must not cross the account boundary ──
  // Account A's library is dirty and a sync is mid-flight when the session
  // switches A→B. The sync loop must abort immediately: no remaining A
  // universe may be uploaded into B's session, and the in-flight result must
  // never be applied to B's library.
  const originalFetch = (globalThis as any).fetch;
  const cloudPosts: string[] = [];
  const cloudBodies: any[] = [];
  const inFlightResolvers: Array<(r: any) => void> = [];
  (globalThis as any).fetch = (url: any, init?: any) => {
    const method = (init && init.method) || 'GET';
    if (method === 'GET') {
      // Cloud load during rehydration: no cloud universes.
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
    const body = JSON.parse((init as any).body);
    cloudPosts.push(body.clientId);
    cloudBodies.push(body);
    if (cloudPosts.length === 1) {
      // First upload stays in flight until the test decides (simulates a slow
      // network request racing an account switch).
      return new Promise<Response>((resolve) => inFlightResolvers.push(resolve));
    }
    // Any further upload would be the bug under test (A data into B's
    // session); resolve ok so a missing guard would visibly continue the loop.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ version: 999 }),
    });
  };

  // Re-hydrate A and mark A's universes dirty through the real save path.
  await useCanvasStore.getState().setUserContext('user-A');
  assert(getNamespace() === 'user-A', 'context is A for in-flight sync scenario');
  await store().saveToLocalStorage(); // marks every A universe dirty

  // Start the sync WITHOUT awaiting: the first upload is now in flight.
  const syncPromise = store().syncToCloud();
  assert(cloudPosts.length === 1, 'first A universe upload initiated');
  assert(cloudPosts[0] === 'univ-A1', 'first upload is A universe 1');

  // Session switches to B while the first upload is still pending.
  const switchPromise4 = store().setUserContext('user-B');
  assert(getNamespace() === 'user-B', 'context switched to B mid-sync');

  // The in-flight upload finally completes (the real server would scope it by
  // whatever session processes it under; the client must not start the next
  // upload and must not apply the result to the new account).
  inFlightResolvers[0]({
    ok: true,
    status: 200,
    json: async () => ({ version: 5 }),
  });

  await switchPromise4;
  await syncPromise;

  // The loop aborted: A's second universe was never uploaded to B's session.
  assert(
    cloudPosts.length === 1,
    'sync loop aborted after A→B switch: only the in-flight upload ran'
  );
  assert(
    cloudPosts[0] === 'univ-A1',
    'no A universe uploaded after the switch'
  );
  assert(
    cloudBodies[0].data.title === 'A private universe',
    'the single in-flight upload carried A data (initiated under A)'
  );
  assert(
    !('univ-A1' in store().universeLibrary) &&
      !('univ-A2' in store().universeLibrary),
    'B in-memory library has none of A universes after raced sync'
  );
  const bSavedAfterSync = memStorage.getItem(B_KEY);
  if (bSavedAfterSync) {
    const bData = JSON.parse(bSavedAfterSync);
    assert(
      !('univ-A1' in bData.universeLibrary),
      'B namespace contains no A universe after raced sync'
    );
    assert(
      !('univ-A2' in bData.universeLibrary),
      'B namespace contains no A universe 2 after raced sync'
    );
  }

  // Restore the real fetch for anything that follows.
  (globalThis as any).fetch = originalFetch;

  console.log('✔ persistenceContext store boundary + transition-block tests passed');
}

main().then(
  () => {},
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
