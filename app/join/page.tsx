import prisma from '@/lib/prisma'
import JoinButton from './JoinButton'

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) return <JoinError message="Invalid invite link." />

  const signup = await prisma.betaSignup.findUnique({ where: { inviteToken: token } })
  if (!signup?.inviteExpires || signup.inviteExpires < new Date()) {
    return <JoinError message="This invite link has expired or is invalid." />
  }

  return <JoinButton />
}

function JoinError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-gray-400">{message}</p>
    </div>
  )
}
