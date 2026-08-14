/**
 * BETA-06: Browser persistence is isolated per authenticated account.
 *
 * All client-side persistence (localStorage, Dexie/IndexedDB, backups, and
 * extension imports) is namespaced by the authenticated user id so that one
 * account can never read another account's cached data in the same browser
 * after sign-out/sign-in or an account switch.
 *
 * The namespace is the authenticated user id, or `anonymous` when signed out.
 * Cloud (NeonDB) persistence is already scoped server-side by the session user
 * (BETA-02/BETA-05) and is unaffected here.
 *
 * Legacy (pre-BETA-06) data has no owner and lives in the anonymous namespace.
 * The base localStorage keys are preserved for the anonymous namespace so
 * existing offline data and the localStorage -> IndexedDB migration keep
 * working untouched.
 */

export const ANONYMOUS_NAMESPACE = 'anonymous';

/**
 * BETA-06 P1-1: marker recording which account claimed the pre-BETA-06 legacy
 * base-key data (localStorage `aurora-portal-data` + backup, and Dexie records
 * with no `ownerId`). Only the first account to sign in after the marker is
 * absent may migrate it; a later, different account must not re-migrate it.
 */
export const LEGACY_CLAIM_MARKER = 'aurora-legacy-data-claimed-by';

/**
 * localStorage marker the app writes so the browser extension can name-scope
 * its import keys to the current account. Only the namespace id is stored,
 * never user data.
 */
export const ACTIVE_NAMESPACE_MARKER = 'aurora-active-namespace';

// Legacy base import keys written by the browser extension. On sign-in they act
// as the unclaimed pre-auth landing spot and are adopted into the account that
// first resolves its namespace.
export const BASE_IMPORT_KEYS = ['astryon_import', 'astryon_highlight_import'] as const;

let currentNamespace: string = ANONYMOUS_NAMESPACE;

/** The namespace active before the most recent setPersistenceNamespace call. */
let previousNamespace: string = ANONYMOUS_NAMESPACE;

/**
 * Set the active persistence namespace from the authenticated user id.
 * Passing null/undefined switches to the anonymous namespace.
 */
export function setPersistenceNamespace(userId?: string | null): void {
  previousNamespace = currentNamespace;
  currentNamespace = userId ? String(userId) : ANONYMOUS_NAMESPACE;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ACTIVE_NAMESPACE_MARKER, currentNamespace);
    } catch {
      // marker write is best-effort; never block persistence on it
    }
  }
}

/** Current namespace; `anonymous` when signed out. */
export function getNamespace(): string {
  return currentNamespace;
}

/** True when the current namespace is the signed-out anonymous one. */
export function isAnonymous(): boolean {
  return currentNamespace === ANONYMOUS_NAMESPACE;
}

// ── localStorage keys ──────────────────────────────────────────────────
// Legacy base keys are kept for the anonymous namespace so offline data and
// the existing localStorage -> IndexedDB migration are preserved.

export function storageKeyMain(): string {
  return isAnonymous() ? 'aurora-portal-data' : `aurora-portal-data:${currentNamespace}`;
}

export function storageKeyBackup(): string {
  return isAnonymous()
    ? 'aurora-portal-data-backup'
    : `aurora-portal-data-backup:${currentNamespace}`;
}

export function importKeyConversation(): string {
  return isAnonymous() ? 'astryon_import' : `astryon_import:${currentNamespace}`;
}

export function importKeyHighlight(): string {
  return isAnonymous() ? 'astryon_highlight_import' : `astryon_highlight_import:${currentNamespace}`;
}

// ── Legacy data migration (BETA-06 P1-1) ────────────────────────────────

/**
 * Migrate pre-BETA-06 (legacy/unowned) localStorage data into the current
 * account's namespace on first sign-in. The base keys `aurora-portal-data` and
 * `aurora-portal-data-backup` were the pre-isolation storage; once a signed-in
 * account claims them, the base source is cleared and a claim marker records
 * the owner so a different account can never re-migrate them. Deterministic:
 * the first account to sign in after the marker is absent gets the data.
 *
 * No-op when signed out (anonymous already uses the base keys), or when the
 * legacy data was already claimed by a different account.
 */
