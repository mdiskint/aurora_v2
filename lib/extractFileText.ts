/**
 * Text extraction from uploaded files.
 * Uses a server-side API route for reliable PDF/docx/xlsx parsing,
 * and client-side reading for plain text formats.
 */

const SERVER_EXTRACTED = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // Plain text formats - read directly in the browser
  if (isPlainText(name, file.type)) {
    return readAsText(file);
  }

  // PowerPoint .pptx - client-side zip extraction
  if (name.endsWith('.pptx')) {
    return extractPptxText(file);
  }

  // PowerPoint .ppt (legacy - no support)
  if (name.endsWith('.ppt')) {
    return '[Legacy .ppt format — please convert to .pptx for text extraction]';
  }

  // PDF, Word, Excel - send to server for reliable extraction
  if (SERVER_EXTRACTED.some(ext => name.endsWith(ext))) {
    return extractViaServer(file);
  }

  // Fallback: try reading as text
  try {
    return await readAsText(file);
  } catch {
    return `[Could not extract text from ${file.name}]`;
  }
}

async function extractViaServer(file: File): Promise<string> {
  // Read file and convert to base64 in chunks to avoid stack overflow
  // with large files. FormData multipart has issues with certain MIME
  // types in Next.js API routes.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const res = await fetch('/api/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, data: base64 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Server extraction failed');
  }

  const { text } = await res.json();
  return text || '';
}

function isPlainText(name: string, mimeType: string): boolean {
  const textExtensions = ['.txt', '.csv', '.md', '.json', '.rtf', '.html', '.xml'];
  const textMimeTypes = [
    'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml',
    'application/json', 'application/rtf',
  ];
  return textExtensions.some(ext => name.endsWith(ext)) ||
    textMimeTypes.some(t => mimeType === t);
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function extractPptxText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const slides: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('text');
    const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .join(' ');
      if (slideText.trim()) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1];
        slides.push(`--- Slide ${slideNum} ---\n${slideText}`);
      }
    }
  }

  return slides.join('\n\n') || '[No text content found in presentation]';
}
