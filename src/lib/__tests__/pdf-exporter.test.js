import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  exportSignedPdf,
  calculatePdfCoords,
  calculatePdfDimensions,
} from '../pdf-exporter.js';

// ---------------------------------------------------------------------------
// Minimal PNG generator (1×1 pixel, specified RGB color)
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid 1×1 PNG with the given RGB colour.
 *
 * PNG layout: signature | IHDR | IDAT | IEND
 * Each chunk: length (4 BE) | type (4 ASCII) | data | CRC32 (4 BE)
 */
function crc32(buf) {
  // Standard CRC-32 / PNG polynomial
  let table = crc32._table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    crc32._table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU32BE(view, offset, value) {
  view.setUint32(offset, value, false);
}

function createTestPng(r = 255, g = 0, b = 0) {
  // 1×1 pixel, 8-bit RGB (color type 2)
  return createTestPngWithParams(1, 1, 2, (rawRow) => {
    rawRow[0] = 0; // filter
    rawRow[1] = r;
    rawRow[2] = g;
    rawRow[3] = b;
  });
}

function createTestRgbaPng(r = 255, g = 0, b = 0, a = 255) {
  // 1×1 pixel, 8-bit RGBA (color type 6)
  return createTestPngWithParams(1, 1, 6, (rawRow) => {
    rawRow[0] = 0; // filter
    rawRow[1] = r;
    rawRow[2] = g;
    rawRow[3] = b;
    rawRow[4] = a;
  });
}

function createTestPngWithParams(width, height, colorType, fillRow) {
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rawRow = new Uint8Array(1 + bytesPerPixel * width); // filter byte + pixels
  fillRow(rawRow);

  const zlibLen = rawRow.length;
  const idatData = new Uint8Array(2 + 5 + zlibLen + 4);
  const dv = new DataView(idatData.buffer);
  let off = 0;
  idatData[off++] = 0x78;
  idatData[off++] = 0x01;
  idatData[off++] = 0x01;
  dv.setUint16(off, zlibLen, true);
  off += 2;
  dv.setUint16(off, zlibLen ^ 0xffff, true);
  off += 2;
  idatData.set(rawRow, off);
  off += zlibLen;
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < rawRow.length; i++) {
    s1 = (s1 + rawRow[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = ((s2 << 16) | s1) >>> 0;
  writeU32BE(dv, off, adler);

  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  writeU32BE(ihdrDv, 0, width);
  writeU32BE(ihdrDv, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];

  function makeChunk(type, data) {
    const typeBytes = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
    const combined = new Uint8Array(typeBytes.length + data.length);
    combined.set(typeBytes, 0);
    combined.set(data, typeBytes.length);
    const crcVal = crc32(combined);
    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    const cv = new DataView(chunk.buffer);
    writeU32BE(cv, 0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    writeU32BE(cv, 8 + data.length, crcVal);
    return chunk;
  }

  chunks.push(signature);
  chunks.push(makeChunk('IHDR', ihdr));
  chunks.push(makeChunk('IDAT', idatData));
  chunks.push(makeChunk('IEND', new Uint8Array(0)));

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const png = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    png.set(c, offset);
    offset += c.length;
  }
  return png;
}

// ---------------------------------------------------------------------------
// Helper: create a test PDF with N pages
// ---------------------------------------------------------------------------

async function createTestPdf(pageCount = 1) {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    page.drawText(`Page ${i + 1}`);
  }
  return pdfDoc.save();
}

// ===========================================================================
// Tests
// ===========================================================================

describe('exportSignedPdf', () => {
  it('embeds a single PNG signature on page 1', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng(255, 0, 0);

    const result = await exportSignedPdf(originalBytes, [
      {
        page: 1,
        x: 100,
        y: 700,
        width: 150,
        height: 50,
        imageData: png,
      },
    ]);

    // Result is a valid PDF
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('preserves page count after embedding', async () => {
    const originalBytes = await createTestPdf(3);
    const png = createTestPng();

    const result = await exportSignedPdf(originalBytes, [
      {
        page: 2,
        x: 50,
        y: 50,
        width: 200,
        height: 80,
        imageData: png,
      },
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(3);
  });

  it('handles multiple signatures on the same page', async () => {
    const originalBytes = await createTestPdf(1);
    const png1 = createTestPng(255, 0, 0);
    const png2 = createTestPng(0, 255, 0);

    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: 50, y: 700, width: 100, height: 40, imageData: png1 },
      { page: 1, x: 300, y: 600, width: 120, height: 50, imageData: png2 },
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('handles signatures on different pages', async () => {
    const originalBytes = await createTestPdf(3);
    const png = createTestPng();

    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: 10, y: 800, width: 50, height: 20, imageData: png },
      { page: 2, x: 100, y: 400, width: 80, height: 30, imageData: png },
      { page: 3, x: 200, y: 100, width: 120, height: 60, imageData: png },
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(3);
  });

  it('returns valid PDF when placedSignatures is empty', async () => {
    const originalBytes = await createTestPdf(2);

    const result = await exportSignedPdf(originalBytes, []);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it('returns valid PDF when placedSignatures is null/undefined', async () => {
    const originalBytes = await createTestPdf(1);
    const result1 = await exportSignedPdf(originalBytes, null);
    const result2 = await exportSignedPdf(originalBytes, undefined);

    const r1 = await PDFDocument.load(result1);
    const r2 = await PDFDocument.load(result2);
    expect(r1.getPageCount()).toBe(1);
    expect(r2.getPageCount()).toBe(1);
  });

  it('does not mutate the original PDF bytes', async () => {
    const originalBytes = await createTestPdf(1);
    const copy = new Uint8Array(originalBytes);

    const png = createTestPng();
    await exportSignedPdf(originalBytes, [
      { page: 1, x: 10, y: 10, width: 100, height: 50, imageData: png },
    ]);

    expect(originalBytes).toEqual(copy);
  });

  it('throws on invalid PDF bytes', async () => {
    const badBytes = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(
      exportSignedPdf(badBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: 10, imageData: createTestPng() },
      ]),
    ).rejects.toThrow();
  });

  it('throws on invalid PNG image data', async () => {
    const originalBytes = await createTestPdf(1);
    const badPng = new Uint8Array([0, 1, 2, 3]);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: 10, imageData: badPng },
      ]),
    ).rejects.toThrow();
  });

  it('throws when page number is out of range', async () => {
    const originalBytes = await createTestPdf(2);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 5, x: 0, y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(RangeError);
  });

  it('throws when page number is zero', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 0, x: 0, y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(RangeError);
  });

  it('throws when page number is negative', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: -1, x: 0, y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(RangeError);
  });

  it('throws when imageData is empty Uint8Array', async () => {
    const originalBytes = await createTestPdf(1);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: 10, imageData: new Uint8Array(0) },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('throws when imageData is not a Uint8Array', async () => {
    const originalBytes = await createTestPdf(1);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: 10, imageData: [1, 2, 3] },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('throws when x is not a finite number', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: NaN, y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: Infinity, y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 'bad', y: 0, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('throws when y is not a finite number', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: NaN, width: 10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('throws when width is not a positive finite number', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 0, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: -10, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: NaN, height: 10, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('throws when height is not a positive finite number', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: 0, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);

    await expect(
      exportSignedPdf(originalBytes, [
        { page: 1, x: 0, y: 0, width: 10, height: -5, imageData: png },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('produces a larger PDF when image is embedded', async () => {
    const originalBytes = await createTestPdf(1);
    const png = createTestPng(255, 0, 0);

    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: 100, y: 700, width: 150, height: 50, imageData: png },
    ]);

    expect(result.length).toBeGreaterThan(originalBytes.length);
  });

  it('produces a larger PDF with each additional signature', async () => {
    const originalBytes = await createTestPdf(1);
    const png1 = createTestPng(255, 0, 0);
    const png2 = createTestPng(0, 255, 0);

    const result1 = await exportSignedPdf(originalBytes, [
      { page: 1, x: 50, y: 700, width: 100, height: 40, imageData: png1 },
    ]);
    const result2 = await exportSignedPdf(originalBytes, [
      { page: 1, x: 50, y: 700, width: 100, height: 40, imageData: png1 },
      { page: 1, x: 300, y: 600, width: 120, height: 50, imageData: png2 },
    ]);

    expect(result2.length).toBeGreaterThan(result1.length);
  });

  it('embeds an RGBA (transparent) PNG signature', async () => {
    const originalBytes = await createTestPdf(1);
    const rgbaPng = createTestRgbaPng(0, 128, 255, 128);

    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: 100, y: 700, width: 150, height: 50, imageData: rgbaPng },
    ]);

    expect(result.length).toBeGreaterThan(originalBytes.length);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('handles multiple RGBA signatures across pages', async () => {
    const originalBytes = await createTestPdf(3);
    const rgbaPng1 = createTestRgbaPng(255, 0, 0, 200);
    const rgbaPng2 = createTestRgbaPng(0, 255, 0, 100);

    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: 10, y: 800, width: 50, height: 20, imageData: rgbaPng1 },
      { page: 3, x: 200, y: 100, width: 120, height: 60, imageData: rgbaPng2 },
    ]);

    expect(result.length).toBeGreaterThan(originalBytes.length);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(3);
  });
});

