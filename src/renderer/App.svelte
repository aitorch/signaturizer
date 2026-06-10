<script>
  import Toolbar from './components/Toolbar.svelte';

  // App state
  let pdfData = $state(null);
  let pdfFileName = $state(null);
  let signatures = $state([]);
  // TODO: showSignDropdown will be used when sign dropdown UI is implemented
  let showSignDropdown = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let zoom = $state(100);

  // Safe access to electronAPI (may not exist in dev/browser)
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  // Handlers
  async function handleOpenPdf() {
    try {
      if (!api) return;
      const filePath = await api.openFileDialog();
      if (!filePath) return;
      const data = await api.readFile(filePath);
      if (data && data.error) {
        console.error('Failed to read file:', data.error);
        return;
      }
      pdfData = data;
      pdfFileName = filePath.split('/').pop();
    } catch (err) {
      console.error('Failed to open PDF:', err);
    }
  }

  // TODO: wire export logic to pdf-exporter module
  async function handleExport() {
    try {
      if (!api) return;
      const savePath = await api.saveFileDialog(pdfFileName || 'signed.pdf');
      if (!savePath) return;
      // TODO: export logic will be wired to pdf-exporter later
    } catch (err) {
      console.error('Failed to export:', err);
    }
  }

  function handleSign() {
    showSignDropdown = !showSignDropdown;
  }

  function handlePrevPage() {
    if (currentPage > 1) currentPage--;
  }

  function handleNextPage() {
    if (currentPage < totalPages) currentPage++;
  }

  function handleZoomIn() {
    zoom = Math.min(zoom + 10, 300);
  }

  function handleZoomOut() {
    zoom = Math.max(zoom - 10, 25);
  }
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Toolbar -->
  <Toolbar
    onOpenPdf={handleOpenPdf}
    onExport={handleExport}
    onSign={handleSign}
    hasPdf={pdfData !== null}
    hasSignatures={signatures.length > 0}
    currentPage={currentPage}
    totalPages={totalPages}
    zoom={zoom}
    onPrevPage={handlePrevPage}
    onNextPage={handleNextPage}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
  />

  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden relative">
    {#if pdfData}
      <!-- PDF Viewer placeholder — will be replaced by PdfViewer component -->
      <div class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <svg class="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm">PDF loaded: {pdfFileName}</p>
          <p class="text-xs text-gray-300 mt-1">PDF Viewer will render here</p>
        </div>
      </div>
    {:else}
      <!-- Empty state -->
      <div class="flex items-center justify-center h-full">
        <div class="text-center text-gray-400">
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
          <p class="text-lg">Open a PDF to get started</p>
          <p class="text-sm mt-1">Drag & drop or use the toolbar</p>
          <button
            onclick={handleOpenPdf}
            class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Open PDF
          </button>
        </div>
      </div>
    {/if}
  </main>
</div>
