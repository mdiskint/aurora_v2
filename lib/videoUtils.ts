/**
 * Video URL utilities for parsing and converting YouTube/Vimeo URLs to embed format
 */

export interface ParsedVideoUrl {
  embedUrl: string;
  provider: 'youtube' | 'vimeo' | 'unknown';
}

/**
 * Extract YouTube video ID from various URL formats
 */
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    // Match youtube.com/watch?v= with optional www. and query parameters
    /(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // Match youtu.be/ short URLs
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Match youtube.com/embed/ URLs
    /(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Match youtube.com/v/ URLs
    /(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log(`✅ Extracted YouTube video ID: ${match[1]} from URL: ${url}`);
      return match[1];
    }
  }

  console.warn(`⚠️ Failed to extract YouTube video ID from URL: ${url}`);
  return null;
}

/**
 * Extract Vimeo video ID from various URL formats
 */
function getVimeoVideoId(url: string): string | null {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Convert a regular video URL to an embed URL with optional timestamps
 *
 * @param url - YouTube or Vimeo URL
 * @param startTime - Start time in seconds (optional)
 * @param endTime - End time in seconds (optional)
 * @returns Parsed video URL object with embedUrl and provider
 */
export function parseVideoUrl(
  url: string,
  startTime?: number | null,
  endTime?: number | null
): ParsedVideoUrl | null {
  console.log('🔍 parseVideoUrl called with:', { url, startTime, endTime });

  if (!url || typeof url !== 'string') {
    console.warn('⚠️ Invalid URL provided to parseVideoUrl');
    return null;
  }

  // Try YouTube
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) {
    let embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    const params: string[] = [];

    if (startTime && startTime > 0) {
      params.push(`start=${Math.floor(startTime)}`);
    }

    if (endTime && endTime > 0) {
      params.push(`end=${Math.floor(endTime)}`);
    }

    if (params.length > 0) {
      embedUrl += `?${params.join('&')}`;
    }

    console.log('✅ YouTube URL converted:', { originalUrl: url, embedUrl, provider: 'youtube' });

    return {
      embedUrl,
      provider: 'youtube',
    };
  }

  // Try Vimeo
  const vimeoId = getVimeoVideoId(url);
  if (vimeoId) {
    let embedUrl = `https://player.vimeo.com/video/${vimeoId}`;

    // Vimeo uses fragment identifier for start time
    if (startTime && startTime > 0) {
      embedUrl += `#t=${Math.floor(startTime)}s`;
    }

    // Note: Vimeo doesn't support end time in embed URLs
    // We could handle this with the Player API but that requires JavaScript

    return {
      embedUrl,
      provider: 'vimeo',
    };
  }

  return null;
}

/**
 * Check if a URL is a valid video URL (YouTube or Vimeo)
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return getYouTubeVideoId(url) !== null || getVimeoVideoId(url) !== null;
}

/**
 * Get video provider from URL
 */
export function getVideoProvider(url: string): 'youtube' | 'vimeo' | 'unknown' {
  if (getYouTubeVideoId(url)) {
    return 'youtube';
  }
  if (getVimeoVideoId(url)) {
    return 'vimeo';
  }
  return 'unknown';
}
