import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { Resend } from 'resend'
import crypto from 'crypto'
import { evalRateLimit, getClientIp } from '../../../lib/rateLimit'

export const runtime = 'nodejs'

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
const SIGNUP_LIMIT = 10;            // applications
const SIGNUP_WINDOW_SECONDS = 60 * 60; // per hour per IP

/**
 * Normalize an email for storage and lookup: lowercase + trim. Keeps the
 * `email` column unique over normalized values so the same account cannot
 * create duplicate signups via case/whitespace variants.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * SHA-256 hex digest of a raw invite token. Only the hash is ever persisted;
 * the raw token is sent to the invitee and never stored, so a database leak
 * cannot mint usable invite links.
 */
function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

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

  const sql = neon(process.env.DATABASE_URL!)

  const existing = await sql`SELECT id FROM "BetaSignup" WHERE email = ${normalizedEmail} LIMIT 1`
  if (existing.length > 0) {
    // Generic response on duplicates — no 409 tell that reveals whether an
    // email already applied (BETA-09 acceptance: no email enumeration). No
    // email is sent, so a pre-existing applicant is not re-contacted either.
    return NextResponse.json({ ok: true, status: 'approved' }, {
      headers: { 'Access-Control-Allow-Origin': webOrigin },
    })
  }

  // DEC-04: moderation is reactive, not proactive — new applications are
  // auto-approved on creation instead of waiting on manual operator review
  // (superseding DEC-01). An operator can still revoke a signup after the
  // fact via /admin if it turns out to be spam/abuse. This mirrors the
  // pending->approved transition computeTransitionDeltas('approve', ...)
  // applies in the Prisma-backed app (lib/betaAdmin.ts) — this route talks to
  // the same DB directly via raw SQL, so the fields are set by hand here. The
  // raw invite token is never stored: only its SHA-256 hash, so a database
  // leak cannot mint usable invite links. The invite is bound to the
  // normalized applicant email via `invitedEmail`.
  const id = crypto.randomUUID()
  const inviteToken = crypto.randomBytes(32).toString('hex')
  const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await sql`
    INSERT INTO "BetaSignup" (id, email, "learningGoal", status, "approvedAt", "invitedEmail", "inviteTokenHash", "inviteExpires", "createdAt", "updatedAt")
    VALUES (${id}, ${normalizedEmail}, ${learningGoal ?? null}, 'approved', now(), ${normalizedEmail}, ${hashInviteToken(inviteToken)}, ${inviteExpires.toISOString()}, now(), now())
  `

  // Auto-approval means there's no later manual-approve step to send the
  // invite email from, so send the invite email here instead of the old
  // "application received, pending review" notice — the applicant is already
  // approved. Best effort: a transient send failure doesn't roll back the
  // already-committed row; the operator can re-invite from /admin. The raw
  // invite token is never logged or persisted, only emailed.
  const resendClient = getResend()
  const inviteLink = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/join?token=${encodeURIComponent(inviteToken)}`
  if (resendClient) {
    await resendClient.emails.send({
      from: 'Astryon <noreply@astryon.com>',
      to: normalizedEmail,
      subject: "You're invited to the Astryon beta",
      html: `<p>Your application to the Astryon beta has been approved.</p><p>Click the link below to continue:</p><p><a href="${inviteLink}">${inviteLink}</a></p><p>The invite link expires in 72 hours.</p>`,
    })
  } else {
    console.log(`[dev] beta application auto-approved for ${normalizedEmail}`)
  }

  return NextResponse.json({ ok: true, status: 'approved' }, {
    headers: { 'Access-Control-Allow-Origin': webOrigin },
  })
}
