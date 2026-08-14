/**
 * Unit tests for BETA-08 Blob upload authorization helpers (lib/uploadAuth.ts).
 *
 * Covers the security-critical pure logic: the SSRF host allowlist, the
 * opaque user-scoped pathname derivation, video-type/size limits, and expiry.
 *
 * Run with: npx tsx lib/__tests__/uploadAuth.test.ts
 */

import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  VIDEO_EXTENSIONS,
  buildOpaquePathname,
  isAllowedVideoExtension,
  isExpired,
  isVercelBlobUrl,
  pathnameFromUrl,
} from '../uploadAuth';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============================================
// SSRF guard: arbitrary URLs must be rejected
// ============================================

function testRejectsArbitraryUrls(): void {
  const arbitrary = [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3001/private',
    'https://example.com/foo.mp4',
    'ftp://blob.vercel-storage.com/x',
    'file:///etc/passwd',
    'not-a-url',
    'https://evil.vercel-storage.com.evil.com/x',
  ];
  arbitrary.forEach((u: string) => {
    assert(!isVercelBlobUrl(u), `arbitrary URL should be rejected: ${u}`);
  });
  console.log('  ✓ Arbitrary/SSRF URLs rejected');
}

function testAcceptsVercelBlobUrl(): void {
  const ok = [
    'https://abc123.public.blob.vercel-storage.com/videos/uuid.mp4',
    'https://blob.vercel-storage.com/videos/uuid.mov',
  ];
  ok.forEach((u: string) => {
    assert(isVercelBlobUrl(u), `Vercel blob URL should be accepted: ${u}`);
  });
  console.log('  ✓ Vercel blob URLs accepted');
}

function testPathnameExtraction(): void {
  const pathname = pathnameFromUrl('https://abc.public.blob.vercel-storage.com/videos/abc.mp4');
  assert(pathname === 'videos/abc.mp4', `expected pathname videos/abc.mp4, got ${pathname}`);
  assert(pathnameFromUrl('not-a-url') === null, 'invalid URL should yield null');
  console.log('  ✓ Pathname extraction matches pending record pathname');
}

// ============================================
// Opaque user-scoped pathnames
// ============================================

function testOpaquePathname(): void {
  const id = '12345678-1234-4234-8234-123456789abc';
  const p = buildOpaquePathname(id, 'MP4');
  assert(p === `videos/${id}.mp4`, `expected videos/${id}.mp4, got ${p}`);
  // Unknown extension falls back to mp4.
  assert(buildOpaquePathname(id, 'exe') === `videos/${id}.mp4`, 'unknown ext should fall back to mp4');
  console.log('  ✓ Opaque pathname is user-scoped and extension-normalized');
}

function testVideoTypeAndSizeLimits(): void {
  assert(VIDEO_EXTENSIONS.includes('mp4'), 'mp4 allowed');
  assert(isAllowedVideoExtension('MOV'), 'MOV (case-insensitive) allowed');
  assert(!isAllowedVideoExtension('exe'), 'exe rejected');
  assert(ALLOWED_VIDEO_MIME_TYPES.includes('video/mp4'), 'video/mp4 allowed');
  assert(ALLOWED_VIDEO_MIME_TYPES.includes('video/quicktime'), 'video/quicktime allowed');
  assert(MAX_UPLOAD_BYTES === 20 * 1024 * 1024, 'max upload is 20 MiB');
  console.log('  ✓ Video type allowlist and size cap enforced');
}

function testExpiry(): void {
  const future = new Date(Date.now() + 60_000);
  assert(!isExpired(future), 'future expiry not expired');
  const past = new Date(Date.now() - 60_000);
  assert(isExpired(past), 'past expiry is expired');
  console.log('  ✓ Expiry check correct');
}

// ============================================
// Runner
// ============================================

console.log('\n=== Upload Auth (BETA-08) Tests ===\n');
testRejectsArbitraryUrls();
testAcceptsVercelBlobUrl();
testPathnameExtraction();
testOpaquePathname();
testVideoTypeAndSizeLimits();
testExpiry();
console.log('\n=== All upload auth tests passed! ===\n');