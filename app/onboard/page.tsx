import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import OnboardForm from './OnboardForm'

export default async function OnboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/auth/signin')

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (user?.onboardingCompleted) redirect('/')

  return <OnboardForm defaultName={session.user.name ?? ''} />
}
