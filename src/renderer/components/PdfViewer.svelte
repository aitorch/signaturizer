<script>
  import { loadPdf, getPageCount, renderPage } from '../../lib/pdf-viewer.js';

  let {
    pdfData = null,
    onPageChange = null,
    onZoomChange = null,
    getCanvasRef = null,
  } = $props();

  let totalPages = $state(0);
  let currentPage = $state(1);
  let zoom = $state(1.0);
  let loading = $state(false);
  let error = $state(null);
  let pdfDoc = $state(null);

  let canvasEl = $state(null);
  let containerEl = $state(null);

  let displayZoom = $derived(Math.round(zoom * 100));
  let canGoPrev = $derived(currentPage > 1);
  let canGoNext = $derived(currentPage < totalPages);

  // Expose canvas ref to parent via callback prop
  $effect(() => {
    if (typeof getCanvasRef === 'function') {
      getCanvasRef(canvasEl);
    }
  });

  // Load PDF when pdfData changes; destroy old document to prevent memory leaks
  $effect(() => {
    const data = pdfData;

    if (pdfDoc) {
      pdfDoc.destroy().catch(() => {});
      pdfDoc = null;
    }

    if (!data) {
      totalPages = 0;
      currentPage = 1;
      error = null;
      return () => {};
    }

    let cancelled = false;
    loading = true;
    error = null;

    (async () => {
      try {
        const doc = await loadPdf(data);
        if (cancelled) { doc.destroy().catch(() => {}); return; }
        pdfDoc = doc;
        totalPages = getPageCount(doc);
        currentPage = 1;
      } catch (e) {
        if (cancelled) return;
        error = e.message || 'Failed to load PDF';
        pdfDoc = null;
        totalPages = 0;
      } finally {
        if (!cancelled) loading = false;
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDoc) {
        pdfDoc.destroy().catch(() => {});
      }
    };
  });

  // Re-render when pdfDoc, currentPage, or zoom changes
  $effect(() => {
    const doc = pdfDoc;
    const page = currentPage;
    const z = zoom;
    const canvas = canvasEl;

    if (!doc || !canvas) return;

    let cancelled = false;

    (async () => {
      try {
        await renderPage(doc, page, canvas, z);
      } catch {
        if (!cancelled) error = 'Failed to render page';
      }
    })();

    return () => { cancelled = true; };
  });

  function goToPage(num) {
    const clamped = Math.max(1, Math.min(num, totalPages));
    if (clamped === currentPage) return;
    currentPage = clamped;
    if (typeof onPageChange === 'function') onPageChange(clamped);
  }

  function prevPage() { goToPage(currentPage - 1); }
  function nextPage() { goToPage(currentPage + 1); }

  function setZoom(newZoom) {
    const clamped = Math.max(0.25, Math.min(5.0, newZoom));
    if (Math.abs(clamped - zoom) < 0.001) return;
    zoom = clamped;
    if (typeof onZoomChange === 'function') onZoomChange(clamped);
  }

  function zoomIn() { setZoom(zoom + 0.25); }
  function zoomOut() { setZoom(zoom - 0.25); }

  function fitWidth() {
    if (!pdfDoc || !containerEl) return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1.0 });
        const containerWidth = containerEl.clientWidth - 40;
        setZoom(containerWidth / vp.width);
      } catch (e) {
        console.error('fitWidth error:', e);
      }
    })();
  }

  function fitPage() {
    if (!pdfDoc || !containerEl) return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1.0 });
        const containerWidth = containerEl.clientWidth - 40;
        const containerHeight = containerEl.clientHeight - 40;
        setZoom(Math.min(containerWidth / vp.width, containerHeight / vp.height));
      } catch (e) {
        console.error('fitPage error:', e);
      }
    })();
  }
</script>

<div class="flex flex-col h-full w-full">
  <!-- PDF Content Area -->
  <div class="flex-1 overflow-auto bg-gray-100" bind:this={containerEl}>
    {#if error}
      <div class="flex items-center justify-center h-full text-red-500">
        <p class="text-sm">{error}</p>
      </div>
    {:else if loading}
      <div class="flex items-center justify-center h-full text-gray-400">
        <p class="text-sm">Loading PDF...</p>
      </div>
    {:else if pdfDoc}
      <div class="flex justify-center py-5 px-5">
        <canvas bind:this={canvasEl} class="shadow-lg bg-white"></canvas>
      </div>
    {:else}
      <div class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <svg
            class="mx-auto mb-4 w-16 h-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p class="text-lg">No PDF loaded</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Toolbar -->
  {#if pdfDoc}
    <div class="flex items-center justify-center gap-3 h-12 px-4 bg-gray-50 border-t border-gray-200 shrink-0">
      <!-- Page navigation -->
      <div class="flex items-center gap-2">
        <button
          onclick={prevPage}
          disabled={!canGoPrev}
          class="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          ◄
        </button>
        <span class="text-sm text-gray-700 select-none">
          Page {currentPage}/{totalPages}
        </span>
        <button
          onclick={nextPage}
          disabled={!canGoNext}
          class="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          ►
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300"></div>

      <!-- Zoom controls -->
      <div class="flex items-center gap-2">
        <button
          onclick={zoomOut}
          class="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Zoom out"
        >
          −
        </button>
        <span class="text-sm text-gray-700 w-12 text-center select-none">{displayZoom}%</span>
        <button
          onclick={zoomIn}
          class="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onclick={fitWidth}
          class="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors"
        >
          Fit Width
        </button>
        <button
          onclick={fitPage}
          class="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors"
        >
          Fit Page
        </button>
      </div>
    </div>
  {/if}
</div>
