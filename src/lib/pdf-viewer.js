import * as pdfjsLib from 'pdfjs-dist';

// Use URL constructor so Vite resolves the worker asset correctly at build time
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

let activeRenderTask = null;
let activeRenderId = 0;

export function cancelActiveRender() {
  if (activeRenderTask) {
    try { activeRenderTask.cancel(); } catch (e) {}
    activeRenderTask = null;
  }
}

/**
 * Load a PDF document from an ArrayBuffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<pdfjsLib.PDFDocumentProxy>}
 */
export async function loadPdf(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
}

/**
 * Get the total number of pages in a loaded PDF document.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc
 * @returns {number}
 */
export function getPageCount(pdfDoc) {
  return pdfDoc.numPages;
}

/**
 * Render a specific page of a PDF to a canvas element.
 * Cancels any in-progress render before starting a new one.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc
 * @param {number} pageNum - 1-based page number
 * @param {HTMLCanvasElement} canvas
 * @param {number} scale - Zoom scale factor (default 1.0)
 * @returns {Promise<{width: number, height: number}>} Rendered dimensions in pixels
 */
export async function renderPage(pdfDoc, pageNum, canvas, scale = 1.0) {
  const myId = ++activeRenderId;
  cancelActiveRender();

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  activeRenderTask = page.render({
    canvasContext: context,
    viewport,
  });

  try {
    await activeRenderTask.promise;
  } catch (e) {
    if (e?.name !== 'RenderingCancelledException') throw e;
  }

  if (activeRenderId === myId) {
    activeRenderTask = null;
  }

  return { width: viewport.width, height: viewport.height };
}

/**
 * Get the dimensions of a page at scale 1.0 (in PDF points).
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc
 * @param {number} pageNum - 1-based page number
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getPageDimensions(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  return { width: viewport.width, height: viewport.height };
}
