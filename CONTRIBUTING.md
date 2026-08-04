# Contributing

Thanks for improving Signaturizer.

## Development Setup

```bash
npm install
npm start
```

Run tests before opening a pull request:

```bash
npm test
```

## Pull Request Checklist

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Do not commit generated build output from `out/`, `.vite/`, or `dist/`.
- Do not commit local signature data or personal PDFs.
- Keep user-facing copy short and task-focused.

## Security And Privacy

Signaturizer handles PDFs and handwritten signatures. Treat sample documents and captures as private data. Use synthetic fixtures in tests and issues whenever possible.

The local HTTP API is for local automation only. Do not add network exposure without authentication and an explicit security review.

## Coding Notes

- Prefer existing Svelte component patterns.
- Keep IPC narrowly scoped to specific actions.
- Keep PDF and image processing helpers testable in `src/lib`.
- Preserve original PDFs by default; save signed copies through `Save As`.
