/**
 * Vitest global setup — polyfills browser APIs not provided by jsdom.
 */

// ImageData polyfill (jsdom doesn't include it)
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    /** @type {Uint8ClampedArray} */
    data;
    /** @type {number} */
    width;
    /** @type {number} */
    height;

    constructor(data, width, height) {
      if (arguments.length === 3) {
        if (!(data instanceof Uint8ClampedArray)) {
          throw new TypeError('First argument must be a Uint8ClampedArray when called with 3 arguments');
        }
        if (data.length !== width * height * 4) {
          throw new Error('Data length does not match width and height');
        }
        this.data = data;
        this.width = width;
        this.height = height;
      } else if (arguments.length === 2 && typeof data === 'number' && typeof width === 'number') {
        // new ImageData(width, height)
        this.width = data;
        this.height = width;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else if (typeof data === 'object' && data !== null && data.data && data.width && data.height) {
        // new ImageData(otherImageData) — copy constructor
        this.width = data.width;
        this.height = data.height;
        this.data = new Uint8ClampedArray(data.data);
      } else {
        throw new TypeError('Invalid arguments for ImageData constructor');
      }
    }
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function () {
    return {
      addEventListener: () => {},
      cancel: () => {},
      finished: Promise.resolve(),
      play: () => {},
    };
  };
}
