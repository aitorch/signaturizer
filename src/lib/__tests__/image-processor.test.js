import { describe, it, expect } from 'vitest';
import {
  luminance,
  removeBackground,
  applyColorTint,
} from '../image-processor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an ImageData of the given size filled with a single RGBA color.
 */
function solidImageData(width, height, r, g, b, a = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return new ImageData(data, width, height);
}

/**
 * Create a 2×2 ImageData where each pixel can have a different color.
 * Pixels are in row-major order: TL, TR, BL, BR.
 */
function fourPixelImageData(tl, tr, bl, br) {
  const data = new Uint8ClampedArray(16);
  const pixels = [tl, tr, bl, br];
  for (let p = 0; p < 4; p++) {
    data[p * 4] = pixels[p][0];
    data[p * 4 + 1] = pixels[p][1];
    data[p * 4 + 2] = pixels[p][2];
    data[p * 4 + 3] = pixels[p][3];
  }
  return new ImageData(data, 2, 2);
}

// ---------------------------------------------------------------------------
// luminance helper
// ---------------------------------------------------------------------------

describe('luminance', () => {
  it('computes grayscale luminance using BT.601 weights', () => {
    // Pure white
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 1);
    // Pure black
    expect(luminance(0, 0, 0)).toBeCloseTo(0, 1);
    // Pure green channel (dominant weight)
    expect(luminance(0, 255, 0)).toBeCloseTo(255 * 0.587, 2);
    // Pure red channel
    expect(luminance(255, 0, 0)).toBeCloseTo(255 * 0.299, 2);
    // Pure blue channel
    expect(luminance(0, 0, 255)).toBeCloseTo(255 * 0.114, 2);
  });

  it('is commutative with respect to the formula', () => {
    const r = 100, g = 150, b = 200;
    const expected = r * 0.299 + g * 0.587 + b * 0.114;
    expect(luminance(r, g, b)).toBeCloseTo(expected, 4);
  });
});

// ---------------------------------------------------------------------------
// removeBackground
// ---------------------------------------------------------------------------

