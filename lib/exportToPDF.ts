import jsPDF from 'jspdf';

export interface ExportData {
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string }>;
  filename: string;
}

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 25;
  const maxWidth = pageWidth - marginLeft - marginRight;

  let yPosition = marginTop;
  let pageNumber = 1;

  // Helper function to add footer
  const addFooter = () => {
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${pageNumber}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  };

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - marginBottom) {
      addFooter();
      doc.addPage();
      pageNumber++;
      yPosition = marginTop;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(data.title, maxWidth);
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  });
  yPosition += 10;

  // Executive Summary
  checkNewPage(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', marginLeft, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(data.summary, maxWidth);
  summaryLines.forEach((line: string) => {
    checkNewPage(7);
    doc.text(line, marginLeft, yPosition);
    yPosition += 7;
  });
  yPosition += 10;

  // Sections
  data.sections.forEach((section, index) => {
    checkNewPage(25);

    // Section heading
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const headingLines = doc.splitTextToSize(section.heading, maxWidth);
    headingLines.forEach((line: string) => {
      checkNewPage(8);
      doc.text(line, marginLeft, yPosition);
      yPosition += 8;
    });
    yPosition += 5;

    // Section content
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    // Split content by paragraphs
    const paragraphs = section.content.split('\n\n');
    paragraphs.forEach(paragraph => {
      const contentLines = doc.splitTextToSize(paragraph.trim(), maxWidth);
      contentLines.forEach((line: string) => {
        checkNewPage(7);
        doc.text(line, marginLeft, yPosition);
        yPosition += 7;
      });
      yPosition += 5; // Space between paragraphs
    });

    yPosition += 10; // Space after section
  });

  // Generated timestamp
  checkNewPage(20);
  yPosition += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    marginLeft,
    yPosition
  );
  yPosition += 6;
  doc.text(
    '🤖 Generated with Aurora Portal',
    marginLeft,
    yPosition
  );

  // Add footer to last page
  addFooter();

  // Download
  console.log('📄 Generating PDF document...');
  doc.save(`${data.filename}.pdf`);
  console.log('✅ PDF document downloaded:', `${data.filename}.pdf`);
}