describe('calculatePdfCoords', () => {
  it('maps top-left canvas corner (0,0) to (0, pdfPageHeight)', () => {
    const result = calculatePdfCoords(0, 0, 800, 1131, 595.28, 841.89);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(841.89, 5);
  });

  it('maps bottom-right canvas corner to (pdfPageWidth, 0)', () => {
    const result = calculatePdfCoords(800, 1131, 800, 1131, 595.28, 841.89);
    expect(result.x).toBeCloseTo(595.28, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('maps center of canvas to center of PDF page', () => {
    const result = calculatePdfCoords(400, 565.5, 800, 1131, 595.28, 841.89);
    expect(result.x).toBeCloseTo(595.28 / 2, 5);
    expect(result.y).toBeCloseTo(841.89 / 2, 5);
  });

  it('converts arbitrary coordinates correctly', () => {
    // canvas: 1000x1000, pdf: 500x500
    // canvasX=250 → x = 250/1000*500 = 125
    // canvasY=750 → y = 500 - (750/1000*500) = 500 - 375 = 125
    const result = calculatePdfCoords(250, 750, 1000, 1000, 500, 500);
    expect(result.x).toBe(125);
    expect(result.y).toBe(125);
  });

  it('handles non-square canvases and pages', () => {
    const result = calculatePdfCoords(100, 200, 400, 600, 612, 792);
    // x = (100/400)*612 = 153
    // y = 792 - (200/600)*792 = 792 - 264 = 528
    expect(result.x).toBeCloseTo(153, 5);
    expect(result.y).toBeCloseTo(528, 5);
  });

  it('y flips direction — larger canvasY means smaller PDF y', () => {
    const r1 = calculatePdfCoords(100, 100, 800, 1131, 595.28, 841.89);
    const r2 = calculatePdfCoords(100, 500, 800, 1131, 595.28, 841.89);
    expect(r2.y).toBeLessThan(r1.y);
  });

  it('full flow: top-left canvas position maps to correct bottom-left for drawImage', async () => {
    // Simulate a 800x1131 canvas rendering an A4 PDF (595.28 x 841.89).
    // User places a 200x80 signature at canvas top-left (100, 100).
    const canvasWidth = 800;
    const canvasHeight = 1131;
    const pdfW = 595.28;
    const pdfH = 841.89;
    const sigCanvasX = 100;
    const sigCanvasY = 100;
    const sigCanvasW = 200;
    const sigCanvasH = 80;

    // Step 1: convert position
    const pos = calculatePdfCoords(sigCanvasX, sigCanvasY, canvasWidth, canvasHeight, pdfW, pdfH);
    // Step 2: convert dimensions
    const dims = calculatePdfDimensions(canvasWidth, canvasHeight, pdfW, pdfH, sigCanvasW, sigCanvasH);

    // pos.y should be the BOTTOM-LEFT y for drawImage.
    // The TOP edge of the signature in PDF coords = pos.y + dims.height
    // That top edge should equal pdfH - (sigCanvasY / canvasHeight) * pdfH + dims.height
    // = pdfH - (100/1131)*pdfH + (80 * pdfW/canvasWidth)
    const topEdgePdf = pdfH - (sigCanvasY / canvasHeight) * pdfH + dims.height;
    // The bottom edge should be at pos.y
    expect(pos.y).toBeCloseTo(pdfH - (sigCanvasY / canvasHeight) * pdfH, 5);
    // pos.x should be the LEFT edge
    expect(pos.x).toBeCloseTo((sigCanvasX / canvasWidth) * pdfW, 5);

    // Verify the actual export works with these coords
    const originalBytes = await createTestPdf(1);
    const png = createTestPng();
    const result = await exportSignedPdf(originalBytes, [
      { page: 1, x: pos.x, y: pos.y, width: dims.width, height: dims.height, imageData: png },
    ]);
    expect(result.length).toBeGreaterThan(originalBytes.length);
  });
});

describe('calculatePdfDimensions', () => {
  it('scales a 200x100 signature correctly on A4', () => {
    // canvas 800x1131, pdf A4 595.28x841.89
    const result = calculatePdfDimensions(800, 1131, 595.28, 841.89, 200, 100);
    // scale = 595.28 / 800 = 0.7441
    // width = 200 * 0.7441 ≈ 148.82
    // height = 100 * 0.7441 ≈ 74.41
    expect(result.width).toBeCloseTo(200 * (595.28 / 800), 3);
    expect(result.height).toBeCloseTo(100 * (595.28 / 800), 3);
  });

  it('maintains the original aspect ratio', () => {
    const result = calculatePdfDimensions(800, 1131, 595.28, 841.89, 200, 100);
    const originalRatio = 200 / 100;
    const resultRatio = result.width / result.height;
    expect(resultRatio).toBeCloseTo(originalRatio, 10);
  });

  it('returns correct dimensions for 1:1 canvas-to-pdf mapping', () => {
    const result = calculatePdfDimensions(595.28, 841.89, 595.28, 841.89, 100, 50);
    expect(result.width).toBeCloseTo(100, 5);
    expect(result.height).toBeCloseTo(50, 5);
  });

  it('handles very small signatures', () => {
    const result = calculatePdfDimensions(800, 1131, 595.28, 841.89, 1, 1);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBeCloseTo(result.height, 10);
  });

  it('handles very large signatures', () => {
    // Signature larger than the canvas
    const result = calculatePdfDimensions(800, 1131, 595.28, 841.89, 1600, 2262);
    // scale = 595.28/800
    const scale = 595.28 / 800;
    expect(result.width).toBeCloseTo(1600 * scale, 3);
    expect(result.height).toBeCloseTo(2262 * scale, 3);
  });

  it('handles zero-size signature', () => {
    const result = calculatePdfDimensions(800, 1131, 595.28, 841.89, 0, 0);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});
