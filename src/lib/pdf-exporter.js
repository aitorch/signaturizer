import { PDFDocument } from 'pdf-lib';

/**
 * Export a signed PDF by embedding signature images onto the original PDF.
 *
 * Each signature's (x, y) is the **bottom-left** corner of the image in PDF
 * coordinate space (origin at bottom-left of page, y increases upward).
 * This matches pdf-lib's drawImage placement convention.
 *
 * To convert from canvas pixel coordinates (origin top-left, y increases
 * downward), use {@link calculatePdfCoords} with the signature's **top-left**
 * canvas position. The returned y value will be the correct bottom-left
 * position for pdf-lib's drawImage.
 *
 * @param {Uint8Array} originalPdfBytes - Bytes of the original PDF document.
 * @param {Array<{page: number, x: number, y: number, width: number, height: number, imageData: Uint8Array}>} placedSignatures
 *   Array of placed signature objects. Page numbers are 1-indexed.
 *   (x, y) is the bottom-left corner in PDF points.
 * @returns {Promise<Uint8Array>} - The modified PDF bytes.
 */
export async function exportSignedPdf(originalPdfBytes, placedSignatures) {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);

  if (!placedSignatures || placedSignatures.length === 0) {
    return pdfDoc.save();
  }

  const pageCount = pdfDoc.getPageCount();

  for (const sig of placedSignatures) {
    if (!Number.isInteger(sig.page) || sig.page < 1 || sig.page > pageCount) {
      throw new RangeError(
        `Page number ${sig.page} is out of range. Document has ${pageCount} page(s).`,
      );
    }

    if (typeof sig.x !== 'number' || !Number.isFinite(sig.x)) {
      throw new TypeError('Signature x must be a finite number.');
    }
    if (typeof sig.y !== 'number' || !Number.isFinite(sig.y)) {
      throw new TypeError('Signature y must be a finite number.');
    }
    if (typeof sig.width !== 'number' || !Number.isFinite(sig.width) || sig.width <= 0) {
      throw new TypeError('Signature width must be a finite number greater than 0.');
    }
    if (typeof sig.height !== 'number' || !Number.isFinite(sig.height) || sig.height <= 0) {
      throw new TypeError('Signature height must be a finite number greater than 0.');
    }

    if (!(sig.imageData instanceof Uint8Array) || sig.imageData.length === 0) {
      throw new TypeError('imageData must be a non-empty Uint8Array.');
    }

    const embeddedImage = await pdfDoc.embedPng(sig.imageData);
    const page = pdfDoc.getPage(sig.page - 1); // 0-indexed

    page.drawImage(embeddedImage, {
      x: sig.x,
      y: sig.y,
      width: sig.width,
      height: sig.height,
    });
  }

  return pdfDoc.save();
}

/**
 * Convert canvas pixel coordinates (origin top-left, y goes down)
 * to PDF coordinates (origin bottom-left, y goes up).
 *
 * IMPORTANT: canvasX and canvasY should be the **top-left** corner of the
 * signature on the canvas. The returned { x, y } is the **bottom-left**
 * corner in PDF coordinate space, which is exactly what pdf-lib's
 * `drawImage({ x, y })` expects (it places the image with x,y as the
 * bottom-left anchor).
 *
 * Why this works: if canvasY is the top edge of the signature on the canvas
 * (y-down), then `pdfPageHeight - (canvasY / canvasHeight) * pdfPageHeight`
 * yields the same horizontal line measured from the PDF page bottom (y-up).
 * That line *is* the bottom edge of the signature in PDF space.
 *
 * @param {number} canvasX  Top-left x of the signature in canvas pixels.
 * @param {number} canvasY  Top-left y of the signature in canvas pixels.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} pdfPageWidth
 * @param {number} pdfPageHeight
 * @returns {{x: number, y: number}} Bottom-left position in PDF points.
 */
export function calculatePdfCoords(
  canvasX,
  canvasY,
  canvasWidth,
  canvasHeight,
  pdfPageWidth,
  pdfPageHeight,
) {
  const x = (canvasX / canvasWidth) * pdfPageWidth;
  const y = pdfPageHeight - (canvasY / canvasHeight) * pdfPageHeight;
  return { x, y };
}

/**
 * Convert signature dimensions from canvas pixels to PDF points,
 * maintaining the original aspect ratio.
 *
 * The scale factor is derived from the ratio of PDF page dimensions to
 * the canvas dimensions used to render that page.
 *
 * @param {number} canvasWidth - Rendered canvas width in pixels
 * @param {number} canvasHeight - Rendered canvas height in pixels
 * @param {number} pdfPageWidth - PDF page width in points
 * @param {number} pdfPageHeight - PDF page height in points
 * @param {number} signatureCanvasWidth - Signature width in canvas pixels
 * @param {number} signatureCanvasHeight - Signature height in canvas pixels
 * @returns {{width: number, height: number}}
 */
export function calculatePdfDimensions(
  canvasWidth,
  canvasHeight,
  pdfPageWidth,
  pdfPageHeight,
  signatureCanvasWidth,
  signatureCanvasHeight,
) {
  const scaleX = pdfPageWidth / canvasWidth;
  const scaleY = pdfPageHeight / canvasHeight;
  // Both scales should be the same when the canvas maintains the page aspect
  // ratio. We use a single uniform scale to preserve the signature's aspect
  // ratio correctly.
  const scale = scaleX;

  const width = signatureCanvasWidth * scale;
  const height = signatureCanvasHeight * scale;
  return { width, height };
}