describe('removeBackground', () => {
  it('makes all-white pixels transparent', () => {
    const img = solidImageData(3, 3, 255, 255, 255);
    const result = removeBackground(img);

    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0); // alpha should be 0
    }
  });

  it('keeps all-black pixels visible (not transparent)', () => {
    const img = solidImageData(3, 3, 0, 0, 0);
    const result = removeBackground(img);

    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(255); // alpha preserved
    }
  });

  it('darkens foreground pixels slightly for contrast', () => {
    const img = solidImageData(2, 2, 100, 80, 60);
    const result = removeBackground(img);

    for (let i = 0; i < result.data.length; i += 4) {
      // Should be darkened by 0.9 factor
      expect(result.data[i]).toBe(Math.round(100 * 0.9));
      expect(result.data[i + 1]).toBe(Math.round(80 * 0.9));
      expect(result.data[i + 2]).toBe(Math.round(60 * 0.9));
    }
  });

  it('removes only background pixels in a mixed image', () => {
    // 2×2: top-left = white (bg), top-right = black (signature),
    //       bottom-left = black (signature), bottom-right = white (bg)
    const img = fourPixelImageData(
      [255, 255, 255, 255], // TL - white
      [0, 0, 0, 255],       // TR - black
      [0, 0, 0, 255],       // BL - black
      [255, 255, 255, 255], // BR - white
    );
    const result = removeBackground(img, 200);

    // TL (white) → transparent
    expect(result.data[3]).toBe(0);
    // TR (black) → kept
    expect(result.data[7]).toBe(255);
    // BL (black) → kept
    expect(result.data[11]).toBe(255);
    // BR (white) → transparent
    expect(result.data[15]).toBe(0);
  });

  it('uses default threshold of 200', () => {
    // Pixel with luminance > 200 should be transparent
    // Use near-white: lum(220,220,220) ≈ 220 > 200
    const img = solidImageData(1, 1, 220, 220, 220);

    const lum = luminance(220, 220, 220);
    expect(lum).toBeGreaterThan(200);

    const result = removeBackground(img);
    expect(result.data[3]).toBe(0); // should be transparent
  });

  it('respects custom threshold value', () => {
    // With threshold 50, even medium-gray becomes background
    const img = solidImageData(1, 1, 100, 100, 100); // lum ≈ 100
    const result = removeBackground(img, 50);

    expect(result.data[3]).toBe(0); // transparent because lum(100) > 50
  });

  it('handles threshold = 0 (pure black stays, anything brighter is removed)', () => {
    // At threshold 0, the condition is lum > 0. Pure black (lum=0) is NOT
    // strictly greater than 0, so it stays as foreground.
    const blackImg = solidImageData(1, 1, 0, 0, 0);
    const blackResult = removeBackground(blackImg, 0);
    expect(blackResult.data[3]).toBe(255); // black stays — 0 > 0 is false

    // A pixel with any brightness (lum > 0) is removed.
    const dimImg = solidImageData(1, 1, 1, 0, 0); // lum ≈ 0.299
    const dimResult = removeBackground(dimImg, 0);
    expect(dimResult.data[3]).toBe(0); // dim pixel removed — lum > 0
  });

  it('handles threshold = 255 (only pure white at boundary)', () => {
    // Pure white lum = 255. Condition is lum > threshold. At threshold 255, 255 > 255 is false.
    // So even pure white is NOT removed at threshold 255 (it stays as foreground).
    const whiteImg = solidImageData(1, 1, 255, 255, 255);
    const whiteResult = removeBackground(whiteImg, 255);
    expect(whiteResult.data[3]).toBe(255); // kept — lum is NOT strictly > 255
  });

  it('does NOT mutate the original imageData', () => {
    const img = solidImageData(2, 2, 128, 128, 128);
    const originalData = new Uint8ClampedArray(img.data);

    removeBackground(img, 100);

    // Original should be unchanged
    expect(img.data).toEqual(originalData);
  });

  it('throws if imageData is null', () => {
    expect(() => removeBackground(null)).toThrow('imageData is required');
  });

  it('throws if imageData is missing data', () => {
    expect(() => removeBackground({})).toThrow('imageData is required');
  });

  it('throws if threshold is not a number', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => removeBackground(img, 'high')).toThrow('threshold must be a number between 0 and 255');
  });

  it('throws if threshold is negative', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => removeBackground(img, -1)).toThrow('threshold must be a number between 0 and 255');
  });

  it('throws if threshold is above 255', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => removeBackground(img, 256)).toThrow('threshold must be a number between 0 and 255');
  });

  it('throws if threshold is NaN', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => removeBackground(img, NaN)).toThrow('threshold must be a number between 0 and 255');
  });

  it('handles a 1×1 image', () => {
    const img = solidImageData(1, 1, 128, 128, 128);
    const result = removeBackground(img, 200);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data.length).toBe(4);
  });

  it('correctly preserves alpha of foreground pixels', () => {
    // Semi-transparent foreground pixel
    const data = new Uint8ClampedArray([50, 50, 50, 128]);
    const img = new ImageData(data, 1, 1);
    const result = removeBackground(img, 200);

    expect(result.data[3]).toBe(128); // alpha preserved
  });

  it('removes background pixels while preserving existing alpha', () => {
    // Bright pixel (background) with partial alpha — should become transparent
    const data = new Uint8ClampedArray([240, 240, 240, 128]);
    const img = new ImageData(data, 1, 1);
    const result = removeBackground(img, 200);

    expect(result.data[3]).toBe(0); // background pixel becomes fully transparent
  });
});

// ---------------------------------------------------------------------------
// applyColorTint
// ---------------------------------------------------------------------------

