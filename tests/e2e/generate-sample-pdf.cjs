const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1 — Contract text
  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawText('CONTRATO DE EJEMPLO', { x: 100, y: 750, size: 20, font: fontBold, color: rgb(0, 0, 0) });

  const lines = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa.',
    '',
    'FIRMA: _____________________________',
    '',
    'Fecha: ____ de ____________ de 2026',
  ];

  let y = 700;
  for (const line of lines) {
    p1.drawText(line, { x: 80, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 25;
  }

  // Page 2 — Annex
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('ANEXO I', { x: 100, y: 750, size: 18, font: fontBold });
  y = 700;
  for (let i = 0; i < 15; i++) {
    p2.drawText(lines[i % lines.length], { x: 80, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 22;
  }

  // Page 3 — Signature page
  const p3 = doc.addPage([595.28, 841.89]);
  p3.drawText('PAGINA DE FIRMA', { x: 100, y: 750, size: 18, font: fontBold });
  p3.drawText('Firme aqui:', { x: 200, y: 400, size: 14, font });
  p3.drawRectangle({ x: 150, y: 250, width: 300, height: 120, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 });

  const outDir = path.join(__dirname);
  const outPath = path.join(outDir, 'sample.pdf');
  const bytes = await doc.save();
  fs.writeFileSync(outPath, bytes);
  console.log('Created:', outPath, '(' + bytes.length + ' bytes)');
}

main().catch(e => { console.error(e); process.exit(1); });
