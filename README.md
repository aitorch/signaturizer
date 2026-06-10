# Signaturizer

A desktop application for capturing handwritten signatures via webcam and stamping them onto PDF documents. Inspired by macOS Preview's signature feature.

## Features

- **Webcam Capture**: Capture your signature using your laptop camera — hold a signed white paper in front of the camera
- **Background Removal**: Automatic background removal with adjustable threshold for clean, transparent signatures
- **Signature Library**: Save multiple signatures with automatic persistence across sessions
- **PDF Viewing**: Open and navigate PDF documents with page navigation and zoom controls
- **Signature Placement**: Click to place, drag to move, handles to resize signatures on your PDF
- **Color Tinting**: Change signature color — black, blue, dark gray, or custom color
- **PDF Export**: Export signed PDFs with embedded signatures — original files are never modified
- **Keyboard Shortcuts**: Ctrl+O (Open), Ctrl+S (Save), Ctrl+Z (Undo), Delete (Remove)

## Tech Stack

- **Electron** — Desktop runtime
- **Svelte 5** — UI framework
- **Tailwind CSS** — Styling
- **pdf.js** — PDF rendering
- **pdf-lib** — PDF manipulation
- **Canvas API** — Image processing

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
git clone <repo-url> signaturizer
cd signaturizer
npm install
```

### Development
```bash
# Start the app in development mode
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Building
```bash
# Build for Linux x64
npm run build
```

Output will be in the `out/` directory.

## Usage

1. **Open a PDF**: Click "Open PDF" in the toolbar or press Ctrl+O
2. **Create a signature**: Click "Sign" → "Create New Signature"
   - Hold a white paper with your signature in front of the camera
   - Position it level with the alignment guide
   - Click "Capture"
   - Adjust the crop area to select just your signature
   - Adjust the threshold slider to clean up the background
   - Click "Done"
3. **Place a signature**: Select a saved signature from the dropdown, then click on the PDF where you want it
4. **Adjust**: Drag to move, use corner handles to resize
5. **Change color**: Select a placed signature and pick a color from the color picker
6. **Export**: Click "Export" in the toolbar or press Ctrl+S to save the signed PDF

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── main.js             # Window management, IPC handlers
│   └── preload.js          # Context bridge for renderer
├── renderer/               # Svelte UI
│   ├── App.svelte          # Root component
│   ├── components/         # UI components
│   │   ├── CameraModal.svelte
│   │   ├── PdfViewer.svelte
│   │   ├── SignatureDropdown.svelte
│   │   ├── SignaturePlacement.svelte
│   │   └── Toolbar.svelte
│   └── __tests__/          # Component tests
└── lib/                    # Shared libraries
    ├── image-processor.js  # Background removal, color tinting
    ├── pdf-exporter.js     # PDF export with pdf-lib
    ├── pdf-viewer.js       # PDF rendering with pdf.js
    ├── signature-store.js  # Signature persistence
    └── __tests__/          # Library tests
```

## License

MIT
