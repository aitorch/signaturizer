/**
 * Image processing library for Signaturizer.
 * Works with Canvas ImageData for webcam frame capture,
 * background removal, color tinting, and format conversion.
 */

/**
 * Compute grayscale luminance for an RGB pixel using ITU-R BT.601 weights.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function luminance(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Capture the current frame from a video element.
 * @param {HTMLVideoElement} videoElement
 * @returns {HTMLCanvasElement} Offscreen canvas with the drawn frame
 */
export function captureFrame(videoElement) {
  if (!videoElement) {
    throw new Error('videoElement is required');
  }

  const width = videoElement.videoWidth || videoElement.width || 640;
  const height = videoElement.videoHeight || videoElement.height || 480;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, width, height);

  return canvas;
}

/**
 * Crop a rectangular region from a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {HTMLCanvasElement} New canvas with the cropped region
 */
export function cropImage(canvas, rect) {
  if (!canvas) {
    throw new Error('canvas is required');
  }

  if (!rect || typeof rect !== 'object') {
    throw new Error('rect must be an object with x, y, width, height');
  }

  const { x = 0, y = 0, width = 0, height = 0 } = rect;

  if (width <= 0 || height <= 0) {
    throw new Error('rect width and height must be positive');
  }

  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;

  const ctx = cropped.getContext('2d');
  ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  return cropped;
}

/**
 * Remove light background from image data by making bright pixels transparent.
 * Creates a NEW ImageData — the original is never mutated.
 *
 * @param {ImageData} imageData
 * @param {number} [threshold=200] Luminance threshold (0-255). Pixels above this become transparent.
 * @returns {ImageData} New ImageData with transparent background
 */
export function removeBackground(imageData, threshold = 200) {
  if (!imageData || !imageData.data) {
    throw new Error('imageData is required');
  }

  if (typeof threshold !== 'number' || Number.isNaN(threshold) || threshold < 0 || threshold > 255) {
    throw new Error('threshold must be a number between 0 and 255');
  }

  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];
    const lum = luminance(r, g, b);

    if (lum > threshold) {
      // Background pixel — make transparent
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 0;
    } else {
      // Foreground pixel — keep but slightly darken for better contrast
      const darken = 0.9;
      out[i] = Math.round(r * darken);
      out[i + 1] = Math.round(g * darken);
      out[i + 2] = Math.round(b * darken);
      out[i + 3] = a;
    }
  }

  return new ImageData(out, imageData.width, imageData.height);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Remove paper and shadows from a signature capture.
 *
 * The old threshold method treated every dark-ish pixel as ink, so paper
 * shadows became part of the raster. This uses local contrast instead:
 * each pixel is compared with the average brightness around it. Gradual
 * lighting changes vanish, while strokes stay because they are dark
 * relative to nearby paper.
 *
 * @param {ImageData} imageData
 * @param {{ sensitivity?: number, radius?: number, softness?: number }} [options]
 * @returns {ImageData} New ImageData with a transparent paper background
 */
export function removePaperBackground(imageData, options = {}) {
  if (!imageData || !imageData.data) {
    throw new Error('imageData is required');
  }

  const sensitivity = options.sensitivity ?? 14;
  const radius = Math.max(3, Math.round(options.radius ?? Math.min(36, Math.max(10, Math.min(imageData.width, imageData.height) / 24))));
  const softness = Math.max(4, options.softness ?? 12);

  if (typeof sensitivity !== 'number' || Number.isNaN(sensitivity) || sensitivity < 0 || sensitivity > 255) {
    throw new Error('sensitivity must be a number between 0 and 255');
  }

  const { width, height } = imageData;
  const src = imageData.data;
  const pixelCount = width * height;
  const lum = new Float32Array(pixelCount);
  const integral = new Float64Array((width + 1) * (height + 1));
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const value = luminance(src[i], src[i + 1], src[i + 2]);
      lum[p] = value;
      rowSum += value;
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];

      const p = y * width + x;
      const i = p * 4;
      const localPaper = sum / area;
      const contrast = localPaper - lum[p];
      const ink = clamp01((contrast - sensitivity) / softness);
      const alpha = clampByte(255 * Math.pow(ink, 0.8) * (src[i + 3] / 255));

      if (alpha <= 2) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      } else {
        const darkness = clamp01((contrast + 20) / 120);
        const channel = clampByte(42 * (1 - darkness));
        out[i] = channel;
        out[i + 1] = channel;
        out[i + 2] = channel;
        out[i + 3] = alpha;
      }
    }
  }

  return new ImageData(out, width, height);
}

