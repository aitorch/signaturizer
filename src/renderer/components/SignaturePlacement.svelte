<script>
  import { v4 as uuidv4 } from 'uuid';
  import { applyColorTint, imageDataToBase64, base64ToImageData } from '../../lib/image-processor.js';

  let {
    selectedSignature = null,
    currentPage = 1,
    canvasRef = null,
    onSignaturesChanged = null,
  } = $props();

  let placedSignatures = $state([]);
  let selectedPlacedId = $state(null);
  let isDragging = $state(false);
  let isResizing = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let resizeHandle = $state(null);
  let resizeStart = $state(null);
  let overlayEl = $state(null);

  const DEFAULT_WIDTH = 200;
  const DEFAULT_HEIGHT = 100;
  const MIN_WIDTH = 30;
  const MIN_HEIGHT = 20;
  const HANDLE_SIZE = 8;

  const COLOR_PRESETS = [
    { label: 'Black', value: { r: 0, g: 0, b: 0 }, hex: '#000000' },
    { label: 'Blue', value: { r: 0, g: 0, b: 204 }, hex: '#0000CC' },
    { label: 'Dark Gray', value: { r: 51, g: 51, b: 51 }, hex: '#333333' },
  ];

  // ---- Expose method for parent via bind:this ----
  function getPlacedSignatures(canvasWidth, canvasHeight, pdfPageWidth, pdfPageHeight) {
    return placedSignatures
      .filter(s => s.page === currentPage)
      .map(s => {
        // Use stored canvas dimensions if available for accuracy
        const cw = s.canvasWidth || canvasWidth;
        const ch = s.canvasHeight || canvasHeight;
        return {
          ...s,
          pdfX: (s.x / cw) * pdfPageWidth,
          pdfY: pdfPageHeight - ((s.y + s.height) / ch) * pdfPageHeight,
          pdfWidth: (s.width / cw) * pdfPageWidth,
          pdfHeight: (s.height / ch) * pdfPageHeight,
        };
      });
  }

  function getAllPlacedSignatures() {
    return [...placedSignatures];
  }

  // Expose via module-level so parent can bind:this and call
  // Svelte 5 bind:this on a component gives the component instance
  // We attach methods to the component via export
  export function getPlacedSignaturesForExport(canvasWidth, canvasHeight, pdfPageWidth, pdfPageHeight) {
    return getPlacedSignatures(canvasWidth, canvasHeight, pdfPageWidth, pdfPageHeight);
  }

  export function getAllPlaced() {
    return getAllPlacedSignatures();
  }

  export function getAllPlacedForExport(canvasWidth, canvasHeight, pageDimensions) {
    // pageDimensions is an object: { [pageNum]: { width, height } }
    // Each signature stores the canvas dimensions at placement time.
    // We use those stored dimensions (not the current canvas) for coordinate
    // conversion, so zoom changes after placement don't affect export accuracy.
    return placedSignatures.map(sig => {
      const dims = pageDimensions[sig.page];
      if (!dims) return null;
      // Use the canvas dimensions recorded at placement time
      const cw = sig.canvasWidth || canvasWidth;
      const ch = sig.canvasHeight || canvasHeight;
      return {
        ...sig,
        pdfX: (sig.x / cw) * dims.width,
        pdfY: dims.height - ((sig.y + sig.height) / ch) * dims.height,
        pdfWidth: (sig.width / cw) * dims.width,
        pdfHeight: (sig.height / ch) * dims.height,
      };
    }).filter(Boolean);
  }

  export function removeLastPlaced() {
    if (placedSignatures.length === 0) return;
    const last = placedSignatures[placedSignatures.length - 1];
    placedSignatures = placedSignatures.slice(0, -1);
    if (selectedPlacedId === last.id) {
      selectedPlacedId = null;
    }
    notifyChanged();
  }

  // ---- Helper: get mouse position relative to overlay ----
  function getRelativePos(e) {
    if (!overlayEl) return { x: 0, y: 0 };
    const rect = overlayEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // ---- Notify parent ----
  function notifyChanged() {
    if (typeof onSignaturesChanged === 'function') {
      onSignaturesChanged([...placedSignatures]);
    }
  }

  // ---- Place Signature ----
  function handlePlaceClick(e) {
    if (!selectedSignature) return;

    const pos = getRelativePos(e);
    const id = uuidv4();

    // Record the canvas (overlay) dimensions at placement time so export
    // can convert coordinates correctly regardless of later zoom changes.
    const canvasWidth = overlayEl ? overlayEl.clientWidth : 0;
    const canvasHeight = overlayEl ? overlayEl.clientHeight : 0;

    const newSig = {
      id,
      signatureId: selectedSignature.id,
      page: currentPage,
      x: pos.x - DEFAULT_WIDTH / 2,
      y: pos.y - DEFAULT_HEIGHT / 2,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      imageData: selectedSignature.imageData,
      originalImageData: selectedSignature.imageData,
      color: null,
      canvasWidth,
      canvasHeight,
    };

    // Constrain within overlay
    if (overlayEl) {
      const ow = overlayEl.clientWidth;
      const oh = overlayEl.clientHeight;
      newSig.x = Math.max(0, Math.min(newSig.x, ow - newSig.width));
      newSig.y = Math.max(0, Math.min(newSig.y, oh - newSig.height));
    }

    placedSignatures = [...placedSignatures, newSig];
    selectedPlacedId = id;
    notifyChanged();
  }

  // ---- Select / Deselect ----
  function selectPlaced(e, id) {
    e.stopPropagation();
    selectedPlacedId = id;
  }

  function handleBackgroundClick(e) {
    // If no selectedSignature, clicking background deselects
    if (!selectedSignature) {
      selectedPlacedId = null;
    }
  }

  // ---- Dragging ----
  function startDrag(e, sig) {
    if (isResizing) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    isDragging = true;
    dragOffset = { x: pos.x - sig.x, y: pos.y - sig.y };
    selectedPlacedId = sig.id;
  }

  function handleMouseMove(e) {
    if (isResizing) {
      handleResizeMove(e);
      return;
    }
    if (!isDragging || !selectedPlacedId) return;

    const pos = getRelativePos(e);
    let newX = pos.x - dragOffset.x;
    let newY = pos.y - dragOffset.y;

    // Constrain
    if (overlayEl) {
      const sig = placedSignatures.find(s => s.id === selectedPlacedId);
      if (sig) {
        const ow = overlayEl.clientWidth;
        const oh = overlayEl.clientHeight;
        newX = Math.max(0, Math.min(newX, ow - sig.width));
        newY = Math.max(0, Math.min(newY, oh - sig.height));

        placedSignatures = placedSignatures.map(s =>
          s.id === selectedPlacedId ? { ...s, x: newX, y: newY } : s
        );
      }
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      dragOffset = { x: 0, y: 0 };
      notifyChanged();
    }
    if (isResizing) {
      isResizing = false;
      resizeHandle = null;
      resizeStart = null;
      notifyChanged();
    }
  }

  // ---- Resizing ----
  function startResize(e, sig, handle) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    isResizing = true;
    resizeHandle = handle;
    resizeStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: sig.x,
      y: sig.y,
      width: sig.width,
      height: sig.height,
      sigId: sig.id,
    };
  }

  function handleResizeMove(e) {
    if (!isResizing || !resizeStart) return;

    const dx = e.clientX - resizeStart.mouseX;
    const dy = e.clientY - resizeStart.mouseY;
    const aspectRatio = resizeStart.width / resizeStart.height;

    let newX = resizeStart.x;
    let newY = resizeStart.y;
    let newW = resizeStart.width;
    let newH = resizeStart.height;

    // Determine resize direction based on handle
    if (resizeHandle === 'br') {
      newW = Math.max(MIN_WIDTH, resizeStart.width + dx);
      newH = newW / aspectRatio;
      if (newH < MIN_HEIGHT) {
        newH = MIN_HEIGHT;
        newW = newH * aspectRatio;
      }
    } else if (resizeHandle === 'bl') {
      newW = Math.max(MIN_WIDTH, resizeStart.width - dx);
      newH = newW / aspectRatio;
      if (newH < MIN_HEIGHT) {
        newH = MIN_HEIGHT;
        newW = newH * aspectRatio;
      }
      newX = resizeStart.x + resizeStart.width - newW;
    } else if (resizeHandle === 'tr') {
      newW = Math.max(MIN_WIDTH, resizeStart.width + dx);
      newH = newW / aspectRatio;
      if (newH < MIN_HEIGHT) {
        newH = MIN_HEIGHT;
        newW = newH * aspectRatio;
      }
      newY = resizeStart.y + resizeStart.height - newH;
    } else if (resizeHandle === 'tl') {
      newW = Math.max(MIN_WIDTH, resizeStart.width - dx);
      newH = newW / aspectRatio;
      if (newH < MIN_HEIGHT) {
        newH = MIN_HEIGHT;
        newW = newH * aspectRatio;
      }
      newX = resizeStart.x + resizeStart.width - newW;
      newY = resizeStart.y + resizeStart.height - newH;
    }

    placedSignatures = placedSignatures.map(s =>
      s.id === resizeStart.sigId ? { ...s, x: newX, y: newY, width: newW, height: newH } : s
    );
  }

  // ---- Delete ----
  function handleKeyDown(e) {
    if (!selectedPlacedId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      e.preventDefault();
      placedSignatures = placedSignatures.filter(s => s.id !== selectedPlacedId);
      selectedPlacedId = null;
      notifyChanged();
    }
  }

  // ---- Color Tinting ----
  async function applyTint(sigId, color) {
    const sig = placedSignatures.find(s => s.id === sigId);
    if (!sig) return;

    try {
      // Load original (untinted) signature image to prevent tint compounding
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = sig.originalImageData;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const tintedData = applyColorTint(imgData, color);
      const tintedBase64 = imageDataToBase64(tintedData);

      placedSignatures = placedSignatures.map(s =>
        s.id === sigId ? { ...s, imageData: tintedBase64, color } : s
      );
      notifyChanged();
    } catch (err) {
      console.error('Failed to apply color tint:', err);
    }
  }

  async function removeTint(sigId) {
    const sig = placedSignatures.find(s => s.id === sigId);
    if (!sig) return;

    // Restore the original (untinted) imageData
    placedSignatures = placedSignatures.map(s =>
      s.id === sigId ? { ...s, imageData: s.originalImageData, color: null } : s
    );
    notifyChanged();
  }

  function handleColorPreset(color) {
    if (!selectedPlacedId) return;
    applyTint(selectedPlacedId, color);
  }

  function handleCustomColor(e) {
    if (!selectedPlacedId) return;
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    applyTint(selectedPlacedId, { r, g, b });
  }

  function handleRemoveColor() {
    if (!selectedPlacedId) return;
    removeTint(selectedPlacedId);
  }

  // ---- Get selected signature for color picker positioning ----
  let selectedSig = $derived(placedSignatures.find(s => s.id === selectedPlacedId));

  // ---- Global event listeners ----
  $effect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div
  class="absolute inset-0"
  style="pointer-events: none;"
  bind:this={overlayEl}
