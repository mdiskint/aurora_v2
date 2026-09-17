import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { parseBoundedJson } from '@/lib/requestBound';
import { callGeminiWithFileAPI } from '@/lib/gemini';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import prisma from '@/lib/prisma';
import {
    isVercelBlobUrl,
    pathnameFromUrl,
    isExpired,
    ALLOWED_VIDEO_MIME_TYPES,
} from '@/lib/uploadAuth';

export const maxDuration = 300; // 5 minutes for fetch + processing + analysis

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

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  let uploadId: string | null = null;

  try {
    const parsed = await parseBoundedJson(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.body;
    uploadId = typeof body.uploadId === 'string' ? body.uploadId : null;
    const clientBlobUrl = typeof body.blobUrl === 'string' ? body.blobUrl : null;

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing uploadId in request body' }, { status: 400 });
    }
    if (!clientBlobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl in request body' }, { status: 400 });
    }

    const userId = await userIdForSession(user.id, user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Resolve the blob target server-side from the owner-bound pending upload
    // record. The client-supplied URL is only verified against that record,
    // never trusted as an arbitrary fetch target (fixes the pre-existing SSRF).
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, userId },
    });
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    if (upload.state !== 'ready') {
      return NextResponse.json(
        { error: 'Upload is not ready for analysis' },
        { status: 409 }
      );
    }
    if (isExpired(upload.expiresAt)) {
      return NextResponse.json({ error: 'Upload has expired' }, { status: 410 });
    }

    // SSRF / cross-user guard: reject any URL that is not a Vercel Blob URL
    // whose pathname matches the current user's pending upload record. No
    // network I/O happens before this check.
    if (!isVercelBlobUrl(clientBlobUrl)) {
      return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 });
    }
    const urlPathname = pathnameFromUrl(clientBlobUrl);
    if (urlPathname !== upload.pathname) {
      return NextResponse.json({ error: 'Blob not authorized for analysis' }, { status: 403 });
    }

    // Lifecycle: ready -> processing.
    await prisma.upload.update({
      where: { id: upload.id },
      data: { state: 'processing' },
    });

    console.log('[analyze-video] user=', user.id ?? user.email ?? 'unknown', 'fetching video');

    if (!process.env.GEMINI_API_KEY) {
      console.error('[analyze-video] GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Gemini API key not configured on server' },
        { status: 500 }
      );
    }

    // Fetch video from the verified blob URL (internal CDN traffic).
    const videoResponse = await fetch(clientBlobUrl);
    if (!videoResponse.ok) {
      console.error(`[analyze-video] failed to fetch video: ${videoResponse.status}`);
      return NextResponse.json(
        { error: `Failed to fetch video from storage: ${videoResponse.status}` },
        { status: 400 }
      );
    }

    const contentType = videoResponse.headers.get('content-type');
    const contentLength = videoResponse.headers.get('content-length');
    const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0;

    // Record the verified byte size on the upload row so the record is
    // accurate (PutBlobResult exposes no size in onUploadCompleted).
    if (fileSizeBytes > 0) {
      try {
        await prisma.upload.update({
          where: { id: upload.id },
          data: { sizeBytes: fileSizeBytes },
        });
      } catch (e) {
        console.warn('[analyze-video] sizeBytes update failed', e instanceof Error ? e.message : '');
      }
    }

    console.log(`[analyze-video] video size MB: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}, type: ${contentType}`);

    // Determine mime type from content-type header or URL
    let mimeType = contentType || 'video/mp4';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0].trim();
    }

    // Defense-in-depth: reject unexpected content types before sending to
    // Gemini. The upload token's allowedContentTypes is the primary gate;
    // this re-checks the stored blob so a mislabeled/mismatched blob cannot
    // be analyzed.
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Video content type is not allowed' },
        { status: 400 }
      );
    }


    // Extract filename from the verified pathname for the temp file
    const fileName = urlPathname.split('/').pop() || `video-${Date.now()}.mp4`;
    const tempPath = join(tmpdir(), `gemini-upload-${Date.now()}-${fileName}`);

    try {
      const arrayBuffer = await videoResponse.arrayBuffer();
      await writeFile(tempPath, Buffer.from(arrayBuffer));
      console.log('[analyze-video] temp file written');

      const systemPrompt = `You are an expert educational content creator. Your task is to watch the provided video, identify its natural topic segments, and produce structured teaching material for each segment.

Return a valid JSON object with the following structure:
{
  "title": "Engaging Course Title",
  "description": "A compelling description of what the student will learn.",
  "fullTextContent": "A comprehensive course overview covering the main themes, learning objectives, and how the sections connect to each other.",
  "timestamps": "0:00-2:30, 2:30-5:00",
  "sectionContents": [
    "Section Title: [clear title for this segment]\\n\\nKey Points:\\n- [concept or point 1]\\n- [concept or point 2]\\n- [concept or point 3]\\n\\nDefinitions & Examples:\\n- [term]: [definition or example as presented in the video]",
    "Section Title: [clear title for this segment]\\n\\nKey Points:\\n- ..."
  ]
}

IMPORTANT:
1. The "timestamps" field must be a comma-separated list of time ranges (e.g., "0:00-1:30, 1:30-3:00"). Identify segments by natural topic transitions in the video.
2. The "sectionContents" array must have the same number of items as the timestamps.
3. Each entry in "sectionContents" MUST follow this structure:
   - Start with "Section Title:" followed by a clear, descriptive title for the segment.
   - A "Key Points:" block with 3-5 bullet points capturing the core concepts, arguments, or ideas taught in that segment.
   - A "Definitions & Examples:" block listing any important terms, definitions, formulas, or concrete examples mentioned. If none are applicable, write "None for this section."
4. Do NOT transcribe the video word-for-word. Extract and reorganize the ideas into clear teaching material that a student can study from directly.
5. The "fullTextContent" field should be a course overview, NOT a transcript. Summarize the overall subject, state what the student will learn, and briefly describe how the sections build on each other.
6. Return ONLY the JSON object. Do not include markdown formatting or extra text.`;

      const userPrompt = "Analyze this video and generate a course structure.";

      console.log('🤖 Uploading to Gemini File API and analyzing...');

      const response = await callGeminiWithFileAPI(tempPath, mimeType, userPrompt, systemPrompt);

      console.log('✅ Gemini analysis complete');

      // Parse JSON response
      let jsonResponse;
      try {
        let cleanJson = response.trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

        jsonResponse = JSON.parse(cleanJson);
      } catch {
        console.error('[analyze-video] failed to parse Gemini response');
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        );
      }

      return NextResponse.json(jsonResponse);
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
        console.log('🧹 Temp file cleaned up');
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error: any) {
    console.error('[analyze-video] error:', error?.constructor?.name, error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze video' },
      { status: 500 }
    );
  } finally {
    // Mark the upload done. The blob is intentionally NOT deleted here:
    // course-builder stores this videoUrl in course data, so deleting it
    // would leave a dead URL. Deleting also ran on analysis failure, which
    // destroyed the user's uploaded video. Blob removal is an explicit
    // separate lifecycle (user delete / TTL cleanup) — a follow-up, not this
    // task.
    if (uploadId && user) {
      try {
        const userId = await userIdForSession(user.id, user.email);
        if (userId) {
          await prisma.upload.updateMany({
            where: { id: uploadId, userId, state: 'processing' },
            data: { state: 'done' },
          });
        }
      } catch (e) {
        console.warn('[analyze-video] upload state finalize failed', e instanceof Error ? e.message : '');
      }
    }
  }
}