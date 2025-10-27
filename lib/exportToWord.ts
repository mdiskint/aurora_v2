import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, Footer, PageNumber, NumberFormat } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportData {
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string }>;
  filename: string;
}

export async function exportToWord(data: ExportData) {
  // Helper function to split content into paragraphs
  const createContentParagraphs = (content: string) => {
    return content.split('\n\n').map(para =>
      new Paragraph({
        children: [new TextRun({
          text: para.trim(),
          font: 'Calibri',
          size: 24 // 12pt (size is in half-points)
        })],
        spacing: {
          after: 240,
          line: 360 // 1.5 line spacing
        }
      })
    );
  };

  // Build document children
  const documentChildren: Paragraph[] = [];

  // Title
  documentChildren.push(
    new Paragraph({
      text: data.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      style: 'Title'
    })
  );

  // Summary section
  documentChildren.push(
    new Paragraph({
      text: 'Executive Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );

  documentChildren.push(...createContentParagraphs(data.summary));

  // Add each section
  data.sections.forEach(section => {
    documentChildren.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    documentChildren.push(...createContentParagraphs(section.content));
  });

  // Generated timestamp
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `\n\nGenerated on ${new Date().toLocaleString()}`,
          italics: true,
          size: 20, // 10pt
          color: '666666'
        })
      ],
      spacing: { before: 400 }
    })
  );

  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '🤖 Generated with ',
          size: 20
        }),
        new TextRun({
          text: 'Aurora Portal',
          size: 20,
          bold: true,
          color: '00FFD4'
        })
      ],
      spacing: { after: 200 }
    })
  );

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch (1440 twips)
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                  font: 'Calibri',
                  size: 20
                })
              ]
            })
          ]
        })
      },
      children: documentChildren
    }]
  });

  // Generate and download
  console.log('📄 Generating Word document...');
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.filename}.docx`);
  console.log('✅ Word document downloaded:', `${data.filename}.docx`);
}
