/**
 * Client-side text extraction from uploaded files.
 * Supports PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx),
 * and plain text formats.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // Plain text formats - read directly
  if (isPlainText(name, file.type)) {
    return readAsText(file);
  }

  // PDF
  if (name.endsWith('.pdf')) {
    return extractPdfText(file);
  }

  // Word .docx
  if (name.endsWith('.docx')) {
    return extractDocxText(file);
  }

  // Word .doc (legacy binary format - limited support)
  if (name.endsWith('.doc')) {
    return extractDocText(file);
  }

  // Excel .xlsx / .xls
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return extractExcelText(file);
  }

  // PowerPoint .pptx
  if (name.endsWith('.pptx')) {
    return extractPptxText(file);
  }

  // PowerPoint .ppt (legacy - limited support)
  if (name.endsWith('.ppt')) {
    return '[Legacy .ppt format — please convert to .pptx for text extraction]';
  }

  // Fallback: try reading as text
  try {
    return await readAsText(file);
  } catch {
    return `[Could not extract text from ${file.name}]`;
  }
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

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source to bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const buffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractDocText(file: File): Promise<string> {
  // Legacy .doc files: attempt raw text extraction
  // This won't work perfectly but captures readable strings
  const buffer = await readAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const text: string[] = [];
  let current = '';

  for (const byte of bytes) {
    if (byte >= 32 && byte < 127) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 4) {
        text.push(current);
      }
      current = '';
    }
  }
  if (current.length >= 4) text.push(current);

  const extracted = text.join(' ').replace(/\s{2,}/g, ' ').trim();
  if (extracted.length < 50) {
    return '[Legacy .doc format — please convert to .docx for better text extraction]';
  }
  return extracted;
}

async function extractExcelText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      sheets.push(`--- ${sheetName} ---\n${csv}`);
    }
  }

  return sheets.join('\n\n');
}

async function extractPptxText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const buffer = await readAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);

  const slides: string[] = [];
  // PPTX files contain slides as XML in ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('text');
    // Extract text from XML tags like <a:t>text</a:t>
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
