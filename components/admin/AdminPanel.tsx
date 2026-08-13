'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ADMIN_FILTER_CHIPS,
  getAvailableAdminActions,
  getStatusBadgeClasses,
  getStatusLabel,
  type BetaAdminUiAction,
} from '@/lib/betaAdminUi';

/** A beta signup row as serialized across the server boundary (ISO strings for dates). */
export type SignupRow = {
  id: string;
  email: string;
  status: string;
  invitedEmail: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  redeemedAt: string | null;
  inviteExpires: string | null;
  createdAt: string;
};

/** A managed Admin-table row (operator identity source #2). */
type AdminRow = {
  id: string;
  email: string;
  addedBy: string;
  createdAt: string;
};

/** A serialized AdminActionLog row for the read-only audit view. */
type AuditRow = {
  id: string;
  operatorEmail: string;
  action: string;
  signupId: string | null;
  targetEmail: string;
  ip: string | null;
  createdAt: string;
};

type Filter = 'all' | string;
type Tab = 'applications' | 'admins' | 'audit';

/**
 * OPS-06 operator /admin client dashboard.
 *
 * Server-gated by the /admin page (requireOperator); this component only
 * renders for an authenticated operator. Three tabs: Applications (beta
 * signup approve/revoke/reinvite), Admins (manage the Admin table), and Audit
 * Log (read-only view of operator actions). Emails are rendered as React text
 * (auto-escaped) — never dangerouslySetInnerHTML.
 */
