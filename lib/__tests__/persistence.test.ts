import assert from 'node:assert/strict';
import {
  AURORA_BACKUP_KEY,
  AURORA_STORAGE_KEY,
  backupStoredLibrary,
  buildAuroraSnapshot,
  createDebouncedPersistence,
  getStoredAuroraSnapshot,
  parseAuroraSnapshot,
  recoverStoredLibraryFromBackup,
  serializeAuroraSnapshot,
  wouldOverwriteExistingLibraryWithEmpty,
  writeStoredAuroraSnapshot,
} from '../persistence/auroraPersistence';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function run() {
  console.log('\n=== Persistence Tests ===\n');

  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });

  try {
    const snapshot = buildAuroraSnapshot({
      universeLibrary: { universe: { title: 'Existing universe' } },
      folders: { default: { name: 'Uncategorized' } },
      activatedConversations: [],
    });
    const serialized = serializeAuroraSnapshot(snapshot);

    writeStoredAuroraSnapshot(serialized);
    assert.equal(getStoredAuroraSnapshot(), serialized);
    assert.equal(parseAuroraSnapshot(serialized).universeLibrary?.universe.title, 'Existing universe');
    assert.equal(wouldOverwriteExistingLibraryWithEmpty(serialized, 0), true);
    assert.equal(wouldOverwriteExistingLibraryWithEmpty(serialized, 1), false);
    assert.throws(
      () => serializeAuroraSnapshot({ universeLibrary: null } as never),
      /valid universe library/
    );
    console.log('✓ Snapshot serialization and empty-overwrite protection');

    assert.equal(backupStoredLibrary(), true);
    const validBackup = storage.getItem(AURORA_BACKUP_KEY);
    storage.setItem(AURORA_STORAGE_KEY, '{broken');
    assert.equal(backupStoredLibrary(), false);
    assert.equal(storage.getItem(AURORA_BACKUP_KEY), validBackup);

    const recovery = recoverStoredLibraryFromBackup();
    assert.equal(recovery.recovered, true);
    assert.equal(storage.getItem(AURORA_STORAGE_KEY), validBackup);
    console.log('✓ Corruption-safe backup and recovery');

    const writes: number[] = [];
    const debounced = createDebouncedPersistence<number>(value => {
      writes.push(value);
    }, 10);

    debounced.schedule(1);
    debounced.schedule(2);
    assert.equal(debounced.hasPending(), true);
    await wait(30);
    assert.deepEqual(writes, [2]);
    assert.equal(debounced.hasPending(), false);

    debounced.schedule(3);
    await debounced.flush();
    assert.deepEqual(writes, [2, 3]);

    debounced.schedule(4);
    debounced.cancel();
    await wait(20);
    assert.deepEqual(writes, [2, 3]);

    let capturedError: unknown;
    const failing = createDebouncedPersistence(
      async () => {
        throw new Error('write failed');
      },
      5,
      error => {
        capturedError = error;
      }
    );
    failing.schedule('snapshot');
    await wait(20);
    assert.match(String(capturedError), /write failed/);
    console.log('✓ Debounce, flush, cancellation, and async error handling');
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  }

  console.log('\n=== All persistence tests passed! ===\n');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