describe('applyColorTint', () => {
  it('tints a white pixel to the target color', () => {
    // White pixel (lum = 255) tinted to red {255, 0, 0}
    const img = solidImageData(1, 1, 255, 255, 255);
    const result = applyColorTint(img, { r: 255, g: 0, b: 0 });

    expect(result.data[0]).toBe(255); // R = 255 * (255/255) = 255
    expect(result.data[1]).toBe(0);   // G = 0
    expect(result.data[2]).toBe(0);   // B = 0
  });

  it('tints to pure blue', () => {
    const img = solidImageData(1, 1, 255, 255, 255);
    const result = applyColorTint(img, { r: 0, g: 0, b: 255 });

    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(255);
  });

  it('tints to black (all channels zero)', () => {
    const img = solidImageData(1, 1, 255, 255, 255);
    const result = applyColorTint(img, { r: 0, g: 0, b: 0 });

    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it('preserves original alpha for non-transparent pixels', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 128]);
    const img = new ImageData(data, 1, 1);
    const result = applyColorTint(img, { r: 255, g: 0, b: 0 });

    expect(result.data[3]).toBe(128); // alpha preserved
  });

  it('tints partially transparent pixels correctly', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 128]);
    const img = new ImageData(data, 1, 1);
    const result = applyColorTint(img, { r: 0, g: 255, b: 0 });

    const lum = luminance(200, 200, 200);
    expect(result.data[0]).toBe(Math.round(0 * (lum / 255)));
    expect(result.data[1]).toBe(Math.round(255 * (lum / 255)));
    expect(result.data[2]).toBe(Math.round(0 * (lum / 255)));
    expect(result.data[3]).toBe(128); // alpha preserved
  });

  it('keeps fully transparent pixels transparent', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 0]);
    const img = new ImageData(data, 1, 1);
    const result = applyColorTint(img, { r: 255, g: 0, b: 0 });

    expect(result.data[3]).toBe(0);   // still transparent
    expect(result.data[0]).toBe(100); // R unchanged
    expect(result.data[1]).toBe(100); // G unchanged
    expect(result.data[2]).toBe(100); // B unchanged
  });

  it('tints based on luminance of original pixel', () => {
    // Gray pixel with lum ≈ 128
    const r = 100, g = 100, b = 100;
    const lum = luminance(r, g, b);
    const img = solidImageData(1, 1, r, g, b);
    const result = applyColorTint(img, { r: 255, g: 128, b: 0 });

    expect(result.data[0]).toBe(Math.round(255 * (lum / 255)));
    expect(result.data[1]).toBe(Math.round(128 * (lum / 255)));
    expect(result.data[2]).toBe(Math.round(0 * (lum / 255)));
  });

  it('tints a mixed 2×2 image correctly', () => {
    const img = fourPixelImageData(
      [255, 255, 255, 255], // TL - white
      [128, 128, 128, 255], // TR - gray
      [0, 0, 0, 255],       // BL - black
      [255, 255, 255, 0],   // BR - white but transparent
    );
    const result = applyColorTint(img, { r: 0, g: 255, b: 0 });

    // TL: lum=255 → G = 255 * (255/255) = 255
    expect(result.data[1]).toBe(255);

    // TR: lum of gray ≈ 128
    const grayLum = luminance(128, 128, 128);
    expect(result.data[5]).toBe(Math.round(255 * (grayLum / 255)));

    // BL: lum=0 → G = 255 * 0 = 0
    expect(result.data[9]).toBe(0);

    // BR: transparent → stays unchanged (pixel 3: indices 12-15)
    expect(result.data[12]).toBe(255); // R unchanged
    expect(result.data[13]).toBe(255); // G unchanged
    expect(result.data[14]).toBe(255); // B unchanged
    expect(result.data[15]).toBe(0);   // alpha unchanged
  });

  it('does NOT mutate the original imageData', () => {
    const img = solidImageData(2, 2, 128, 128, 128);
    const originalData = new Uint8ClampedArray(img.data);

    applyColorTint(img, { r: 255, g: 0, b: 0 });

    expect(img.data).toEqual(originalData);
  });

  it('throws if imageData is null', () => {
    expect(() => applyColorTint(null, { r: 255, g: 0, b: 0 })).toThrow('imageData is required');
  });

  it('throws if color is missing', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => applyColorTint(img, null)).toThrow('color must be an object');
  });

  it('throws if color.r is not a number', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => applyColorTint(img, { r: 'red', g: 0, b: 0 })).toThrow('color.r must be a number between 0 and 255');
  });

  it('throws if color.g is negative', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => applyColorTint(img, { r: 0, g: -1, b: 0 })).toThrow('color.g must be a number between 0 and 255');
  });

  it('throws if color.b is above 255', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => applyColorTint(img, { r: 0, g: 0, b: 256 })).toThrow('color.b must be a number between 0 and 255');
  });

  it('throws if color channel is NaN', () => {
    const img = solidImageData(1, 1, 0, 0, 0);
    expect(() => applyColorTint(img, { r: NaN, g: 0, b: 0 })).toThrow('color.r must be a number between 0 and 255');
  });

  it('handles a 1×1 image', () => {
    const data = new Uint8ClampedArray([50, 50, 50, 255]);
    const img = new ImageData(data, 1, 1);
    const result = applyColorTint(img, { r: 100, g: 200, b: 50 });

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data.length).toBe(4);
  });
});
