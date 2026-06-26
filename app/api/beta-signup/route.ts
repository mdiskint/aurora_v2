import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? '*'

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': webOrigin,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: NextRequest) {
  const { email, learningGoal } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const existing = await prisma.betaSignup.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Already signed up' }, { status: 409 })
  }

  const inviteToken = crypto.randomBytes(32).toString('hex')
  const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await prisma.betaSignup.create({ data: { email, learningGoal, inviteToken, inviteExpires } })

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  // ponytail: skip email in dev when key not set
  if (process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: 'Astryon <noreply@astryon.com>',
      to: email,
      subject: "You're in — join the Astryon beta",
      html: `<p>You've been invited to the Astryon beta.</p><p><a href="${appUrl}/join?token=${inviteToken}">Click here to get started</a></p><p>This link expires in 72 hours.</p>`,
    })
  } else {
    console.log(`[dev] invite link: ${appUrl}/join?token=${inviteToken}`)
  }

  return NextResponse.json({ ok: true }, {
    headers: { 'Access-Control-Allow-Origin': webOrigin },
  })
}
