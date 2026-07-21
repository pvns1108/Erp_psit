const PDFDocument = require('pdfkit');

/**
 * Streams a clean, official-looking PDF document to the given response.
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {{title:string, subtitle?:string, rows?:[string,string][], paragraphs?:string[], footer?:string}} opts
 */
function generateDocumentPdf(res, filename, opts) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill('#0b1225');
  doc.fillColor('#f2b94a').fontSize(20).font('Helvetica-Bold')
    .text('PRANVEER SINGH INSTITUTE OF TECHNOLOGY', 50, 28);
  doc.fillColor('#9aa4c2').fontSize(10).font('Helvetica')
    .text('Kanpur, Uttar Pradesh — 209305 · Digital Campus ERP', 50, 54);

  doc.moveDown(4);
  doc.fillColor('#111').fontSize(16).font('Helvetica-Bold').text(opts.title, { align: 'center' });
  if (opts.subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#444').text(opts.subtitle, { align: 'center' });
  }
  doc.moveDown(1.2);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#ddd').stroke();
  doc.moveDown(1);

  if (opts.paragraphs) {
    doc.fontSize(11).fillColor('#222').font('Helvetica');
    opts.paragraphs.forEach(p => {
      doc.text(p, { align: 'left', lineGap: 4 });
      doc.moveDown(0.6);
    });
  }

  if (opts.rows && opts.rows.length) {
    doc.moveDown(0.4);
    opts.rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#333').text(label, 50, doc.y, { continued: true, width: 200 });
      doc.font('Helvetica').fillColor('#111').text('  ' + value);
      doc.moveDown(0.35);
    });
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#888').text(
    opts.footer || 'This is a system-generated document from the PSIT Kanpur Digital Campus ERP.',
    { align: 'center' }
  );
  doc.fontSize(8).fillColor('#aaa').text('Generated on ' + new Date().toLocaleString('en-IN'), { align: 'center' });

  doc.end();
}

module.exports = { generateDocumentPdf };
