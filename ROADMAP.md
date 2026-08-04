# Roadmap

> Priorities informed by [competitive analysis](COMPETITIVE-ANALYSIS.md).

## P0 — Near Term

### Signature Capture
- **Touch/stylus drawing input** — draw signatures directly on touchscreen/stylus, not just webcam _(complexity: 3)_
- **Signature presets** — quick-select for initials, full signature, date stamp _(complexity: 2)_
- **Signature import** — import signature images (PNG/JPG) as an alternative to webcam capture _(complexity: 1)_

### Workflow
- **Batch signing** — sign multiple PDFs with the same placement in one operation _(complexity: 4)_
- **CLI tool** — standalone `signaturizer` CLI for headless signing without launching Electron _(complexity: 3)_

### UX Polish
- Add drag-and-drop PDF opening
- Add "Fit Width" button to toolbar
- Keyboard nudging for placed signatures (arrow keys)
- Delete button in selected signature overlay
- Warning before closing with unsaved placed signatures
- Default "Save As" filename like `original_signed.pdf`

## P1 — Mid Term

### Documents
- **Template documents** — remember where signatures go for recurring documents (invoices, contracts) _(complexity: 3)_
- **PDF form field detection** — auto-detect and highlight form fields for signature placement _(complexity: 4)_
- **Page manipulation** — reorder, delete, merge pages before signing _(complexity: 3)_
- **Custom stamps** — upload logo or seal as a reusable stamp _(complexity: 2)_

### Trust & Verification
- **QR code verification** — embed a QR in the signed PDF linking to signature metadata _(complexity: 3)_

### Capture Improvements
- Auto-crop suggestions based on detected ink bounds
- Rotate/straighten controls for photographed signatures
- Brightness/contrast controls next to Sensitivity
- Side-by-side before/after preview

### Document Workflow
- Reusable stamp presets for initials, date, and signature
- Multi-page thumbnail navigation
- "Apply to all pages" and "copy placement to another page"
- Recent documents list
- Optional autosave of in-progress placements

## P2 — Long Term

### Advanced Features
- **AI-assisted placement** — detect where signatures should go based on document type _(complexity: 5)_
- **RFC 3161 timestamping** — trusted timestamp authority for signed documents _(complexity: 3)_
- **Multi-signature workflow** — multiple signers with defined signing order _(complexity: 4)_
- **Encrypted PDF support** — open, sign, and save password-protected PDFs _(complexity: 3)_
- **Watermarking** — apply watermarks alongside signatures _(complexity: 2)_
- **Plugin/extension system** — allow third-party extensions _(complexity: 5)_
- **Mobile companion app** — capture signatures on phone, sync to desktop _(complexity: 5)_
- **eIDAS / QES compliance** — qualified electronic signatures for EU legal validity _(complexity: 5)_

### API & Automation
- Add endpoint to list placed signatures
- Add endpoint to place a saved signature by coordinates
- Add endpoint to save/export without UI interaction
- Add optional API token if binding beyond localhost is ever supported

### Packaging
- Add macOS and Windows build validation
- Add Linux `.AppImage` and `.Flatpak` releases
- Add GitHub release workflow with signed binaries
- Snap/Flatpak packaging

## Completed

- ✅ Webcam signature capture with adaptive local-contrast cleaning
- ✅ Crop transparent margins automatically
- ✅ Local signature library (persisted)
- ✅ Visual placement: move, resize, delete, undo
- ✅ Color tinting: black, blue, dark gray, custom
- ✅ Export signed PDF with embedded PNG stamps
- ✅ Local HTTP API (11 endpoints) for automation
- ✅ OCR support via Tesseract + Poppler
- ✅ Headless signing via `/sign` endpoint
- ✅ Keyboard shortcuts (Ctrl+O, Ctrl+S, Ctrl+Z, Escape)
- ✅ App icon
- ✅ Comprehensive README and documentation
- ✅ GitHub Pages landing page
- ✅ Automated releases (release-please)
