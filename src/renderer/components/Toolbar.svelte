<script>
  let {
    onOpenPdf,
    onSaveAs,
    onSign,
    hasPdf = false,
    // TODO: hasSignatures will be used to toggle export availability when signature validation is implemented
    hasSignatures = false,
    currentPage = 1,
    totalPages = 1,
    zoom = 100,
    onPrevPage = () => {},
    onNextPage = () => {},
    onZoomIn = () => {},
    onZoomOut = () => {},
  } = $props();
</script>

<div class="bg-white border-b border-gray-200 shadow-sm h-12 flex items-center px-3 gap-1 shrink-0 select-none">
  <!-- Left section: File operations -->
  <div class="flex items-center gap-1">
    <!-- Open PDF -->
    <button
      onclick={onOpenPdf}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      title="Open PDF"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      Open PDF
    </button>

    <!-- Save As -->
    <button
      onclick={onSaveAs}
      disabled={!hasPdf}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      title="Save signed PDF as..."
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Save As
    </button>
  </div>

  <!-- Divider -->
  <div class="w-px h-6 bg-gray-200 mx-2"></div>

  <!-- Center-left: Sign button -->
  <button
    onclick={onSign}
    disabled={!hasPdf}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      title="Sign document"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
    </svg>
    Sign
  </button>

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Center: Title -->
  <span class="text-sm font-semibold text-gray-400 tracking-tight select-none">Signaturizer</span>

  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Right section: Page navigation + zoom -->
  <div class="flex items-center gap-1">
    <!-- Page navigation -->
    {#if hasPdf}
      <button
        onclick={onPrevPage}
        disabled={currentPage <= 1}
        class="p-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        title="Previous page"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <span class="text-xs text-gray-600 min-w-[4rem] text-center tabular-nums">
        {currentPage} / {totalPages}
      </span>

      <button
        onclick={onNextPage}
        disabled={currentPage >= totalPages}
        class="p-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        title="Next page"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- Divider -->
      <div class="w-px h-6 bg-gray-200 mx-1"></div>

      <!-- Zoom controls -->
      <button
        onclick={onZoomOut}
        class="p-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        title="Zoom out"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </button>

      <span class="text-xs text-gray-600 min-w-[3rem] text-center tabular-nums">
        {zoom}%
      </span>

      <button
        onclick={onZoomIn}
        class="p-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        title="Zoom in"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
      </button>
    {/if}
  </div>
</div>
