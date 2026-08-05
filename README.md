# ✍️ Signaturizer

**Sign PDFs with your real handwritten signature. Locally, privately, and fast.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-⚡-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
![Linux](https://img.shields.io/badge/Platform-Linux-FCC624?logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/Platform-macOS_(experimental)-000000?logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Platform-Windows_(experimental)-0078D6?logo=windows&logoColor=white)

---

<!-- SCREENSHOTS -->

> _Add screenshots here: main window with PDF open, camera capture modal, signed PDF preview._

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Development Setup](#-development-setup)
- [Testing](#-testing)
- [Building](#-building)
- [Usage Guide](#-usage-guide)
- [Local HTTP API](#-local-http-api)
- [OCR Support](#-ocr-support)
- [Privacy & Security](#-privacy--security)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

---

## ✨ Features

### Core

- 📄 **Open & render PDFs locally** — Powered by [pdf.js](https://mozilla.github.io/pdf.js/), all rendering happens on your machine.
- 📸 **Webcam signature capture** — Hold up a piece of paper with your signature and capture it instantly.
- 🧼 **Adaptive paper cleanup** — Local-contrast processing (not a dumb global threshold) removes shadows, uneven lighting, and paper texture while preserving ink strokes.
- ✂️ **Automatic transparent margin cropping** — Detected ink bounds are used to trim excess whitespace, producing tight transparent PNG stamps.
- 🗂️ **Local signature library** — Save multiple signatures (e.g., personal, professional, initials). Persisted across sessions in Electron's `userData` directory.
- 🖱️ **Visual placement** — Click to drop a signature anywhere on the page. Drag to move. Corner handle to resize. Delete button to remove. Full undo support.
- 🎨 **Color tinting** — Black, blue, gray, or pick a custom color. Tint is applied to the captured ink while preserving transparency.
- 💾 **Export signed PDFs** — Embedded as high-resolution PNG stamps via [pdf-lib](https://pdf-lib.js.org/). The original PDF is never modified; a new copy is written.

### Advanced

- 🤖 **Local HTTP API** — Full REST API on `127.0.0.1:17398` for automation, scripting, and agent-driven workflows.
- 🔍 **OCR via Tesseract** — Extract text from scanned PDFs for programmatic document analysis. All processing is local.
- ⌨️ **Keyboard shortcuts** — Quick-open, save, and undo without touching the mouse.
- 🔒 **No cryptographic signatures** — Signaturizer creates **visual** stamps (an image of your signature on the page). It is not a cryptographic / digital-signature tool.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **npm** (or your preferred package manager)

### Install dependencies

```bash
git clone https://github.com/your-org/signaturizer.git
cd signaturizer
npm install
```

### System dependencies (OCR, optional)

OCR support requires **Tesseract** and **Poppler** on your system. The app works without them — you just won't be able to extract text from scanned PDFs.

| Platform       | Command                                                  |
|----------------|----------------------------------------------------------|
| Arch / Manjaro | `sudo pacman -S tesseract poppler`                      |
| Ubuntu / Debian| `sudo apt install tesseract-ocr poppler-utils`          |
| macOS          | `brew install tesseract poppler`                         |
| Fedora         | `sudo dnf install tesseract poppler-utils`              |

> If Tesseract language data isn't bundled, install the appropriate language pack (e.g., `tesseract-data-eng` on Arch, `tesseract-ocr-eng` on Debian).

### Run in development

```bash
npm run dev
```

This launches Electron with Vite hot-reload for the Svelte renderer.

---

## 🛠️ Development Setup

### Prerequisites

| Tool      | Version  | Notes                                    |
|-----------|----------|------------------------------------------|
| Node.js   | ≥ 20     | Use [mise](https://mise.jdx.dev/) or nvm |
| npm       | latest   | Bundled with Node                        |

### Clone & install

```bash
git clone https://github.com/your-org/signaturizer.git
cd signaturizer
npm install
```

### Start the dev server

```bash
npm run dev
```

Vite serves the renderer with hot-module replacement. Electron's main process restarts automatically on changes to `src/main/`.

### Wayland notes (Linux)

On **Wayland** compositors (GNOME, Hyprland, Sway, KDE Plasma 6), Electron may need hints to use the correct display backend. If you experience blank windows, camera issues, or permission prompts:

```bash
# Force Wayland (Electron ≥ 28 supports --ozone-platform-hint=auto)
npm run dev -- --ozone-platform-hint=auto

# Or explicitly:
npm run dev -- --ozone-platform=wayland

# If the camera doesn't work under Wayland, PipeWire is required:
# Ensure your distro has xdg-desktop-portal and pipewire installed.
# Electron uses PipeWire for camera access under Wayland.
```

For **screen sharing / window capture** debugging under Wayland, ensure `xdg-desktop-portal` is running and the correct implementation (e.g., `xdg-desktop-portal-hyprland`, `xdg-desktop-portal-gnome`) is installed.

---

## 🧪 Testing

Tests are written with **[Vitest](https://vitest.dev/)** and cover image processing, PDF utilities, and API logic.

### Run all tests

```bash
npm test
```

### Run in watch mode

```bash
npm run test:watch
```

### Run with coverage

```bash
npm run test:coverage
```

---

## 📦 Building

### Build for your current platform

```bash
npm run build
```

This produces distributables in `dist/` or `release/` depending on configuration.

### Linux `.deb`

```bash
npm run build:linux
```

Produces a `.deb` installer (and optionally `.AppImage` / `.rpm` depending on config).

### Portable `.zip`

```bash
npm run build:zip
```

Produces an unpacked, portable directory you can zip and run anywhere without installation.

> **macOS / Windows:** Cross-compilation from Linux is generally not supported for native modules. Build on the target platform for best results.

### ⚠️ macOS & Windows — Experimental Builds

macOS and Windows builds are **experimental**. They are built via CI on the target platforms but are **not code-signed**.

**macOS:**
- Gatekeeper will show "Signaturizer cannot be opened because it is from an unidentified developer."
- **Workaround:** Right-click the app → *Open* → confirm. Or run `xattr -cr /path/to/Signaturizer.app` in Terminal.
- The `.icns` icon is generated automatically during CI builds.

**Windows:**
- SmartScreen will show "Windows protected your PC."
- **Workaround:** Click *More info* → *Run anyway*.
- The `.ico` icon is included in the repository.

**OCR (both platforms):** Tesseract and Poppler are **not bundled**. To enable OCR:
- macOS: `brew install tesseract poppler`
- Windows: Download [Tesseract](https://github.com/UB-Mannheim/tesseract/wiki) and [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases), then add both to your `PATH`.

If you encounter issues, please [open an issue](../../issues) or submit a PR.

---

## 📖 Usage Guide

### Opening PDFs

1. Click the **Open** button in the toolbar, or press `Ctrl+O`.
2. Select a `.pdf` file from the file dialog.
3. The PDF renders in the main viewer. Use the page navigation controls to move between pages.

You can also open a PDF via the [HTTP API](#-local-http-api):

```bash
curl -X POST http://127.0.0.1:17398/open \
  -H "Content-Type: application/json" \
  -d '{"path": "/absolute/path/to/document.pdf"}'
```

### Capturing Signatures

The signature capture flow is inspired by macOS Preview:

1. Click the **Camera** button in the toolbar (or the **+** next to the signature dropdown).
2. A modal opens showing your webcam feed.
3. **Hold up a piece of white paper** with your signature written on it.
4. Adjust the **Sensitivity** slider:
   - **Lower** = stricter ink detection (fewer artifacts, may miss faint strokes).
   - **Higher** = more permissive (captures faint strokes but may pick up shadows).
5. A live preview shows the cleaned-up signature with a transparent background.
6. Click **Capture** to save the preview.
7. Use the **Crop adjustment** handles to fine-tune the bounding box if needed.
8. Click **Save** to add the signature to your library.

**How the cleanup works:** Instead of a single global brightness threshold (which fails on uneven lighting), Signaturizer computes local contrast in a sliding window. Pixels significantly darker than their local neighborhood are classified as ink. This handles shadows, gradient lighting, and paper texture far better than a simple threshold.

### Managing the Signature Library

| Action              | How                                                        |
|---------------------|------------------------------------------------------------|
| **Create**          | Capture a new signature via the camera modal.             |
| **Select**          | Click the signature dropdown in the toolbar and pick one. |
| **Delete**          | In the dropdown, hover a signature and click the **🗑** icon. |
| **Rename**          | In the dropdown, hover and click the **✏️** icon, then type a new name. |
| **Persist**         | Automatic. Signatures are saved to Electron's `userData` directory and restored on next launch. |

### Placing Signatures

1. **Select a signature** from the dropdown.
2. **Click anywhere on the PDF page** to place it.
3. **Move:** Click and drag the placed signature.
4. **Resize:** Drag the corner handle.
5. **Delete:** Click the **🗑** button on the placement (or select it and press `Delete`).
6. **Undo:** Press `Ctrl+Z` to undo the last action (place, move, resize, or delete).

Multiple signatures can be placed on the same page or across different pages. Each placement remembers its page index, position, size, tint color, and the source signature.

### Color Tinting

When a signature is selected (or after placement), choose a tint color:

- **Black** — Default, classic ink.
- **Blue** — Common for legal documents.
- **Gray** — Subtle, watermark-style.
- **Custom** — Open a color picker for any RGB value.

Tinting is applied to the non-transparent pixels of the signature PNG. The original capture is preserved; tint is a non-destructive overlay.

### Saving / Exporting

1. Click **Save** in the toolbar (or press `Ctrl+S`).
2. Choose a destination file path.
3. Signaturizer embeds all placed signatures as PNG stamps into the PDF using pdf-lib.
4. The **original PDF is never modified** — a new copy is written.

Export can also be triggered via the API:

```bash
curl -X POST http://127.0.0.1:17398/export \
  -H "Content-Type: application/json" \
  -d '{"outputPath": "/tmp/signed-document.pdf"}'
```

### Keyboard Shortcuts

| Shortcut     | Action                          |
|--------------|---------------------------------|
| `Ctrl+O`     | Open a PDF file                 |
| `Ctrl+S`     | Save / Export the signed PDF    |
| `Ctrl+Z`     | Undo last action                |
| `Escape`     | Close modals / deselect         |
| `Delete`     | Delete selected placement       |

> On macOS, `Ctrl` = `Cmd (⌘)`.

---

## 🔌 Local HTTP API

Signaturizer runs a local HTTP server on `http://127.0.0.1:17398`. It binds to **localhost only** — no external access.

All endpoints accept and return JSON unless otherwise noted.

### Coordinate System

- **Units:** PDF points (1 pt = 1/72 inch).
- **Origin:** Bottom-left corner of the page.
- **X** increases to the right; **Y** increases upward.
- All coordinates refer to the PDF coordinate space, not screen pixels.

---

### `GET /health`

Check whether the app is running and responsive.

```bash
curl http://127.0.0.1:17398/health
```

**Response (200):**

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

### `POST /open`

Open a PDF file in the viewer.

**Request body:**

```json
{
  "path": "/absolute/path/to/document.pdf"
}
```

```bash
curl -X POST http://127.0.0.1:17398/open \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/user/contracts/lease.pdf"}'
```

**Response (200):**

```json
{
  "ok": true,
  "document": {
    "path": "/home/user/contracts/lease.pdf",
    "pages": 12,
    "title": "Residential Lease Agreement"
  }
}
```

**Response (400):**

```json
{
  "error": "File not found: /home/user/contracts/missing.pdf"
}
```

---

### `GET /read`

Read metadata, text content, and optionally OCR text from the currently open document.

**Query parameters:**

| Parameter       | Type    | Default | Description                                            |
|-----------------|---------|---------|--------------------------------------------------------|
| `includeText`   | boolean | `false` | Extract embedded text layer via pdf.js.               |
| `includeOcr`    | boolean | `false` | Run Tesseract OCR on each page (slower, requires deps). |

```bash
# Metadata only
curl http://127.0.0.1:17398/read

# Include embedded text
curl "http://127.0.0.1:17398/read?includeText=true"

# Full OCR pass on scanned PDF
curl "http://127.0.0.1:17398/read?includeOcr=true"

# Everything
curl "http://127.0.0.1:17398/read?includeText=true&includeOcr=true"
```

**Response (200):**

```json
{
  "document": {
    "path": "/home/user/contracts/lease.pdf",
    "pages": 3,
    "title": "Lease Agreement"
  },
  "text": {
    "1": "RESIDENTIAL LEASE AGREEMENT\nThis Lease Agreement is entered into...",
    "2": "Tenant agrees to pay rent in the amount of...",
    "3": "IN WITNESS WHEREOF, the parties have executed..."
  },
  "ocr": {
    "1": "RESIDENTIAL LEASE AGREEMENT\nThis Lease Agreement is entered into...",
    "2": "[OCR may differ from embedded text for scanned docs]",
    "3": ""
  },
  "dimensions": {
    "1": { "width": 595.28, "height": 841.89 },
    "2": { "width": 595.28, "height": 841.89 },
    "3": { "width": 595.28, "height": 841.89 }
  }
}
```

> `text` is omitted when `includeText` is false. `ocr` is omitted when `includeOcr` is false. OCR results may take several seconds per page depending on resolution and language.

---

### `GET /document`

Get metadata for the currently open document (lighter than `/read`).

```bash
curl http://127.0.0.1:17398/document
```

**Response (200):**

```json
{
  "path": "/home/user/contracts/lease.pdf",
  "pages": 3,
  "title": "Lease Agreement",
  "dimensions": {
    "1": { "width": 595.28, "height": 841.89 }
  }
}
```

**Response (404) when no document is open:**

```json
{
  "error": "No document open"
}
```

---

### `GET /signatures`

List all signatures in the library.

```bash
curl http://127.0.0.1:17398/signatures
```

**Response (200):**

```json
{
  "signatures": [
    {
      "ref": "sig_a1b2c3",
      "name": "Personal",
      "createdAt": "2025-03-15T10:30:00Z",
      "width": 400,
      "height": 150
    },
    {
      "ref": "sig_d4e5f6",
      "name": "Initials",
      "createdAt": "2025-03-20T14:00:00Z",
      "width": 200,
      "height": 120
    }
  ]
}
```

---

### `GET /signatures/:ref`

Get details (and PNG data) for a specific signature.

```bash
curl http://127.0.0.1:17398/signatures/sig_a1b2c3
```

**Response (200):**

```json
{
  "ref": "sig_a1b2c3",
  "name": "Personal",
  "createdAt": "2025-03-15T10:30:00Z",
  "width": 400,
  "height": 150,
  "png": "base64-encoded-png-data..."
}
```

---

### `POST /signatures/:ref/rename`

Rename a signature in the library.

**Request body:**

```json
{
  "name": "New Name"
}
```

```bash
curl -X POST http://127.0.0.1:17398/signatures/sig_a1b2c3/rename \
  -H "Content-Type: application/json" \
  -d '{"name": "Formal Signature"}'
```

**Response (200):**

```json
{
  "ok": true,
  "signature": {
    "ref": "sig_a1b2c3",
    "name": "Formal Signature"
  }
}
```

---

### `GET /placements`

List all current signature placements on the open document.

```bash
curl http://127.0.0.1:17398/placements
```

**Response (200):**

```json
{
  "placements": [
    {
      "id": "plc_001",
      "signatureRef": "sig_a1b2c3",
      "page": 3,
      "x": 120,
      "y": 80,
      "width": 200,
      "height": 75,
      "color": { "r": 0, "g": 0, "b": 0 }
    }
  ]
}
```

---

### `POST /placements`

Add a new placement programmatically.

**Request body:**

```json
{
  "signatureRef": "sig_a1b2c3",
  "page": 3,
  "x": 120,
  "y": 80,
  "width": 200,
  "height": 75,
  "color": { "r": 0, "g": 51, "b": 102 }
}
```

```bash
curl -X POST http://127.0.0.1:17398/placements \
  -H "Content-Type: application/json" \
  -d '{
    "signatureRef": "sig_a1b2c3",
    "page": 3,
    "x": 120,
    "y": 80,
    "width": 200,
    "height": 75
  }'
```

**Response (201):**

```json
{
  "ok": true,
  "placement": {
    "id": "plc_002",
    "signatureRef": "sig_a1b2c3",
    "page": 3,
    "x": 120,
    "y": 80,
    "width": 200,
    "height": 75,
    "color": null
  }
}
```

---

### `POST /export`

Export the current document with all placements embedded.

**Request body:**

```json
{
  "outputPath": "/tmp/signed-document.pdf"
}
```

```bash
curl -X POST http://127.0.0.1:17398/export \
  -H "Content-Type: application/json" \
  -d '{"outputPath": "/home/user/Desktop/signed-lease.pdf"}'
```

**Response (200):**

```json
{
  "ok": true,
  "outputPath": "/home/user/Desktop/signed-lease.pdf",
  "placements": 2
}
```

---

### `POST /sign`

**Headless signing** — open a PDF, place signatures, and export in a single request. Ideal for automation and agent workflows.

**Request body:**

```json
{
  "inputPath": "/abs/path/input.pdf",
  "outputPath": "/abs/path/output.pdf",
  "placements": [
    {
      "signatureRef": "sig_a1b2c3",
      "page": 3,
      "x": 120,
      "y": 80,
      "width": 200,
      "height": 75,
      "color": { "r": 0, "g": 0, "b": 0 }
    }
  ]
}
```

```bash
curl -X POST http://127.0.0.1:17398/sign \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/home/user/contracts/lease.pdf",
    "outputPath": "/home/user/contracts/lease-signed.pdf",
    "placements": [
      {
        "signatureRef": "sig_a1b2c3",
        "page": 3,
        "x": 350,
        "y": 110,
        "width": 180,
        "height": 70
      },
      {
        "signatureRef": "sig_d4e5f6",
        "page": 3,
        "x": 350,
        "y": 60,
        "width": 80,
        "height": 50,
        "color": { "r": 0, "g": 51, "b": 102 }
      }
    ]
  }'
```

**Response (200):**

```json
{
  "ok": true,
  "outputPath": "/home/user/contracts/lease-signed.pdf",
  "inputPath": "/home/user/contracts/lease.pdf",
  "placementsApplied": 2
}
```

**Response (400) — validation error:**

```json
{
  "error": "Unknown signatureRef: sig_nonexistent"
}
```

---

## 🔍 OCR Support

Signaturizer integrates **[Tesseract OCR](https://github.com/tesseract-ocr/tesseract)** for extracting text from scanned or image-based PDFs.

### How it works

1. Each PDF page is rendered to a high-resolution image canvas via **pdf.js**.
2. **Poppler** (`pdftoppm`) may be used as a fallback rasterizer for problematic PDFs.
3. The rendered image is passed to Tesseract's engine.
4. Recognized text is returned per-page.

### Enabling OCR

- Install Tesseract and Poppler (see [Quick Start](#-quick-start)).
- Ensure Tesseract language data is available (English is default; additional languages can be installed).
- Use the `includeOcr=true` parameter on the `/read` endpoint.

### Limitations

- OCR is **always local** — no cloud APIs, no remote processing.
- Accuracy depends on scan quality, resolution, and font.
- OCR can be slow (1–5 seconds per page depending on hardware).
- Handwriting recognition is not supported (Tesseract is optimized for printed text).

---

## 🔒 Privacy & Security

### What stays on your machine

- **PDFs** — Opened, rendered, and exported locally. No file ever leaves your computer.
- **Signatures** — Captured via webcam, processed locally, stored in Electron's `userData` directory.
- **OCR** — Tesseract runs entirely on your CPU. No text is sent to any server.

### What Signaturizer does NOT do

- ❌ **No cloud uploads** — No telemetry, no analytics, no crash reports sent anywhere.
- ❌ **No remote processing** — Everything is local.
- ❌ **No network access required** — The HTTP API binds to `127.0.0.1` only.
- ❌ **No cryptographic digital signatures** — Signaturizer creates **visual stamps** (an image of your signature placed on the PDF). It does **not** create cryptographically verified digital signatures using certificates or keys. If you need legal cryptographic signing, use a tool like [OpenSSL](https://www.openssl.org/), [GnuPG](https://gnupg.org/), or a commercial PKI solution.

### Important note on visual signatures

A visual signature (an image of your handwritten signature on a document) provides **visual identification** but does **not** provide cryptographic proof of authenticity. Anyone with access to the image could copy it. For legally binding digital signatures, use a PKI-based solution.

---

## 🏗️ Project Structure

```
signaturizer/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App lifecycle, window management
│   │   ├── ipc.ts             # IPC handlers (renderer ↔ main)
│   │   └── api.ts             # Local HTTP API server (127.0.0.1:17398)
│   │
│   ├── renderer/              # Svelte 5 + Tailwind CSS UI
│   │   ├── App.svelte         # Root component
│   │   └── components/
│   │       ├── Toolbar.svelte            # Top toolbar (open, save, undo, colors)
│   │       ├── PdfViewer.svelte          # PDF rendering canvas + placement overlay
│   │       ├── CameraModal.svelte        # Webcam capture modal
│   │       ├── SignatureDropdown.svelte  # Library dropdown (select, rename, delete)
│   │       └── SignaturePlacement.svelte # Draggable/resizable placement widget
│   │
│   └── lib/                   # Shared business logic
│       ├── pdf-exporter.ts    # pdf-lib integration, stamp embedding
│       ├── image-processor.ts # Adaptive local-contrast cleanup, cropping
│       ├── pdf-viewer.ts      # pdf.js wrapper, page rendering
│       └── signature-store.ts # Signature persistence, library management
│
├── test/                      # Vitest test suites
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── electron-builder.yml
```

---

## 🤝 Contributing

Contributions are welcome! Please read the **[Contributing Guide](CONTRIBUTING.md)** for details on:

- Development setup
- Code style and conventions
- Pull request workflow
- Reporting bugs and requesting features

---

## 🗺️ Roadmap

See the **[Roadmap](ROADMAP.md)** for planned features, including:

- Multi-page batch signing
- Template presets for common document types
- Dark mode
- Additional languages for OCR
- Optional cryptographic signature support

---

## 📄 License

**[MIT License](LICENSE)** — Copyright © 2025 Signaturizer Contributors.

You are free to use, modify, distribute, and sublicense this software.

---

## 💛 Acknowledgements

- Inspired by the elegant **signature capture flow in macOS Preview** — the gold standard for simple, privacy-respecting document signing.
- Built with [Electron](https://www.electronjs.org/), [Svelte](https://svelte.dev/), [Tailwind CSS](https://tailwindcss.com/), [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/), and [Vitest](https://vitest.dev/).
- OCR powered by [Tesseract](https://github.com/tesseract-ocr/tesseract) and [Poppler](https://poppler.freedesktop.org/).
- Thanks to the open-source community for making tools like this possible. 🙏
