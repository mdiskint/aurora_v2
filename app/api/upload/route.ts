import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { parseBoundedJson } from '@/lib/requestBound';
import { evalRateLimit } from '@/lib/rateLimit';
import prisma from '@/lib/prisma';
import {
    ALLOWED_VIDEO_MIME_TYPES,
    MAX_UPLOAD_BYTES,
    UPLOAD_TTL_MS,
    buildOpaquePathname,
    isAllowedVideoExtension,
} from '@/lib/uploadAuth';

/** A UUID v4 matches the uploadId the client generates with crypto.randomUUID(). */
const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map a session user id to a DB user id. The session JWT may carry the id
 * directly; fall back to email lookup to stay compatible with BETA-02.
 */
async function userIdForSession(
    sessionUserId: string | null | undefined,
    sessionEmail: string | null | undefined
): Promise<string | null> {
    if (sessionUserId) {
        const byId = await prisma.user.findUnique({ where: { id: sessionUserId } });
        if (byId) return byId.id;
    }
    if (sessionEmail) {
        const byEmail = await prisma.user.findUnique({ where: { email: sessionEmail } });
        if (byEmail) return byEmail.id;
    }
    return null;
}

function extensionFromPathname(pathname: string): string {
    const name = pathname.split('/').pop() || '';
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx + 1) : '';
}

// BETA-09/DEC-03: per-user daily upload cap on the blob-upload path.
// Deny-closed: limiter error / missing config denies the request (503).
const UPLOAD_DAILY_LIMIT = 20; // upload token requests per user per day
const UPLOAD_DAILY_WINDOW_SECONDS = 24 * 60 * 60;

export async function POST(request: Request): Promise<NextResponse> {
    const { user, response } = await requireUser();
    if (response) return response;

    const limit = await evalRateLimit(
        `rl:upload:user:${user.id ?? user.email ?? 'unknown'}`,
        UPLOAD_DAILY_LIMIT,
        UPLOAD_DAILY_WINDOW_SECONDS
    );
    if (!limit.allowed) {
        const status = limit.denyClosed ? 503 : 429;
        return NextResponse.json(
            {
                error: limit.denyClosed
                    ? 'Upload service temporarily unavailable'
                    : `Daily upload limit reached (${UPLOAD_DAILY_LIMIT} uploads/day). Please try again later.`,
            },
            { status }
        );
    }

    const parsed = await parseBoundedJson(request);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.body as unknown as HandleUploadBody;

    try {
        const userId = await userIdForSession(user.id, user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                // The client uploadId is the sole identifier the client may
                // choose; every blob path the token can address is derived
                // from it and bound to this user's pending upload row below.
                const uploadId = clientPayload ?? '';
                if (!UPLOAD_ID_RE.test(uploadId)) {
                    throw new Error('Invalid upload id');
                }

                const extension = extensionFromPathname(pathname);
                if (!isAllowedVideoExtension(extension)) {
                    throw new Error('Unsupported video type');
                }

                // Opaque, user-scoped pathname derived from the random upload id.
                const opaquePathname = buildOpaquePathname(uploadId, extension);

                // Owner-bound pending upload record. Analysis and deletion are
                // later constrained to this record (and therefore this user).
                await prisma.upload.create({
                    data: {
                        userId,
                        id: uploadId,
                        pathname: opaquePathname,
                        state: 'pending',
                        expiresAt: new Date(Date.now() + UPLOAD_TTL_MS),
                    },
                });

                // NOTE: addRandomSuffix is intentionally NOT set. The opaque,
                // UUID-derived pathname (buildOpaquePathname) is already
                // collision-proof, and any random suffix would change the real
                // blob pathname so it no longer equals the recorded
                // `pathname`, breaking the analyze-video pathname-equality
                // guard (403). The real pathname must equal the recorded one.
                return {
                    allowedContentTypes: ALLOWED_VIDEO_MIME_TYPES,
                    maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    tokenPayload: JSON.stringify({ uploadId, userId }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // Populate the record with the real blob location once Vercel
                // confirms the client upload landed. Best-effort: if it fails,
                // the record stays pending and the analysis route 4xxs.
                try {
                    const payload = tokenPayload ? JSON.parse(tokenPayload) : null;
                    const uploadId = payload?.uploadId as string | undefined;
                    const ownerId = payload?.userId as string | undefined;
                    if (!uploadId || !ownerId) return;
                    await prisma.upload.updateMany({
                        where: { id: uploadId, userId: ownerId, state: 'pending' },
                        data: {
                            url: blob.url,
                            contentType: blob.contentType ?? null,
                            // Upload completed: the record is accurate and
                            // ready for analysis (pending -> ready). Manual
                            // uploads that never analyze stay in 'ready' and
                            // are a cleanup follow-up, not handled here.
                            // sizeBytes is recorded by analyze-video from the
                            // actual fetch (PutBlobResult exposes no size).
                            state: 'ready',
                        },
                    });
                } catch (e) {
                    console.error(
                        '[upload] onUploadCompleted failed',
                        e instanceof Error ? e.message : e
                    );
                }
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error(
            '[upload] error:',
            error instanceof Error ? error.constructor.name : 'unknown',
            error instanceof Error ? error.message : ''
        );
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 }
        );
    }
}