export function migrateLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  const ns = currentNamespace;
  if (ns === ANONYMOUS_NAMESPACE) return;
  try {
    const baseMain = 'aurora-portal-data';
    const baseBackup = 'aurora-portal-data-backup';
    // Already claimed by a different account -> never re-migrate to this one.
    const claimedBy = localStorage.getItem(LEGACY_CLAIM_MARKER);
    if (claimedBy && claimedBy !== ns) return;

    const mainValue = localStorage.getItem(baseMain);
    const backupValue = localStorage.getItem(baseBackup);
    if (mainValue == null && backupValue == null) return; // nothing to migrate

    // Claim FIRST, then copy: the first account to reach this point owns the
    // legacy payload, even if a crash interrupts the copy (a later account
    // sees the marker and skips; this account retries on its next sign-in).
    localStorage.setItem(LEGACY_CLAIM_MARKER, ns);

    if (mainValue != null && localStorage.getItem(storageKeyMain()) == null) {
      localStorage.setItem(storageKeyMain(), mainValue);
    }
    if (backupValue != null && localStorage.getItem(storageKeyBackup()) == null) {
      localStorage.setItem(storageKeyBackup(), backupValue);
    }
    // Clear the legacy source so the same payload can never be re-migrated.
    localStorage.removeItem(baseMain);
    localStorage.removeItem(baseBackup);
  } catch {
    // best-effort migration; never block sign-in on it
  }
}

/**
 * Adopt an unclaimed base-key import into the current account's namespace and
 * clear foreign import keys.
 *
 * The base import keys (`astryon_import`, `astryon_highlight_import`) are the
 * pre-auth landing spot: the browser extension writes them when the app's
 * active-namespace marker was not yet published during a pending sign-in. On
 * namespace resolution for a signed-in account we ADOPT that pending import
 * into the account's namespace (never delete it blindly). Base keys are only
 * discarded on an explicit sign-out from a real account, when they are
 * genuinely leftover from that account. Other accounts' namespaced import keys
 * are always removed so a pending import can never leak across accounts.
 */
export function clearForeignImportKeys(): void {
  if (typeof window === 'undefined') return;
  const ns = currentNamespace;
  try {
    if (ns === ANONYMOUS_NAMESPACE) {
      // Signed out. If we just left a real account (explicit sign-out), its
      // base-key imports are leftover and must be dropped so a later account
      // can never adopt them. On an initial anonymous load (no prior account)
      // the base keys are the anonymous user's own data and are preserved.
      if (previousNamespace !== ANONYMOUS_NAMESPACE) {
        for (const baseKey of BASE_IMPORT_KEYS) localStorage.removeItem(baseKey);
      }
    } else {
      // Signed in: adopt any unclaimed import into this account's namespace,
      // then drop the unclaimed source (it is now owned by this account). Two
      // unclaimed landing spots exist: the base keys (extension fell back to
      // them because the marker was not published) and the anonymous-namespace
      // keys (extension saw the marker while the app was still signed out).
      // Both are unowned pending imports, never data of another signed-in
      // account, so adopting them cannot leak across accounts.
      for (const baseKey of BASE_IMPORT_KEYS) {
        const nsKey = `${baseKey}:${ns}`;
        const anonymousKey = `${baseKey}:${ANONYMOUS_NAMESPACE}`;
        const pending =
          localStorage.getItem(baseKey) ?? localStorage.getItem(anonymousKey);
        if (pending != null && localStorage.getItem(nsKey) == null) {
          localStorage.setItem(nsKey, pending);
          // Notify the explore page so it surfaces the newly-adopted import.
          try {
            window.dispatchEvent(
              new StorageEvent('storage', { key: nsKey, newValue: pending })
            );
          } catch {
            // best-effort; the import is already persisted at the namespaced key
          }
        }
        localStorage.removeItem(baseKey);
        localStorage.removeItem(anonymousKey);
      }
    }
    // Remove any other account's namespaced import keys.
    const keep = new Set([
      `${'astryon_import'}:${ns}`,
      `${'astryon_highlight_import'}:${ns}`,
    ]);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const isBase = (BASE_IMPORT_KEYS as readonly string[]).includes(k);
      const prefix = (BASE_IMPORT_KEYS as readonly string[]).find((b) =>
        k.startsWith(`${b}:`)
      );
      if (isBase || !prefix) continue; // base keys handled above; skip unrelated
      if (!keep.has(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // best-effort cleanup
  }
}