export default function AdminPanel({ initialSignups }: { initialSignups: SignupRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('applications');
  const [signups, setSignups] = useState<SignupRow[]>(initialSignups);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  // Admin-management form state.
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/beta-admin', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/admin');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setSignups(Array.isArray(data.signups) ? data.signups : []);
    } catch {
      setError('Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/admin');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setAudit(Array.isArray(data.audit) ? data.audit : []);
    } catch {
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auto-dismiss the toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const runAction = useCallback(
    async (id: string, action: BetaAdminUiAction) => {
      setPendingAction(true);
      setError(null);
      try {
        const res = await fetch('/api/beta-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data?.error as string) ?? `Action failed (${res.status})`);
        }
        setToast(
          action === 'revoke'
            ? 'Application revoked.'
            : action === 'approve'
              ? 'Approved — invite sent.'
              : 'Re-invite sent.',
        );
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPendingAction(false);
        setConfirmingId(null);
      }
    },
    [load],
  );

  const handleAction = useCallback(
    (id: string, action: BetaAdminUiAction) => {
      // Inline confirm is required before an irreversible revoke.
      if (action === 'revoke') {
        if (confirmingId === id) {
          runAction(id, action);
        } else {
          setConfirmingId(id);
        }
        return;
      }
      setConfirmingId(null);
      runAction(id, action);
    },
    [confirmingId, runAction],
  );

  const manageAdmin = useCallback(
    async (action: 'add' | 'remove', email: string) => {
      setAdminBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, email }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data?.error as string) ?? `Failed (${res.status})`);
        }
        setToast(action === 'add' ? 'Admin added.' : 'Admin removed.');
        setNewAdminEmail('');
        await loadAdmin();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setAdminBusy(false);
      }
    },
    [loadAdmin],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signups.filter((s) => {
      const statusOk = filter === 'all' || s.status === filter;
      const searchOk =
        !q ||
        s.email.toLowerCase().includes(q) ||
        (s.invitedEmail ?? '').toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [signups, filter, search]);

  const auditLabels: Record<string, string> = {
    approve: 'Approved application',
    revoke: 'Revoked application',
    reinvite: 'Re-invited application',
    'admin-add': 'Added admin',
    'admin-remove': 'Removed admin',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Operator Admin</h1>
            <p className="mt-1 text-sm text-gray-400">Astryon beta management</p>
          </div>
          <button
            onClick={() => {
              if (tab === 'applications') void load();
              else void loadAdmin();
            }}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>

        {/* Tabs */}
        <nav className="mb-4 flex gap-1 border-b border-gray-800" aria-label="Admin sections">
          {(
            [
              ['applications', 'Applications'],
              ['admins', 'Admins'],
              ['audit', 'Audit Log'],
            ] as [Tab, string][]
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  // Applications hydrate from server-provided initial data; the
                  // Admins/Audit sections need a fresh fetch when first opened.
                  if (key === 'admins' || key === 'audit') void loadAdmin();
                  else if (key === 'applications') void load();
                }}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'border border-b-0 border-gray-700 bg-[#121212] text-[#00ffd4]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                aria-selected={active}
                role="tab"
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Toast */}
        {toast && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {toast}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {tab === 'applications' && (
          <>
            {/* Filters: status chips + email search */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {ADMIN_FILTER_CHIPS.map((chip) => {
                const active = filter === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => setFilter(chip.key)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      active
                        ? 'bg-[#00ffd4]/15 text-[#00ffd4] border border-[#00ffd4]/50'
                        : 'bg-[#1a1a1a] text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="ml-auto w-64 rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-[#00ffd4]/50 focus:outline-none"
                aria-label="Search applications by email"
              />
            </div>

            {/* Table */}
            {loading && !error ? (
              <div className="rounded-xl border border-gray-800 bg-[#121212] p-10 text-center text-gray-400">
                Loading applications…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-[#121212] p-10 text-center text-gray-400">
                {search || filter !== 'all'
                  ? 'No applications match the current filters.'
                  : 'No applications found yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#121212]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Applied</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const actions = getAvailableAdminActions(s.status);
                      return (
                        <tr key={s.id} className="border-b border-gray-800/60 last:border-b-0 hover:bg-gray-900/40">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-100">{s.email}</div>
                            {s.invitedEmail && s.invitedEmail !== s.email && (
                              <div className="text-xs text-gray-500">Invited: {s.invitedEmail}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${getStatusBadgeClasses(s.status)}`}>
                              {getStatusLabel(s.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {actions.map((action) => {
                                const confirming = confirmingId === s.id && action === 'revoke';
                                if (confirming) {
                                  return (
                                    <span key={action} className="flex items-center gap-2">
                                      <span className="text-xs text-red-300">Revoke this application?</span>
                                      <button
                                        onClick={() => runAction(s.id, action)}
                                        disabled={pendingAction}
                                        className="rounded-md border border-red-500 bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmingId(null)}
                                        disabled={pendingAction}
                                        className="rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-300 hover:border-gray-400 disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={action}
                                    onClick={() => handleAction(s.id, action)}
                                    disabled={pendingAction}
                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                      action === 'revoke'
                                        ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                        : action === 'approve'
                                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                          : 'border-[#00ffd4]/40 bg-[#00ffd4]/10 text-[#00ffd4] hover:bg-[#00ffd4]/20'
                                    }`}
                                  >
                                    {action === 'revoke' ? 'Revoke' : action === 'approve' ? 'Approve' : 'Re-invite'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'admins' && (
          <div className="rounded-xl border border-gray-800 bg-[#121212] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Manage Admins</h2>
            <div className="mb-6 flex gap-2">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="flex-1 rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-[#00ffd4]/50 focus:outline-none"
                aria-label="Add admin email"
              />
              <button
                onClick={() => newAdminEmail && void manageAdmin('add', newAdminEmail)}
                disabled={adminBusy || !newAdminEmail.trim()}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {adminBusy ? 'Adding…' : 'Add admin'}
              </button>
            </div>

            {loading && !error ? (
              <div className="p-8 text-center text-gray-400">Loading admins…</div>
            ) : admins.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No managed admins yet. Operators listed here (plus the ADMIN_EMAILS allowlist)
                can access /admin.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Added by</th>
                    <th className="px-3 py-2 font-medium">Added</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-b border-gray-800/60 last:border-b-0 hover:bg-gray-900/40">
                      <td className="px-3 py-2 font-medium text-gray-100">{a.email}</td>
                      <td className="px-3 py-2 text-gray-400">{a.addedBy}</td>
                      <td className="px-3 py-2 text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => void manageAdmin('remove', a.email)}
                          disabled={adminBusy}
                          className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-xl border border-gray-800 bg-[#121212] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Audit Log</h2>
            <p className="mb-4 text-xs text-gray-500">
              Read-only record of operator actions (most recent 200).
            </p>
            {loading && !error ? (
              <div className="p-8 text-center text-gray-400">Loading audit log…</div>
            ) : audit.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No audit entries yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Operator</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                      <th className="px-3 py-2 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-b border-gray-800/60 last:border-b-0 hover:bg-gray-900/40">
                        <td className="px-3 py-2 text-gray-400">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-100">{a.operatorEmail}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-[#00ffd4]/10 px-2.5 py-0.5 text-xs text-[#00ffd4]">
                            {auditLabels[a.action] ?? a.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-300">{a.targetEmail}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{a.ip ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
