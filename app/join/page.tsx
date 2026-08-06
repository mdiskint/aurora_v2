import prisma from '@/lib/prisma'
import { BETA_SIGNUP_STATUS, hashInviteToken } from '@/lib/betaAccess'
import JoinButton from './JoinButton'

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) return <JoinError message="Invalid invite link." />

  // Only the SHA-256 hash is stored; look up by the hash of the presented token
  // so a raw token is never compared against the database.
  const signup = await prisma.betaSignup.findUnique({
    where: { inviteTokenHash: hashInviteToken(token) },
  })

  // Reject revoked, non-approved, or already-redeemed invites before rendering
  // the sign-in button. The token is single-use: once redeemed it can never
  // issue a fresh OAuth ticket again.
  if (
    !signup ||
    signup.status !== BETA_SIGNUP_STATUS.APPROVED ||
    signup.revokedAt ||
    signup.redeemedAt ||
    !signup.inviteExpires ||
    signup.inviteExpires < new Date()
  ) {
    return <JoinError message="This invite link has expired or is invalid." />
  }

  return <JoinButton token={token} />
}

function JoinError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-gray-400">{message}</p>
    </div>
  )
}