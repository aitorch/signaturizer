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
  // Caller should pass a fresh Uint8Array or ArrayBuffer.
  // We create a copy so pdf.js can transfer it to its worker safely.
  let data;
  if (arrayBuffer instanceof Uint8Array) {
    data = arrayBuffer.slice(0);
  } else if (arrayBuffer instanceof ArrayBuffer) {
    data = arrayBuffer.slice(0);
  } else {
    data = arrayBuffer; // let pdf.js handle it
  }
  console.log('[pdf-viewer] loadPdf:', (data?.byteLength || data?.length || '?'), 'bytes');
  const loadingTask = pdfjsLib.getDocument({
    data,
    // Electron + sandboxed renderer + Vite can leave the pdf.js worker stuck.
    // Running parsing in the renderer avoids worker transfer/detach issues and
    // is fast enough for the small business PDFs this app handles.
    disableWorker: true,
  });
  const doc = await loadingTask.promise;
  console.log('[pdf-viewer] loaded:', doc.numPages, 'pages');
  return doc;
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

  console.log('[pdf-viewer] renderPage start:', pageNum, 'scale', scale);
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

  console.log('[pdf-viewer] renderPage done:', pageNum, viewport.width, viewport.height);
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