>
  <!-- Click area for placing new signatures -->
  {#if selectedSignature}
    <div
      class="absolute inset-0 cursor-crosshair"
      style="pointer-events: auto;"
      onclick={handlePlaceClick}
      role="button"
      tabindex="-1"
      aria-label="Click to place signature"
    ></div>
  {:else}
    <!-- Background click area for deselecting -->
    <div
      class="absolute inset-0"
      style="pointer-events: auto;"
      onclick={handleBackgroundClick}
      role="button"
      tabindex="-1"
      aria-label="Click to deselect"
    ></div>
  {/if}

  <!-- Placed signatures for current page -->
  {#each placedSignatures.filter(s => s.page === currentPage) as sig (sig.id)}
    <div
      class="absolute {sig.id === selectedPlacedId ? 'ring-2 ring-indigo-500' : ''}"
      style="left: {sig.x}px; top: {sig.y}px; width: {sig.width}px; height: {sig.height}px; pointer-events: auto; cursor: move;"
      onclick={(e) => selectPlaced(e, sig.id)}
      onmousedown={(e) => startDrag(e, sig)}
      role="button"
      tabindex="0"
      aria-label="Placed signature"
    >
      <img
        src={sig.imageData}
        class="w-full h-full object-contain select-none"
        draggable="false"
        alt="Placed signature"
      />

      <!-- Resize handles when selected -->
      {#if sig.id === selectedPlacedId}
        <!-- Top-left -->
        <div
          class="absolute -top-1 -left-1 w-2 h-2 bg-white border border-indigo-500 cursor-nw-resize"
          style="pointer-events: auto;"
          onmousedown={(e) => startResize(e, sig, 'tl')}
          role="button"
          tabindex="-1"
          aria-label="Resize top-left"
        ></div>
        <!-- Top-right -->
        <div
          class="absolute -top-1 -right-1 w-2 h-2 bg-white border border-indigo-500 cursor-ne-resize"
          style="pointer-events: auto;"
          onmousedown={(e) => startResize(e, sig, 'tr')}
          role="button"
          tabindex="-1"
          aria-label="Resize top-right"
        ></div>
        <!-- Bottom-left -->
        <div
          class="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-indigo-500 cursor-sw-resize"
          style="pointer-events: auto;"
          onmousedown={(e) => startResize(e, sig, 'bl')}
          role="button"
          tabindex="-1"
          aria-label="Resize bottom-left"
        ></div>
        <!-- Bottom-right -->
        <div
          class="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-indigo-500 cursor-se-resize"
          style="pointer-events: auto;"
          onmousedown={(e) => startResize(e, sig, 'br')}
          role="button"
          tabindex="-1"
          aria-label="Resize bottom-right"
        ></div>
      {/if}
    </div>
  {/each}

  <!-- Color picker panel for selected signature -->
  {#if selectedPlacedId && selectedSig}
    {@const pickerX = Math.min(selectedSig.x + selectedSig.width + 10, (overlayEl ? overlayEl.clientWidth : 800) - 180)}
    {@const pickerY = Math.max(selectedSig.y, 0)}
    <div
      class="absolute bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50"
      style="left: {pickerX}px; top: {pickerY}px; pointer-events: auto; min-width: 160px;"
    >
      <p class="text-xs font-medium text-gray-600 mb-2">Signature Color</p>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each COLOR_PRESETS as preset}
          <button
            class="w-6 h-6 rounded border border-gray-300 hover:ring-2 hover:ring-indigo-400 transition-shadow"
            style="background-color: {preset.hex};"
            onclick={() => handleColorPreset(preset.value)}
            title={preset.label}
            aria-label="Set color to {preset.label}"
          ></button>
        {/each}
        <div class="flex items-center">
          <input
            type="color"
            class="w-6 h-6 cursor-pointer border border-gray-300 rounded"
            onchange={handleCustomColor}
            title="Custom color"
            aria-label="Choose custom color"
          />
        </div>
      </div>
      <button
        class="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        onclick={handleRemoveColor}
      >
        None (original)
      </button>
    </div>
  {/if}
</div>
