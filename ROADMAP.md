# Roadmap

This is a practical backlog for making Signaturizer feel closer to macOS Preview while staying small and local-first.

## Short Term

- Add drag and drop PDF opening.
- Add visible selection state for the active signature in the dropdown.
- Add a `Fit Width` button to the main toolbar.
- Add keyboard nudging for placed signatures with arrow keys.
- Add a delete button in the selected signature overlay.
- Add a warning before closing with unsaved placed signatures.
- Add "Save As" default filename like `original_signed.pdf`.

## Signature Capture

- Add auto-crop suggestions based on detected ink bounds.
- Add rotate/straighten controls for photographed signatures.
- Add brightness/contrast controls next to `Sensitivity`.
- Add a side-by-side before/after preview.
- Add camera exposure/focus controls when the browser device API supports them.

## Document Workflow

- Add reusable stamp presets for initials, date, and signature.
- Add multi-page thumbnail navigation.
- Add "apply to all pages" and "copy placement to another page".
- Add recent documents.
- Add optional autosave of in-progress placements.

## API And Automation

- Add an endpoint to list placed signatures.
- Add an endpoint to place a saved signature by coordinates.
- Add an endpoint to save/export without UI interaction.
- Add an optional API token if binding beyond localhost is ever supported.

## Packaging

- Add an app icon.
- Add Linux `.deb` release artifacts.
- Add macOS and Windows build validation.
- Add GitHub release workflow after packaging is stable.
