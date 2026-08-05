import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import prisma from '@/lib/prisma';
import {
  validateUniversePayload,
  isPayloadWithinLimit,
  UNIVERSE_MAX_BYTES,
  shouldRejectVersionConflict,
  UniversePayload,
} from '@/lib/universeSchema';

/**
 * Read a Request body as text, refusing to buffer beyond
 * {@link UNIVERSE_MAX_BYTES}. Overreads a single chunk so a stream that starts
 * within the limit but exceeds it later is still rejected; the guard is a
 * hard byte cap, so a chunked transfer (no Content-Length) cannot bypass it.
 * Returns null when the body exceeds the cap.
 */
async function readBodyWithLimit(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) {
    // No stream (e.g. empty body). Let the downstream JSON parse decide.
    return '';
  }
  const max = UNIVERSE_MAX_BYTES;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

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

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const userId = await userIdForSession(user.id, user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Scoped strictly to the session user's own universes.
    const universes = await prisma.universe.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(universes);
  } catch (error) {
    console.error('Error fetching universes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  // Reject an oversized authenticated POST before buffering the full body.
  // `readBodyWithLimit` enforces a hard byte cap while streaming, so a chunked
  // transfer (no Content-Length) cannot bypass the guard. The post-parse
  // `isPayloadWithinLimit` check remains as a second line of defense.
  const bodyText = await readBodyWithLimit(req);
  if (bodyText === null) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    let body: unknown;
    try {
      body = JSON.parse(bodyText || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Reject oversized payloads before parsing/validation.
    if (!isPayloadWithinLimit(body)) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const result = validateUniversePayload(body);
    if (!result.ok || !result.payload) {
      return NextResponse.json({ error: result.error || 'Invalid payload' }, { status: 400 });
    }
    const payload: UniversePayload = result.payload;

    const userId = await userIdForSession(user.id, user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Optimistic-concurrency conflict detection keyed on a server-owned
    // integer version, never a client/server clock comparison. Clock skew
    // between the browser and the server therefore cannot cause a false 409
    // that silently drops a legitimate local change.
    //
    // The client echoes the version it last observed. The server rejects only
    // when the submitted version is STRICTLY older than its recorded version.
    // A missing version (legacy/fresh client) is treated as non-conflicting so
    // it can never be rejected on a clock-skew artifact.
    const existing = await prisma.universe.findUnique({
      where: { userId_clientId: { userId, clientId: payload.clientId } },
    });

    if (shouldRejectVersionConflict(payload.version, existing?.version)) {
      return NextResponse.json(
        { error: 'Conflict', current: existing },
        { status: 409 }
      );
    }

    // Server-owned version increments monotonic on every successful write,
    // so the returned universe always carries the newest version for the
    // client to persist and echo on its next write.
    const newVersion = existing ? existing.version + 1 : 1;

    // Upsert keyed by the (userId, clientId) composite. The server-owned `id`
    // is always server-generated (cuid) and never taken from the client.
    const universe = await prisma.universe.upsert({
      where: { userId_clientId: { userId, clientId: payload.clientId } },
      create: {
        userId,
        clientId: payload.clientId,
        data: payload.data as object,
        videoUrl: payload.videoUrl ?? null,
        version: newVersion,
      },
      update: {
        data: payload.data as object,
        videoUrl: payload.videoUrl ?? null,
        version: newVersion,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(universe);
  } catch (error) {
    console.error('Error saving universe:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('clientId' in body)) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }
    const clientId = (body as { clientId: unknown }).clientId;
    if (typeof clientId !== 'string' || clientId.length === 0) {
      return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
    }

    const userId = await userIdForSession(user.id, user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete scoped by the (userId, clientId) composite. A non-owner cannot
    // delete a universe they do not own because the composite includes their
    // own userId; a mismatch yields P2025 (record not found).
    try {
      await prisma.universe.delete({
        where: { userId_clientId: { userId, clientId } },
      });
    } catch (error: any) {
      // P2025 = record not found. Deterministic: treat as already gone rather
      // than leaking whether the row exists under another user.
      if (error?.code === 'P2025') {
        return NextResponse.json({ success: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting universe:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}