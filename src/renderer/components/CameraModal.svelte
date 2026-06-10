<script>
  import { untrack } from 'svelte';
  import { cropImage, removeBackground } from '../../lib/image-processor.js';

  let { isOpen = false, onCapture, onCancel } = $props();

  // Mode
  let mode = $state('camera'); // 'camera' | 'crop'

  // Camera state
  let stream = $state(null);
  let videoDevices = $state([]);
  let selectedDeviceId = $state('');
  let cameraError = $state(null);
  let videoReady = $state(false);

  // Capture state
  let capturedCanvas = $state(null);

  // Crop state
  let cropRect = $state({ x: 0, y: 0, width: 100, height: 60 });
  let threshold = $state(200);

  // Drag interaction state
  let isDragging = $state(false);
  let dragHandle = $state(null);
  let dragStart = $state({ x: 0, y: 0 });
  let dragRectStart = $state({ x: 0, y: 0, width: 0, height: 0 });

  // Hover handle for cursor feedback
  let hoverHandle = $state(null);

  // Refs
  let videoEl = $state(null);
  let imageContainerEl = $state(null);
  let previewCanvasEl = $state(null);

  // Display dimensions of the captured image in the container
  let displayWidth = $state(0);
  let displayHeight = $state(0);

  // Derived: scale factor from captured canvas to display
  let scaleFactor = $derived(
    capturedCanvas && displayWidth > 0
      ? capturedCanvas.width / displayWidth
      : 1
  );

  // --- Camera management ---

  async function startCamera(deviceId) {
    stopStream();

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    } else {
      constraints.video.facingMode = 'environment';
    }

    try {
      cameraError = null;
      videoReady = false;
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      stream = s;

      // Update selected device from active track
      const track = s.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        if (settings.deviceId) {
          selectedDeviceId = settings.deviceId;
        }
      }

      await enumerateDevices();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        cameraError = 'Camera access denied. Please grant permission and try again.';
      } else if (err.name === 'NotFoundError') {
        cameraError = 'No camera found. Please connect a camera and try again.';
      } else {
        cameraError = `Camera error: ${err.message}`;
      }
    }
  }

  async function enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
    } catch {
      videoDevices = [];
    }
  }

  function stopStream() {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      stream = null;
    }
  }

  // --- Open/close lifecycle ---

  $effect(() => {
    const open = isOpen;
    if (open) {
      mode = 'camera';
      capturedCanvas = null;
      cameraError = null;
      cropRect = { x: 0, y: 0, width: 100, height: 60 };
      threshold = 200;
      hoverHandle = null;
      untrack(() => startCamera(selectedDeviceId));
    }

    return () => {
      stopStream();
      capturedCanvas = null;
      cropRect = { x: 0, y: 0, width: 0, height: 0 };
    };
  });

  // --- Bind stream to video element ---

  $effect(() => {
    const el = videoEl;
    const s = stream;
    if (el && s) {
      el.srcObject = s;
    }
  });

  // --- Capture frame ---

  function captureFrame() {
    if (!videoEl) return;

    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);

    capturedCanvas = canvas;
    mode = 'crop';
    stopStream();

    // Default crop: centered 60%
    const cw = Math.round(w * 0.6);
    const ch = Math.round(h * 0.6);
    cropRect = {
      x: Math.round((w - cw) / 2),
      y: Math.round((h - ch) / 2),
      width: cw,
      height: ch,
    };
  }

  // --- Reset to camera mode ---

  function resetToCamera() {
    capturedCanvas = null;
    mode = 'camera';
    cropRect = { x: 0, y: 0, width: 100, height: 60 };
    hoverHandle = null;
    startCamera(selectedDeviceId);
  }

  // --- Done ---

  function handleDone() {
    if (typeof onCapture === 'function') {
      onCapture({ capturedCanvas, cropRect, threshold });
    }
  }

  function handleCancel() {
    if (typeof onCancel === 'function') {
      onCancel();
    }
  }

  // --- Display dimensions observer ---

  $effect(() => {
    const container = imageContainerEl;
    const canvas = capturedCanvas;
    if (!container || !canvas) return;

    function update() {
      const rect = container.getBoundingClientRect();
      displayWidth = rect.width;
      displayHeight = rect.height;
    }

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);

    return () => ro.disconnect();
  });

  // --- Live preview ---

  $effect(() => {
    const canvas = capturedCanvas;
    const rect = cropRect;
    const thresh = threshold;
    const previewEl = previewCanvasEl;

    if (!canvas || !previewEl) return;

    let rafId;

    function render() {
      try {
        const cropped = cropImage(canvas, rect);
        const ctx = cropped.getContext('2d');
        const imgData = ctx.getImageData(0, 0, cropped.width, cropped.height);
        const processed = removeBackground(imgData, thresh);
        ctx.putImageData(processed, 0, 0);

        // Scale preview to fit ~150px max dimension
        const maxDim = 150;
        const scale = Math.min(maxDim / cropped.width, maxDim / cropped.height, 1);
        previewEl.width = Math.round(cropped.width * scale);
        previewEl.height = Math.round(cropped.height * scale);

        const pCtx = previewEl.getContext('2d');
        pCtx.clearRect(0, 0, previewEl.width, previewEl.height);
        pCtx.drawImage(cropped, 0, 0, previewEl.width, previewEl.height);
      } catch {
        // Ignore render errors during rapid interaction
      }
    }

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });

  // --- Crop interaction ---

  function getImageCoords(event) {
    if (!imageContainerEl || !capturedCanvas) return null;
    const containerRect = imageContainerEl.getBoundingClientRect();
    const scaleX = capturedCanvas.width / containerRect.width;
    const scaleY = capturedCanvas.height / containerRect.height;
    return {
      x: (event.clientX - containerRect.left) * scaleX,
      y: (event.clientY - containerRect.top) * scaleY,
    };
  }

  function handleCropMouseDown(event) {
    event.preventDefault();
    const coords = getImageCoords(event);
    if (!coords) return;

    const handle = getHandleAtPoint(coords.x, coords.y);
    isDragging = true;
    dragHandle = handle;
    dragStart = { x: coords.x, y: coords.y };
    dragRectStart = { ...cropRect };

    window.addEventListener('mousemove', handleCropMouseMove);
    window.addEventListener('mouseup', handleCropMouseUp);
  }

  function handleCropMouseMove(event) {
    if (!isDragging) return;

    requestAnimationFrame(() => {
      if (!dragHandle) return;

      const coords = getImageCoords(event);
      if (!coords) return;

      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      const cr = dragRectStart;
      const cw = capturedCanvas.width;
      const ch = capturedCanvas.height;
      const minW = 50;
      const minH = 30;

      if (dragHandle === 'move') {
        cropRect = {
          ...cropRect,
          x: clamp(cr.x + dx, 0, cw - cr.width),
          y: clamp(cr.y + dy, 0, ch - cr.height),
        };
      } else {
        let { x, y, width, height } = { ...cr };

        if (dragHandle.includes('e')) {
          width = clamp(cr.width + dx, minW, cw - cr.x);
        }
        if (dragHandle.includes('w')) {
          const newWidth = clamp(cr.width - dx, minW, cr.x + cr.width);
          x = cr.x + cr.width - newWidth;
          width = newWidth;
        }
        if (dragHandle.includes('s')) {
          height = clamp(cr.height + dy, minH, ch - cr.y);
        }
        if (dragHandle.includes('n')) {
          const newHeight = clamp(cr.height - dy, minH, cr.y + cr.height);
          y = cr.y + cr.height - newHeight;
          height = newHeight;
        }

        cropRect = { x, y, width, height };
      }
    });
  }

  function handleCropMouseUp() {
    isDragging = false;
    dragHandle = null;
    window.removeEventListener('mousemove', handleCropMouseMove);
    window.removeEventListener('mouseup', handleCropMouseUp);
  }

  function handleCropHover(event) {
    if (isDragging) return;
    const coords = getImageCoords(event);
    if (coords) {
      hoverHandle = getHandleAtPoint(coords.x, coords.y);
    }
  }

  function handleCropMouseLeave() {
    if (!isDragging) {
      hoverHandle = null;
    }
  }

  function getHandleAtPoint(px, py) {
    const cr = cropRect;
    const sf = scaleFactor;
    const handleSize = 12 / sf; // 12px in display space → image space

    // Check corners first (they're smaller targets)
    const corners = [
      { name: 'nw', cx: cr.x, cy: cr.y },
      { name: 'ne', cx: cr.x + cr.width, cy: cr.y },
      { name: 'sw', cx: cr.x, cy: cr.y + cr.height },
      { name: 'se', cx: cr.x + cr.width, cy: cr.y + cr.height },
    ];

    for (const c of corners) {
      if (Math.abs(px - c.cx) <= handleSize && Math.abs(py - c.cy) <= handleSize) {
        return c.name;
      }
    }

    // Check edges
    if (px >= cr.x - handleSize && px <= cr.x + cr.width + handleSize &&
        py >= cr.y - handleSize && py <= cr.y + cr.height + handleSize) {
      if (Math.abs(px - cr.x) <= handleSize) return 'w';
      if (Math.abs(px - (cr.x + cr.width)) <= handleSize) return 'e';
      if (Math.abs(py - cr.y) <= handleSize) return 'n';
      if (Math.abs(py - (cr.y + cr.height)) <= handleSize) return 's';
      return 'move';
    }

    return 'move';
  }

  function getCursorForHandle(handle) {
    if (!handle) return 'crosshair';
    const cursors = {
      nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
      n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
      move: 'move',
    };
    return cursors[handle] || 'crosshair';
  }

  // Active cursor during drag or hover
  let activeCursor = $derived(
    isDragging && dragHandle
      ? getCursorForHandle(dragHandle)
      : getCursorForHandle(hoverHandle)
  );

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // --- Crop rect in display (CSS) coordinates for overlay ---
  let cropDisplayRect = $derived.by(() => {
    if (!capturedCanvas || displayWidth === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const scaleX = displayWidth / capturedCanvas.width;
    const scaleY = displayHeight / capturedCanvas.height;
    return {
      x: cropRect.x * scaleX,
      y: cropRect.y * scaleY,
      width: cropRect.width * scaleX,
      height: cropRect.height * scaleY,
    };
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onmousedown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
  >
    <div class="bg-white rounded-xl shadow-xl w-full max-w-[600px] mx-4 overflow-hidden transition-all duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 class="text-sm font-semibold text-gray-700">
          {mode === 'camera' ? 'Camera Capture' : 'Crop & Adjust'}
        </h2>
        <button
          onclick={handleCancel}
          class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-4 space-y-3">
        <!-- Camera / Image area -->
        <div
          class="relative bg-gray-900 rounded-lg overflow-hidden"
          style="max-height: 500px;"
        >
          {#if mode === 'camera'}
            <div class="relative flex items-center justify-center" style="min-height: 300px;">
              {#if cameraError}
                <div class="flex items-center justify-center h-full p-8">
                  <div class="text-center">
                    <svg class="mx-auto mb-3 w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
                    </svg>
                    <p class="text-sm text-red-300">{cameraError}</p>
                  </div>
                </div>
              {:else if stream}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                  bind:this={videoEl}
                  autoplay
                  playsinline
                  muted
                  class="w-full max-h-[500px] object-contain"
                  onloadeddata={() => { videoReady = true; }}
                ></video>
                <!-- Alignment guide -->
                <div class="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-white/40 pointer-events-none"></div>
              {:else}
                <div class="text-center text-gray-400">
                  <p class="text-sm">Starting camera...</p>
                </div>
              {/if}
            </div>
          {:else if mode === 'crop' && capturedCanvas}
            <!-- Captured image with crop overlay -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              bind:this={imageContainerEl}
              class="relative"
              style="cursor: {activeCursor}"
              onmousedown={handleCropMouseDown}
              onmousemove={handleCropHover}
              onmouseleave={handleCropMouseLeave}
            >
              <img
                src={capturedCanvas.toDataURL()}
                alt="Captured frame"
                class="w-full max-h-[500px] object-contain block"
                draggable="false"
              />

              <!-- Dimmed overlay outside crop using box-shadow technique -->
              <div
                class="absolute pointer-events-none border-2 border-dashed border-white/80"
                style="
                  left: {cropDisplayRect.x}px;
                  top: {cropDisplayRect.y}px;
                  width: {cropDisplayRect.width}px;
                  height: {cropDisplayRect.height}px;
                  box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
                "
              ></div>

              <!-- Crop handles -->
              {#each [
                { name: 'nw', cx: cropDisplayRect.x, cy: cropDisplayRect.y },
                { name: 'ne', cx: cropDisplayRect.x + cropDisplayRect.width, cy: cropDisplayRect.y },
                { name: 'sw', cx: cropDisplayRect.x, cy: cropDisplayRect.y + cropDisplayRect.height },
                { name: 'se', cx: cropDisplayRect.x + cropDisplayRect.width, cy: cropDisplayRect.y + cropDisplayRect.height },
              ] as handle}
                <div
                  class="absolute w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm pointer-events-none"
                  style="
                    left: {handle.cx - 6}px;
                    top: {handle.cy - 6}px;
                    cursor: {getCursorForHandle(handle.name)};
                  "
                ></div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Controls -->
        {#if mode === 'camera'}
          <!-- Camera selection -->
          {#if videoDevices.length > 1}
            <div class="flex items-center gap-2">
              <label for="camera-select" class="text-xs font-medium text-gray-600 shrink-0">Camera:</label>
              <select
                id="camera-select"
                class="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                bind:value={selectedDeviceId}
                onchange={() => startCamera(selectedDeviceId)}
              >
                {#each videoDevices as device}
                  <option value={device.deviceId}>{device.label}</option>
                {/each}
              </select>
            </div>
          {/if}
        {:else if mode === 'crop'}
          <!-- Threshold slider -->
          <div class="flex items-center gap-3">
            <label for="threshold-slider" class="text-xs font-medium text-gray-600 shrink-0">Threshold:</label>
            <input
              id="threshold-slider"
              type="range"
              min="0"
              max="255"
              step="1"
              bind:value={threshold}
              class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span class="text-xs text-gray-600 tabular-nums w-8 text-right">{threshold}</span>
          </div>

          <!-- Live preview -->
          <div class="flex items-start gap-3">
            <span class="text-xs font-medium text-gray-500 shrink-0 mt-1">Preview:</span>
            <div class="bg-gray-100 rounded border border-gray-200 p-1 inline-block">
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <canvas
                bind:this={previewCanvasEl}
                class="block max-w-[150px] max-h-[150px]"
              ></canvas>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer actions -->
      <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
        {#if mode === 'crop'}
          <button
            onclick={resetToCamera}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Clear
          </button>
        {/if}

        {#if mode === 'camera'}
          <button
            onclick={handleCancel}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Cancel
          </button>
          <button
            onclick={captureFrame}
            disabled={!stream || !!cameraError || !videoReady}
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Capture
          </button>
        {:else}
          <button
            onclick={handleDone}
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Done
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
