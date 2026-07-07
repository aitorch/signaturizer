<script>
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { createSignatureStore, createMemoryAdapter } from '../lib/signature-store.js';
  import { cropImage, removeBackground, imageDataToBase64 } from '../lib/image-processor.js';
  import SignatureDropdown from './components/SignatureDropdown.svelte';
  import CameraModal from './components/CameraModal.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import PdfViewer from './components/PdfViewer.svelte';
  import SignaturePlacement from './components/SignaturePlacement.svelte';
  import { exportSignedPdf } from '../lib/pdf-exporter.js';

  // App state
  let pdfData = $state(null);
  let pdfFileName = $state(null);
  let signatures = $state([]);
  let selectedSignature = $state(null);
  let showSignDropdown = $state(false);
  let showCameraModal = $state(false);
  let store = $state(null);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let zoom = $state(100);
  let notification = $state(null); // { message, type: 'error' | 'success' }

  // PDF viewer refs
  let canvasRef = $state(null);
  let placementRef = $state(null);

  // PDF page dimensions in points — stored per page as user navigates
  let pageDimensions = $state({}); // { pageNum: { width, height } }

  // Safe access to electronAPI (may not exist in dev/browser)
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  // --- Notification helpers ---
  function showError(message) {
    notification = { message, type: 'error' };
    setTimeout(() => notification = null, 4000);
  }

  function showSuccess(message) {
    notification = { message, type: 'success' };
    setTimeout(() => notification = null, 3000);
  }

  // Load signatures on mount
  onMount(async () => {
    if (!api) return;
    try {
      const ipcAdapter = {
        read: () => api.readSignatures(),
        write: (data) => api.writeSignatures(data),
      };
      store = createSignatureStore(ipcAdapter);
      signatures = store.getAll();
    } catch (err) {
      console.error('Failed to load signatures:', err);
    }
  });

  // Handlers
  async function handleOpenPdf() {
    try {
      if (!api) return;
      const result = await api.openPdfFromDialog();
      if (!result) return;
      if (result.error) {
        console.error('Failed to read file:', result.error);
        showError('Failed to open PDF');
        return;
      }
      pdfData = result.data;
      pdfFileName = result.fileName;
    } catch (err) {
      console.error('Failed to open PDF:', err);
      showError('Failed to open PDF');
    }
  }

  async function handleExport() {
    try {
      if (!api || !pdfData) return;

      // Get placed signatures from placement component
      if (!placementRef || !canvasRef) return;

      const canvasWidth = canvasRef.width;
      const canvasHeight = canvasRef.height;

      // Use getAllPlacedForExport to get signatures across ALL pages
      const placedForExport = placementRef.getAllPlacedForExport(
        canvasWidth,
        canvasHeight,
        pageDimensions
      );

      // Check for signatures that were silently skipped due to missing page dimensions
      const allPlaced = placementRef.getAllPlaced();
      if (placedForExport.length < allPlaced.length) {
        const skippedPages = allPlaced
          .filter(s => !pageDimensions[s.page])
          .map(s => s.page)
          .filter((v, i, a) => a.indexOf(v) === i);
        const msg = `Could not export ${allPlaced.length - placedForExport.length} signature(s) on page(s) ${skippedPages.join(', ')} — missing page dimensions. Navigate to those pages first.`;
        console.error(msg);
        showError(msg);
        return;
      }

      if (placedForExport.length === 0) {
        console.warn('No signatures placed');
        showError('No signatures to export');
        return;
      }

      // Convert image data: each signature's imageData is a base64 data URL
      // pdf-exporter expects Uint8Array of PNG bytes
      const signaturesForExport = placedForExport.map(sig => ({
        page: sig.page,
        x: sig.pdfX,
        y: sig.pdfY,
        width: sig.pdfWidth,
        height: sig.pdfHeight,
        imageData: base64ToUint8Array(sig.imageData),
      }));

      // Export
      const originalBytes = new Uint8Array(pdfData);
      const exportResult = await exportSignedPdf(originalBytes, signaturesForExport);

      // Save via dedicated IPC handler — slice the buffer to get only the relevant bytes
      const pdfBytes = exportResult.buffer.slice(
        exportResult.byteOffset,
        exportResult.byteOffset + exportResult.byteLength
      );
      const saveResult = await api.saveSignedPdf(pdfBytes, pdfFileName || 'signed.pdf');
      if (saveResult && saveResult.error) {
        console.error('Failed to save file:', saveResult.error);
        showError('Failed to save PDF');
        return;
      }
      if (saveResult === null) return; // User canceled

      showSuccess('PDF exported successfully');
    } catch (err) {
      console.error('Failed to export:', err);
      showError('Failed to export PDF');
    }
  }

  function base64ToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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

  function handlePageChange(page) {
    currentPage = page;
  }

  function handleZoomChange(z) {
    zoom = Math.round(z * 100);
  }

  function handlePageInfo(info) {
    currentPage = info.pageNum;
    totalPages = info.totalPages;
    pageDimensions[info.pageNum] = { width: info.pageWidth, height: info.pageHeight };
  }

  // --- Signature dropdown handlers ---

  function handleCreateNew() {
    showSignDropdown = false;
    showCameraModal = true;
  }

  function handleSelectSignature(signature) {
    selectedSignature = signature;
    showSignDropdown = false;
  }

  function handleDeleteSignature(id) {
    if (store) {
      store.delete(id);
      signatures = store.getAll();
    }
  }

  // --- Camera capture → process → save ---

  async function handleCameraCapture({ capturedCanvas, cropRect, threshold }) {
    try {
      // Crop the captured image
      const croppedCanvas = cropImage(capturedCanvas, cropRect);
      const ctx = croppedCanvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);

      // Remove background
      const processedImageData = removeBackground(imageData, threshold);

      // Convert to base64 PNG
      const base64Png = imageDataToBase64(processedImageData);

      // Save to store
      if (store) {
        const name = 'Signature ' + (signatures.length + 1);
        store.add(name, base64Png);
        signatures = store.getAll();
      }

      showCameraModal = false;
    } catch (err) {
      console.error('Failed to process signature:', err);
      showError('Failed to process signature');
    }
  }

  // Undo support (Ctrl+Z)
  function handleUndo() {
    if (placementRef) {
      placementRef.removeLastPlaced?.();
    }
  }

  onMount(() => {
    function handleKeyDown(e) {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenPdf();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExport();
      } else if (e.key === 'Escape') {
        if (showCameraModal) {
          showCameraModal = false;
        } else if (showSignDropdown) {
          showSignDropdown = false;
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Toolbar area with dropdown positioning context -->
  <div class="relative">
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
    {#if showSignDropdown}
      <div class="absolute top-12 left-24 z-50">
        <SignatureDropdown
          signatures={signatures}
          isOpen={showSignDropdown}
          onSelect={handleSelectSignature}
          onDelete={handleDeleteSignature}
          onCreateNew={handleCreateNew}
          onClose={() => showSignDropdown = false}
        />
      </div>
    {/if}
  </div>

  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden relative">
    {#if pdfData}
      <div class="relative w-full h-full">
        <PdfViewer
          {pdfData}
          targetPage={currentPage}
          targetZoom={zoom}
          onPageChange={handlePageChange}
          onZoomChange={handleZoomChange}
          onPageInfo={handlePageInfo}
          getCanvasRef={(ref) => canvasRef = ref}
        />
        {#if selectedSignature}
          <SignaturePlacement
            {selectedSignature}
            currentPage={currentPage}
            {canvasRef}
            bind:this={placementRef}
          />
        {/if}
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

  <!-- Camera Modal -->
  <CameraModal
    isOpen={showCameraModal}
    onCapture={handleCameraCapture}
    onCancel={() => showCameraModal = false}
  />

  <!-- Notification toast -->
  {#if notification}
    <div
      in:fly={{ y: 30, duration: 250 }}
      out:fade={{ duration: 200 }}
      class="fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-white text-sm
        {notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'}">
      {notification.message}
    </div>
  {/if}
</div>
