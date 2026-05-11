import { NextRequest, NextResponse } from 'next/server';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export async function POST(request: NextRequest) {
  try {
    const { fileName, data } = await request.json();

    if (!fileName || !data) {
      return NextResponse.json({ error: 'fileName and data are required' }, { status: 400 });
    }

    const name = fileName.toLowerCase();
    const buffer = Buffer.from(data, 'base64');

    console.log(`📄 Extracting text from "${fileName}" (${buffer.length} bytes)`);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

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
    console.error('Text extraction failed:', err);
    return NextResponse.json(
      { error: 'Failed to extract text from file' },
      { status: 500 }
    );
  }
}
