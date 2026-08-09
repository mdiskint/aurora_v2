import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireOperator } from '@/lib/operator';
import AdminPanel, { type SignupRow } from '@/components/admin/AdminPanel';

/** Never statically render — this page exposes PII (emails) to operators only. */
export const dynamic = 'force-dynamic';

/**
 * OPS-06 operator /admin page.
 *
 * Server component. Gated entirely server-side by `requireOperator`:
 *   401 (anonymous)  -> redirect to sign-in
 *   403 (non-operator) -> Forbidden
 * success            -> query beta signups via Prisma (server), serialize dates,
 *                       and hand the rows to the client AdminPanel.
 * Never a client-only gate.
 */
export default async function AdminPage() {
  const { response } = await requireOperator();
  if (response) {
    if (response.status === 401) {
      redirect('/auth/signin?callbackUrl=/admin');
    }
    return <Forbidden />;
  }

  const signups = await prisma.betaSignup.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      status: true,
      invitedEmail: true,
      approvedAt: true,
      revokedAt: true,
      redeemedAt: true,
      inviteExpires: true,
      createdAt: true,
    },
  });

  // Serialize Dates to ISO strings for the client boundary.
  const rows: SignupRow[] = signups.map((s) => ({
    id: s.id,
    email: s.email,
    status: s.status,
    invitedEmail: s.invitedEmail,
    approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
    revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
    redeemedAt: s.redeemedAt ? s.redeemedAt.toISOString() : null,
    inviteExpires: s.inviteExpires ? s.inviteExpires.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }));

  return <AdminPanel initialSignups={rows} />;
}

/** Rendered when an authenticated user is not on the operator allowlist. */
function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121212] p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="mt-3 text-gray-400">
          This area is restricted to operators. If you believe this is an error,
          contact the Astryon administrator.
        </p>
      </div>
    </div>
  );
}
