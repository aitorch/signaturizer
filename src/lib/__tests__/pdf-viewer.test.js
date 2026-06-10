import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs
const { mockGetDocument, mockGlobalWorkerOptions } = vi.hoisted(() => {
  const mockGetDocument = vi.fn();
  const mockGlobalWorkerOptions = {};
  return { mockGetDocument, mockGlobalWorkerOptions };
});

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: mockGlobalWorkerOptions,
  getDocument: mockGetDocument,
}));

import { loadPdf, getPageCount, renderPage, getPageDimensions, cancelActiveRender } from '../pdf-viewer.js';

function createMockPdfDoc(numPages = 3) {
  const pages = [];
  for (let i = 1; i <= numPages; i++) {
    pages.push({
      getViewport: vi.fn(({ scale }) => ({
        width: 612 * scale,
        height: 792 * scale,
      })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    });
  }

  return {
    numPages,
    getPage: vi.fn((num) => Promise.resolve(pages[num - 1])),
  };
}

function createMockCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({})),
  };
}

describe('pdf-viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('worker source', () => {
    it('sets the worker source on import', () => {
      expect(mockGlobalWorkerOptions.workerSrc).toContain('pdf.worker.mjs');
    });
  });

  describe('loadPdf', () => {
    it('calls getDocument with the provided ArrayBuffer data', async () => {
      const buffer = new ArrayBuffer(8);
      const mockDoc = createMockPdfDoc();
      mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const result = await loadPdf(buffer);

      expect(mockGetDocument).toHaveBeenCalledWith({ data: buffer });
      expect(result).toBe(mockDoc);
    });

    it('propagates errors from getDocument', async () => {
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF')),
      });

      await expect(loadPdf(new ArrayBuffer(0))).rejects.toThrow('Invalid PDF');
    });
  });

  describe('getPageCount', () => {
    it('returns the correct page count', () => {
      const mockDoc = createMockPdfDoc(5);
      expect(getPageCount(mockDoc)).toBe(5);
    });

    it('returns 0 for a document with 0 pages', () => {
      const mockDoc = createMockPdfDoc(0);
      expect(getPageCount(mockDoc)).toBe(0);
    });
  });

  describe('renderPage', () => {
    it('sets canvas dimensions and renders at the given scale', async () => {
      const mockDoc = createMockPdfDoc(1);
      const canvas = createMockCanvas();

      const result = await renderPage(mockDoc, 1, canvas, 2.0);

      expect(mockDoc.getPage).toHaveBeenCalledWith(1);
      const mockPage = await mockDoc.getPage(1);
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 2.0 });

      // Viewport at scale 2.0: 612*2=1224, 792*2=1584
      expect(canvas.width).toBe(1224);
      expect(canvas.height).toBe(1584);
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockPage.render).toHaveBeenCalledWith({
        canvasContext: expect.any(Object),
        viewport: expect.any(Object),
      });
      expect(result).toEqual({ width: 1224, height: 1584 });
    });

    it('uses default scale of 1.0 when not specified', async () => {
      const mockDoc = createMockPdfDoc(1);
      const canvas = createMockCanvas();

      const result = await renderPage(mockDoc, 1, canvas);

      const mockPage = await mockDoc.getPage(1);
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.0 });
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('renders the correct page number', async () => {
      const mockDoc = createMockPdfDoc(3);
      const canvas = createMockCanvas();

      await renderPage(mockDoc, 2, canvas, 1.0);

      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
    });
  });

  describe('getPageDimensions', () => {
    it('returns page dimensions at scale 1.0', async () => {
      const mockDoc = createMockPdfDoc(1);

      const result = await getPageDimensions(mockDoc, 1);

      const mockPage = await mockDoc.getPage(1);
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.0 });
      expect(result).toEqual({ width: 612, height: 792 });
    });

    it('returns dimensions for the requested page', async () => {
      const mockDoc = createMockPdfDoc(3);

      await getPageDimensions(mockDoc, 3);

      expect(mockDoc.getPage).toHaveBeenCalledWith(3);
    });
  });

  describe('cancelActiveRender', () => {
    it('does not throw when no render is active', () => {
      expect(() => cancelActiveRender()).not.toThrow();
    });

    it('cancels the active render task', async () => {
      const mockDoc = createMockPdfDoc(1);
      const canvas = createMockCanvas();
      const mockPage = await mockDoc.getPage(1);
      const cancelFn = vi.fn();
      let resolveRender;
      mockPage.render.mockReturnValue({
        promise: new Promise((r) => { resolveRender = r; }),
        cancel: cancelFn,
      });

      renderPage(mockDoc, 1, canvas, 1.0);

      // Flush microtasks so renderPage progresses past page.render()
      await new Promise((r) => setTimeout(r, 0));

      cancelActiveRender();
      expect(cancelFn).toHaveBeenCalled();

      resolveRender();
    });

    it('new render cancels the previous one', async () => {
      const mockDoc = createMockPdfDoc(1);
      const canvas = createMockCanvas();
      const mockPage = await mockDoc.getPage(1);
      const firstCancel = vi.fn();
      let resolveFirst;
      mockPage.render.mockReturnValueOnce({
        promise: new Promise((r) => { resolveFirst = r; }),
        cancel: firstCancel,
      });
      mockPage.render.mockReturnValue({
        promise: Promise.resolve(),
        cancel: vi.fn(),
      });

      renderPage(mockDoc, 1, canvas, 1.0);

      // Flush microtasks so the first render sets activeRenderTask
      await new Promise((r) => setTimeout(r, 0));

      // Second render should cancel the first internally
      await renderPage(mockDoc, 1, canvas, 1.0);

      expect(firstCancel).toHaveBeenCalled();

      resolveFirst();
    });
  });
});
