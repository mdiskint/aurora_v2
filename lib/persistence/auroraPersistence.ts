export const AURORA_STORAGE_KEY = 'aurora-portal-data';
export const AURORA_BACKUP_KEY = 'aurora-portal-data-backup';

export type AuroraPersistedSnapshot = {
  universeLibrary: Record<string, any>;
  originalSnapshots?: Record<string, any>;
  folders?: Record<string, any>;
  activatedConversations?: unknown[];
  timestamp: number;
};

export function buildAuroraSnapshot(state: {
  universeLibrary: Record<string, any>;
  originalSnapshots?: Record<string, any>;
  folders?: Record<string, any>;
  activatedConversations?: unknown[];
}): AuroraPersistedSnapshot {
  return {
    universeLibrary: state.universeLibrary,
    originalSnapshots: state.originalSnapshots,
    folders: state.folders,
    activatedConversations: state.activatedConversations,
    timestamp: Date.now(),
  };
}

export function serializeAuroraSnapshot(snapshot: AuroraPersistedSnapshot) {
  const serialized = JSON.stringify(snapshot);

  if (
    serialized === 'null' ||
    serialized === '{}' ||
    serialized === '{"universeLibrary":{},"activatedConversations":[]}'
  ) {
    throw new Error('Serialized Aurora snapshot is empty or null');
  }

  return serialized;
}

export function parseAuroraSnapshot(raw: string) {
  return JSON.parse(raw) as Partial<AuroraPersistedSnapshot>;
}

export function getStoredAuroraSnapshot() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(AURORA_STORAGE_KEY);
}

export function writeStoredAuroraSnapshot(serialized: string) {
  localStorage.setItem(AURORA_STORAGE_KEY, serialized);
}

export function wouldOverwriteExistingLibraryWithEmpty(existingRaw: string | null, nextUniverseCount: number) {
  if (!existingRaw || existingRaw === 'null') return false;

  const existing = parseAuroraSnapshot(existingRaw);
  const existingCount = Object.keys(existing.universeLibrary || {}).length;
  return existingCount > 0 && nextUniverseCount === 0;
}

export function backupStoredLibrary() {
  const current = getStoredAuroraSnapshot();

  if (current && current !== 'null') {
    localStorage.setItem(AURORA_BACKUP_KEY, current);
    return true;
  }

  return false;
}

export function recoverStoredLibraryFromBackup() {
  const backup = localStorage.getItem(AURORA_BACKUP_KEY);

  if (!backup || backup === 'null') {
    return { recovered: false, reason: 'No backup found' };
  }

  try {
    const parsed = parseAuroraSnapshot(backup);
    if (!parsed.universeLibrary) {
      return { recovered: false, reason: 'Backup is corrupted (missing universeLibrary)' };
    }
  } catch {
    return { recovered: false, reason: 'Backup is corrupted (invalid JSON)' };
  }

  writeStoredAuroraSnapshot(backup);
  return { recovered: true };
}

export function createDebouncedPersistence<T>(
  persistNow: (snapshot: T) => Promise<void> | void,
  delayMs = 500
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingSnapshot: T | null = null;

  return {
    schedule(snapshot: T) {
      pendingSnapshot = snapshot;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!pendingSnapshot) return;
        const snapshotToPersist = pendingSnapshot;
        pendingSnapshot = null;
        timer = null;
        await persistNow(snapshotToPersist);
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!pendingSnapshot) return;
      const snapshotToPersist = pendingSnapshot;
      pendingSnapshot = null;
      await persistNow(snapshotToPersist);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pendingSnapshot = null;
    },
  };
}
