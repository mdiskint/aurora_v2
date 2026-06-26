import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, school, useCase, role } = await request.json()

  await prisma.user.update({
    where: { email: session.user.email },
    data: { name, school, useCase, role, onboardingCompleted: true },
  })

  return NextResponse.json({ ok: true })
}
