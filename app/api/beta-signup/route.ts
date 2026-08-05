import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { hashInviteToken, normalizeEmail } from '@/lib/betaAccess'
import { evalRateLimit, getClientIp } from '@/lib/rateLimit'

const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? '*'

// Lazy-initialize Resend. Instantiated only inside the handler when a key is
// actually present, so the build / page-data collection never depends on
// RESEND_API_KEY being set at module load.
let resend: Resend | null = null
function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': webOrigin,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// BETA-09/DEC-03: public signup is guarded per-IP before any DB or email work.
// Deny-closed: limiter error or missing config denies the request (503).
const SIGNUP_LIMIT = 10;        // applications
const SIGNUP_WINDOW_SECONDS = 60 * 60; // per hour per IP

export async function POST(request: NextRequest) {
  const limit = await evalRateLimit(
    `rl:signup:ip:${getClientIp(request)}`,
    SIGNUP_LIMIT,
    SIGNUP_WINDOW_SECONDS
  );
  if (!limit.allowed) {
    // Generic response: no detail that would help an attacker retry or probe.
    const status = limit.denyClosed ? 503 : 429;
    return NextResponse.json(
      { error: status === 503 ? 'Service temporarily unavailable' : 'Too many attempts, please try again later' },
      { status, headers: { 'Access-Control-Allow-Origin': webOrigin } }
    );
  }

  const { email, learningGoal } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = normalizeEmail(email)

  const existing = await prisma.betaSignup.findUnique({
    where: { email: normalizedEmail },
  })
  if (existing) {
    // Generic response on duplicates — no 409 tell that reveals whether an
    // email already applied (BETA-09 acceptance: no email enumeration). No
    // email is sent, so a pre-existing applicant is not re-contacted either.
    return NextResponse.json({ ok: true, status: 'pending' }, {
      headers: { 'Access-Control-Allow-Origin': webOrigin },
    })
  }

  // New applications are created in `pending` state and require manual operator
  // approval (DEC-01). The raw invite token is never stored: only its SHA-256
  // hash, so a database leak cannot mint usable invite links. The invite is
  // bound to the normalized applicant email via `invitedEmail`.
  const inviteToken = crypto.randomBytes(32).toString('hex')
  const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await prisma.betaSignup.create({
    data: {
      email: normalizedEmail,
      learningGoal,
      invitedEmail: normalizedEmail,
      inviteTokenHash: hashInviteToken(inviteToken),
      inviteExpires,
    },
  })

  // BETA-03 P1 fix: no invite link is issued yet. Applications start in
  // `pending` and require operator approval (DEC-01); handing out a usable
  // invite link now would be a dead-end trap telling applicants they are "in"
  // when access is still gated on approval. Respond with an honest
  // pending-review notice instead. Operator approval is BETA-14; redemption is
  // BETA-04. The raw invite token is never logged, emailed, or persisted.
  const resendClient = getResend()
  if (resendClient) {
    await resendClient.emails.send({
      from: 'Astryon <noreply@astryon.com>',
      to: normalizedEmail,
      subject: 'Astryon beta application received',
      html: `<p>We've received your application for the Astryon beta.</p><p>Your application is pending review. We'll email you with next steps once your access is approved.</p>`,
    })
  }

  return NextResponse.json({ ok: true, status: 'pending' }, {
    headers: { 'Access-Control-Allow-Origin': webOrigin },
  })
}