/**
 * Trim transparent edges from ImageData, keeping a small padding.
 *
 * @param {ImageData} imageData
 * @param {number} [padding=8]
 * @returns {ImageData}
 */
export function trimTransparentPixels(imageData, padding = 8) {
  if (!imageData || !imageData.data) {
    throw new Error('imageData is required');
  }

  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return new ImageData(new Uint8ClampedArray(4), 1, 1);
  }

  const x0 = Math.max(0, minX - padding);
  const y0 = Math.max(0, minY - padding);
  const x1 = Math.min(width - 1, maxX + padding);
  const y1 = Math.min(height - 1, maxY + padding);
  const outWidth = x1 - x0 + 1;
  const outHeight = y1 - y0 + 1;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const srcIdx = ((y0 + y) * width + (x0 + x)) * 4;
      const dstIdx = (y * outWidth + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return new ImageData(out, outWidth, outHeight);
}

/**
 * Apply a color tint to non-transparent signature pixels.
 *
 * Processed signatures encode stroke intensity primarily in alpha. Scaling
 * the requested color by pixel luminance makes black ink stay black, so blue
 * or gray appears not to work. Instead, keep the alpha shape and replace the
 * visible RGB channels with the requested ink color.
 *
 * Creates a NEW ImageData — the original is never mutated.
 *
 * @param {ImageData} imageData
 * @param {{ r: number, g: number, b: number }} color Target tint color (0-255 per channel)
 * @returns {ImageData} New ImageData with color tint applied
 */
export function applyColorTint(imageData, color) {
  if (!imageData || !imageData.data) {
    throw new Error('imageData is required');
  }
  if (!color || typeof color !== 'object') {
    throw new Error('color must be an object with r, g, b');
  }

  for (const channel of ['r', 'g', 'b']) {
    const val = color[channel];
    if (typeof val !== 'number' || Number.isNaN(val) || val < 0 || val > 255) {
      throw new Error(`color.${channel} must be a number between 0 and 255`);
    }
  }

  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];

    if (a === 0) {
      // Fully transparent — leave as-is
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    } else {
      out[i] = Math.round(color.r);
      out[i + 1] = Math.round(color.g);
      out[i + 2] = Math.round(color.b);
      out[i + 3] = a;
    }
  }

  return new ImageData(out, imageData.width, imageData.height);
}

/**
 * Convert ImageData to a base64 PNG data URL.
 * @param {ImageData} imageData
 * @returns {string} Base64 data URL (e.g. "data:image/png;base64,...")
 */
export function imageDataToBase64(imageData) {
  if (!imageData || !imageData.data) {
    throw new Error('imageData is required');
  }

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Convert a base64 data URL to ImageData.
 * @param {string} base64 Base64 data URL string
 * @param {number} width Expected image width
 * @param {number} height Expected image height
 * @returns {Promise<ImageData>}
 */
export function base64ToImageData(base64, width, height) {
  return new Promise((resolve, reject) => {
    if (!base64 || typeof base64 !== 'string') {
      reject(new Error('base64 must be a string'));
      return;
    }
    if (!width || !height) {
      reject(new Error('width and height are required'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(ctx.getImageData(0, 0, width, height));
    };
    img.onerror = () => reject(new Error('Failed to load image from base64'));
    img.src = base64;
  });
}

/**
 * Full signature processing pipeline:
 * capture frame → crop → remove background.
 *
 * @param {HTMLVideoElement} videoElement
 * @param {{ x: number, y: number, width: number, height: number }} cropRect
 * @param {number} [threshold=200]
 * @returns {{ canvas: HTMLCanvasElement, imageData: ImageData }}
 */
export function processSignature(videoElement, cropRect, threshold = 200) {
  const frameCanvas = captureFrame(videoElement);
  const croppedCanvas = cropImage(frameCanvas, cropRect);

  const ctx = croppedCanvas.getContext('2d');
  const rawImageData = ctx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);

  const processedImageData = removeBackground(rawImageData, threshold);

  // Put processed data back onto the canvas
  ctx.putImageData(processedImageData, 0, 0);

  return {
    canvas: croppedCanvas,
    imageData: processedImageData,
  };
}
