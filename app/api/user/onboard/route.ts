import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/authz'
import { parseBoundedJson } from '@/lib/requestBound'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const parsed = await parseBoundedJson(request)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { name, school, useCase, role } = parsed.body

  const bounded = (value: unknown) =>
    typeof value === 'string' ? value.slice(0, 200) : undefined

  try {
    await prisma.user.update({
      where: { email: user.email as string },
      data: {
        name: bounded(name),
        school: bounded(school),
        useCase: bounded(useCase),
        role: bounded(role),
        onboardingCompleted: true,
      },
    })
  } catch (error: any) {
    console.error('[onboard] error:', error?.constructor?.name, error?.message)
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
