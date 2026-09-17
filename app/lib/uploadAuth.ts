/**
 * BETA-08: owner-bound Blob upload authorization.
 *
 * Shared server-side helpers for binding Vercel Blob uploads to the owning
 * user. The upload record is created with an opaque, server-generated
 * pathname scoped under the owning user, and the analysis route only ever
 * fetches and deletes a blob it can prove belongs to the current user's
 * pending upload record. Arbitrary client-supplied URLs are rejected before
 * any network I/O, which removes the pre-existing SSRF path.
 */

/** MIME types the upload token will allow. Mirrors the video types the
 *  analysis pipeline can pass to Gemini. */
export const ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
];

/** File extensions accepted for client uploads (used as a cheap pre-check;
 *  the Blob token's allowedContentTypes + maximumSizeInBytes are the
 *  authoritative video-type/size limits). */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];

/** Hard byte cap for a single uploaded video. Matches the Course Builder UI
 *  note of "max 20MB". */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** How long a pending upload record stays valid before it must be completed
 *  (or will be rejected by the analysis route). */
export const UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Build an opaque, user-scoped Blob pathname for a pending upload. The
 * upload id is a random v4 UUID, so the pathname is non-enumerable and cannot
 * be used to guess another user's blob. The owning user is enforced by the
 * Upload row's `userId`, not by decoding the path.
 */
export function buildOpaquePathname(uploadId: string, extension: string): string {
    const ext = VIDEO_EXTENSIONS.includes(extension.toLowerCase())
        ? extension.toLowerCase()
        : 'mp4';
    return `videos/${uploadId}.${ext}`;
}

/** True when the extension is one of the accepted video types. */
export function isAllowedVideoExtension(extension: string): boolean {
    return VIDEO_EXTENSIONS.includes(extension.toLowerCase());
}

/** True when the URL is a Vercel Blob-store HTTPS URL. This is a hard host
 *  allowlist used to reject arbitrary (SSRF) targets before any fetch. */
export function isVercelBlobUrl(value: string): boolean {
    try {
        const u = new URL(value);
        return (
            u.protocol === 'https:' &&
            (u.hostname === 'blob.vercel-storage.com' ||
                u.hostname.endsWith('.public.blob.vercel-storage.com') ||
                u.hostname.endsWith('.blob.vercel-storage.com'))
        );
    } catch {
        return false;
    }
}

/** Extract the pathname (without a leading slash) from a URL, or null. */
export function pathnameFromUrl(value: string): string | null {
    try {
        return decodeURIComponent(new URL(value).pathname).replace(/^\/+/, '');
    } catch {
        return null;
    }
}

/** Whether a pending upload proved its expiry time. */
export function isExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() <= Date.now();
}