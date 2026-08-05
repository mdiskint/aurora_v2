import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { parseBoundedJson } from '@/lib/requestBound';
import { evalRateLimit } from '@/lib/rateLimit';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

// BETA-09/DEC-03: per-user daily extraction cap on this CPU-heavy parser
// path. Deny-closed: limiter error / missing config denies the request (503).
const EXTRACT_DAILY_LIMIT = 50; // extracted files per user per day
const EXTRACT_DAILY_WINDOW_SECONDS = 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const limit = await evalRateLimit(
    `rl:extract:user:${user.id ?? user.email ?? 'unknown'}`,
    EXTRACT_DAILY_LIMIT,
    EXTRACT_DAILY_WINDOW_SECONDS
  );
  if (!limit.allowed) {
    const status = limit.denyClosed ? 503 : 429;
    return NextResponse.json(
      {
        error: limit.denyClosed
          ? 'Extraction service temporarily unavailable'
          : `Daily extraction limit reached (${EXTRACT_DAILY_LIMIT} files/day). Please try again later.`,
      },
      { status }
    );
  }

  try {
    const parsed = await parseBoundedJson(request, 70 * 1024 * 1024);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { fileName, data } = parsed.body;

    if (typeof fileName !== 'string' || typeof data !== 'string' || !data) {
      return NextResponse.json({ error: 'fileName and data are required' }, { status: 400 });
    }
    if (fileName.length > 255) {
      return NextResponse.json({ error: 'fileName too long' }, { status: 400 });
    }

    const name = fileName.toLowerCase();
    const buffer = Buffer.from(data, 'base64');

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    console.log('[extract-text] user=', user.id ?? user.email ?? 'unknown', 'bytes=', buffer.length);

    let text = '';

    if (name.endsWith('.pdf')) {
      // Import inner module directly to avoid pdf-parse's index.js which
      // tries to read a test PDF file from disk on import.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          sheets.push(`--- ${sheetName} ---\n${csv}`);
        }
      }
      text = sheets.join('\n\n');
    } else if (name.endsWith('.doc')) {
      text = '[Legacy .doc format — please convert to .docx for text extraction]';
    } else if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md') ||
               name.endsWith('.json') || name.endsWith('.rtf') || name.endsWith('.html') ||
               name.endsWith('.xml')) {
      text = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error('[extract-text] error:', err instanceof Error ? err.constructor.name : 'unknown', err instanceof Error ? err.message : '');
    return NextResponse.json(
      { error: 'Failed to extract text from file' },
      { status: 500 }
    );
  }
}
