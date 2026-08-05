import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { exportSignedPdf } from '../lib/pdf-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// Linux-only: Wayland / ozone hints improve window management under Wayland compositors.
// On macOS and Windows these switches are ignored by Electron but `disable-gpu-sandbox`
// can cause GPU rendering issues on some Windows drivers, so we scope everything to Linux.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// ── Logging helper ────────────────────────────────────────────────────────────

function log(tag, msg, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${tag}] ${msg}`, ...args);
}

// ── HTTP API Server ───────────────────────────────────────────────────────────
// Allows agents/CLI to control Signaturizer programmatically.
// Endpoints:
//   GET  /health            → { status: "ok" }
//   POST /open              → { filePath } — opens a PDF in the window/API state
//   POST /read              → { filePath?, includeText?, includeOcr? } — inspect PDF coordinates
//   GET  /document          → inspect currently opened PDF
//   GET  /signatures        → list saved signature metadata
//   GET  /signatures/:ref   → get one signature by id or name, with imageData
//   POST /signatures/:ref/rename → { name } — rename a signature
//   POST /placements        → add an API placement to the current document
//   GET  /placements        → list API placements
//   DELETE /placements      → clear API placements
//   POST /export            → { outputPath, placements? } — headless export
//   POST /sign              → { inputPath?, outputPath, placements } — one-shot export
//
// Runs on localhost:17398 by default (SIGNATURIZER_API_PORT env var to override).

let apiServer = null;
let mainWindowRef = null;
let currentApiDocument = null;
let apiPlacements = [];

const coordinateSystem = {
  unit: 'pt',
  origin: 'bottom-left',
  x: 'right',
  y: 'up',
  placementAnchor: 'bottom-left',
};

function startApiServer() {
  const port = parseInt(process.env.SIGNATURIZER_API_PORT || '17398', 10);

  apiServer = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // CORS for localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    try {
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          window: !!mainWindowRef,
          document: currentApiDocument ? summarizeCurrentDocument(currentApiDocument) : null,
          placements: apiPlacements.length,
        }));
        return;
      }

      if (url.pathname === '/open' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.filePath || !fs.existsSync(body.filePath)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'filePath required and must exist' }));
          return;
        }

        currentApiDocument = await loadApiDocument(body.filePath, {
          includeText: body.includeText === true,
          includeOcr: body.includeOcr === true,
          ocr: body.ocr,
        });
        apiPlacements = [];

        log('API', `Opening ${currentApiDocument.fileName} (${currentApiDocument.size} bytes)`);

        // Send to renderer to load
        mainWindowRef?.webContents.send('api-open-pdf', {
          fileName: currentApiDocument.fileName,
          base64: currentApiDocument.base64,
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          document: publicDocument(currentApiDocument, {
            includeText: body.includeText === true,
            includeOcr: body.includeOcr === true,
          }),
        }));
        return;
      }

      if (url.pathname === '/read' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const filePath = body.filePath || currentApiDocument?.filePath;
        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'filePath required and must exist, or open a document first' }));
          return;
        }

        const document = await loadApiDocument(filePath, {
          includeText: body.includeText !== false,
          includeOcr: body.includeOcr === true,
          ocr: body.ocr,
        });
        if (!body.filePath) currentApiDocument = document;

        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          document: publicDocument(document, {
            includeText: body.includeText !== false,
            includeOcr: body.includeOcr === true,
          }),
        }));
        return;
      }

      if (url.pathname === '/document' && req.method === 'GET') {
        if (!currentApiDocument) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No PDF opened' }));
          return;
        }

        const includeText = url.searchParams.get('includeText') !== 'false';
        const includeOcr = url.searchParams.get('includeOcr') === 'true';
        if (includeText && !currentApiDocument.pages.every((page) => Array.isArray(page.text))) {
          currentApiDocument = await loadApiDocument(currentApiDocument.filePath, { includeText: true });
        }
        if (includeOcr && !currentApiDocument.pages.every((page) => Array.isArray(page.ocr))) {
          currentApiDocument = await loadApiDocument(currentApiDocument.filePath, {
            includeText,
            includeOcr: true,
          });
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          document: publicDocument(currentApiDocument, { includeText, includeOcr }),
        }));
        return;
      }

      if (url.pathname === '/export' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.outputPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'outputPath required' }));
          return;
        }

        if (Array.isArray(body.placements) || apiPlacements.length > 0) {
          if (!currentApiDocument && !body.inputPath) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No PDF opened. Call /open first or pass inputPath.' }));
            return;
          }

          const document = body.inputPath
            ? await loadApiDocument(body.inputPath, { includeText: false })
            : currentApiDocument;
          const placements = Array.isArray(body.placements) ? body.placements : apiPlacements;
          const result = await exportHeadless(document.bytes, placements);
          fs.writeFileSync(body.outputPath, Buffer.from(result));

          log('API', `Headless export to ${body.outputPath} (${result.byteLength} bytes)`);

          res.writeHead(200);
          res.end(JSON.stringify({
            ok: true,
            outputPath: body.outputPath,
            size: result.byteLength,
            placements: placements.length,
          }));
          return;
        }

        // Backward-compatible UI export: ask renderer to export current visual state.
        const result = await mainWindowRef?.webContents.executeJavaScript(
          `window.__signaturizerExport && window.__signaturizerExport()`
        );

        if (!result) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No PDF loaded or export failed' }));
          return;
        }

        // result is base64-encoded PDF
        const pdfBuffer = Buffer.from(result, 'base64');
        fs.writeFileSync(body.outputPath, pdfBuffer);

        log('API', `Saved to ${body.outputPath} (${pdfBuffer.byteLength} bytes)`);

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, outputPath: body.outputPath, size: pdfBuffer.byteLength }));
        return;
      }

      if (url.pathname === '/signatures' && req.method === 'GET') {
        const includeImage = url.searchParams.get('includeImage') === 'true';
        const sigs = getSignatures().map((signature) => publicSignature(signature, { includeImage }));
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, signatures: sigs }));
        return;
      }

      if (url.pathname.startsWith('/signatures/') && req.method === 'GET') {
        const ref = decodeURIComponent(url.pathname.slice('/signatures/'.length));
        const signature = resolveSignature({ id: ref, name: ref });
        if (!signature) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Signature not found: ${ref}` }));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, signature: publicSignature(signature, { includeImage: true }) }));
        return;
      }

      if (url.pathname.startsWith('/signatures/') && url.pathname.endsWith('/rename') && req.method === 'POST') {
        const ref = decodeURIComponent(
          url.pathname.slice('/signatures/'.length, -'/rename'.length),
        );
        const body = await readJsonBody(req);
        const nextName = String(body.name || '').trim();
        if (!nextName) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'name required' }));
          return;
        }

        const signature = resolveSignature({ id: ref, name: ref });
        if (!signature) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Signature not found: ${ref}` }));
          return;
        }

        const signatures = getSignatures();
        if (signatures.some((item) => item.id !== signature.id && item.name === nextName)) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: `Signature name already exists: ${nextName}` }));
          return;
        }

        const updated = signatures.map((item) => item.id === signature.id
          ? { ...item, name: nextName, updatedAt: new Date().toISOString() }
          : item);
        writeSignatures(updated);
        const renamed = updated.find((item) => item.id === signature.id);

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, signature: publicSignature(renamed, { includeImage: false }) }));
        return;
      }

      if (url.pathname === '/placements' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, placements: apiPlacements }));
        return;
      }

      if (url.pathname === '/placements' && req.method === 'DELETE') {
        apiPlacements = [];
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, placements: [] }));
        return;
      }

      if (url.pathname === '/placements' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const placement = normalizePlacement(body);
        apiPlacements.push(placement);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, placement, placements: apiPlacements }));
        return;
      }

      if (url.pathname === '/sign' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.outputPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'outputPath required' }));
          return;
        }
        if (!Array.isArray(body.placements) || body.placements.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'placements must be a non-empty array' }));
          return;
        }

        const inputPath = body.inputPath || currentApiDocument?.filePath;
        if (!inputPath || !fs.existsSync(inputPath)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'inputPath required and must exist, or open a document first' }));
          return;
        }

        const document = await loadApiDocument(inputPath, { includeText: false });
        const result = await exportHeadless(document.bytes, body.placements);
        fs.writeFileSync(body.outputPath, Buffer.from(result));

        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          inputPath,
          outputPath: body.outputPath,
          size: result.byteLength,
          placements: body.placements.length,
        }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
    } catch (err) {
      log('API', `Error: ${err.message}`);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  apiServer.listen(port, '127.0.0.1', () => {
    log('API', `HTTP API listening on http://127.0.0.1:${port}`);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getSignatures() {
  const sigsPath = path.join(app.getPath('userData'), 'signatures.json');
  if (!fs.existsSync(sigsPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(sigsPath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSignatures(signatures) {
  const sigsPath = path.join(app.getPath('userData'), 'signatures.json');
  fs.writeFileSync(sigsPath, JSON.stringify(signatures, null, 2), 'utf-8');
}

function publicSignature(signature, { includeImage = false } = {}) {
  const publicData = {
    id: signature.id,
    name: signature.name,
    createdAt: signature.createdAt,
    updatedAt: signature.updatedAt,
  };

  if (signature.imageData) {
    const meta = parseDataUrl(signature.imageData);
    publicData.mimeType = meta.mimeType || 'image/png';
    publicData.imageBytes = meta.bytes.length;
    if (includeImage) publicData.imageData = signature.imageData;
  }

  return publicData;
}

function resolveSignature({ id, name, signatureId, signatureName } = {}) {
  const wantedId = id || signatureId;
  const wantedName = name || signatureName;
  const signatures = getSignatures();

  if (wantedId) {
    const found = signatures.find((signature) => signature.id === wantedId);
    if (found) return found;
  }

  if (wantedName) {
    const exact = signatures.filter((signature) => signature.name === wantedName);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      throw new Error(`Signature name is ambiguous: ${wantedName}`);
    }

    const folded = String(wantedName).toLocaleLowerCase();
    const insensitive = signatures.filter((signature) => (
      String(signature.name).toLocaleLowerCase() === folded
    ));
    if (insensitive.length === 1) return insensitive[0];
    if (insensitive.length > 1) {
      throw new Error(`Signature name is ambiguous: ${wantedName}`);
    }
  }

  return null;
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(?:;[^,]+)?,(.*)$/s.exec(String(dataUrl));
  if (!match) {
    return { mimeType: null, bytes: Buffer.from(String(dataUrl), 'base64') };
  }
  return {
    mimeType: match[1] || null,
    bytes: Buffer.from(match[2], 'base64'),
  };
}

function normalizePlacement(input) {
  const signature = resolveSignature(input);
  if (!signature) {
    throw new Error('Placement must reference an existing signature by signatureId/id or signatureName/name');
  }

  const page = Number(input.page);
  const x = Number(input.x);
  const y = Number(input.y);
  const width = Number(input.width);
  const height = Number(input.height);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('placement.page must be a positive integer');
  }
  for (const [key, value] of Object.entries({ x, y, width, height })) {
    if (!Number.isFinite(value)) {
      throw new Error(`placement.${key} must be a finite number`);
    }
  }
  if (width <= 0 || height <= 0) {
    throw new Error('placement.width and placement.height must be greater than 0');
  }

  return {
    signatureId: signature.id,
    signatureName: signature.name,
    page,
    x,
    y,
    width,
    height,
  };
}

async function exportHeadless(pdfBytes, placements) {
  const normalized = placements.map((placement) => {
    const safePlacement = normalizePlacement(placement);
    const signature = resolveSignature({ id: safePlacement.signatureId });
    const { bytes } = parseDataUrl(signature.imageData);

    return {
      page: safePlacement.page,
      x: safePlacement.x,
      y: safePlacement.y,
      width: safePlacement.width,
      height: safePlacement.height,
      imageData: new Uint8Array(bytes),
    };
  });

  const originalBytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  return exportSignedPdf(originalBytes, normalized);
}

async function loadApiDocument(filePath, { includeText = true, includeOcr = false, ocr = {} } = {}) {
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    return {
      page: index + 1,
      width,
      height,
      coordinateSystem,
    };
  });

  const document = {
    filePath,
    fileName: path.basename(filePath),
    size: bytes.byteLength,
    base64: bytes.toString('base64'),
    bytes: new Uint8Array(bytes),
    pageCount: pages.length,
    coordinateSystem,
    pages,
  };

  if (includeText) {
    await attachTextCoordinates(document);
  }
  if (includeOcr) {
    await attachOcrCoordinates(document, ocr);
  }

  return document;
}

async function attachTextCoordinates(document) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: document.bytes.slice(0),
      disableWorker: true,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    for (const pageInfo of document.pages) {
      const page = await pdf.getPage(pageInfo.page);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      pageInfo.text = textContent.items
        .filter((item) => typeof item.str === 'string' && item.str.trim())
        .map((item) => textItemToPdfBox(item, viewport.height));
    }

    await pdf.destroy();
  } catch (err) {
    for (const pageInfo of document.pages) {
      pageInfo.text = [];
      pageInfo.textError = err.message;
    }
    log('API', `Text extraction failed: ${err.message}`);
  }
}

function textItemToPdfBox(item, pageHeight) {
  const [, , , textHeightRaw, xRaw, yRaw] = item.transform || [0, 0, 0, 0, 0, 0];
  const width = Number(item.width || 0);
  const height = Math.abs(Number(item.height || textHeightRaw || 0));
  const x = Number(xRaw || 0);
  const yTopOrigin = Number(yRaw || 0);

  return {
    text: item.str,
    x,
    y: pageHeight - yTopOrigin - height,
    width,
    height,
    dir: item.dir,
    fontName: item.fontName,
  };
}

async function attachOcrCoordinates(document, options = {}) {
  const scale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 2;
  const dpi = Math.max(72, Math.round(72 * scale));
  const lang = String(options.lang || 'eng');
  const psm = String(options.psm || '6');
  const maxPages = Number.isInteger(Number(options.maxPages)) ? Number(options.maxPages) : document.pageCount;

  try {
    for (const pageInfo of document.pages) {
      if (pageInfo.page > maxPages) {
        pageInfo.ocr = [];
        pageInfo.ocrSkipped = 'maxPages';
        continue;
      }

      const rendered = await renderPdfPageToPng(document.filePath, pageInfo.page, dpi);
      const tsv = await runTesseract(rendered.png, { lang, psm });
      pageInfo.ocr = parseTesseractTsv(tsv, {
        imageWidth: rendered.width,
        imageHeight: rendered.height,
        pdfWidth: pageInfo.width,
        pdfHeight: pageInfo.height,
      });
      pageInfo.ocrEngine = {
        name: 'tesseract',
        lang,
        psm,
        scale,
        dpi,
        imageWidth: rendered.width,
        imageHeight: rendered.height,
      };
    }
  } catch (err) {
    for (const pageInfo of document.pages) {
      pageInfo.ocr = [];
      pageInfo.ocrError = err.message;
    }
    log('API', `OCR failed: ${err.message}`);
  }
}

async function renderPdfPageToPng(filePath, pageNumber, dpi) {
  const tmpPrefix = path.join(
    os.tmpdir(),
    `signaturizer-page-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const outputPath = `${tmpPrefix}.png`;

  await execFileAsync('pdftoppm', [
    '-f', String(pageNumber),
    '-l', String(pageNumber),
    '-singlefile',
    '-r', String(dpi),
    '-png',
    filePath,
    tmpPrefix,
  ]);

  const png = fs.readFileSync(outputPath);
  fs.rmSync(outputPath, { force: true });
  const dimensions = getPngDimensions(png);

  return {
    png,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function runTesseract(pngBuffer, { lang, psm }) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(
      os.tmpdir(),
      `signaturizer-ocr-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.png`,
    );

    fs.writeFileSync(tmpPath, pngBuffer);
    execFile(
      'tesseract',
      [tmpPath, 'stdout', '-l', lang, '--psm', psm, 'tsv'],
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        fs.rmSync(tmpPath, { force: true });
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function getPngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Rendered OCR page is not a PNG');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseTesseractTsv(tsv, { imageWidth, imageHeight, pdfWidth, pdfHeight }) {
  const lines = String(tsv).trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  const index = Object.fromEntries(headers.map((name, idx) => [name, idx]));

  return lines.slice(1)
    .map((line) => {
      const cols = line.split('\t');
      const text = cols[index.text]?.trim();
      const confidence = Number(cols[index.conf]);
      if (!text || !Number.isFinite(confidence) || confidence < 0) return null;

      const left = Number(cols[index.left]);
      const top = Number(cols[index.top]);
      const widthPx = Number(cols[index.width]);
      const heightPx = Number(cols[index.height]);
      if (![left, top, widthPx, heightPx].every(Number.isFinite)) return null;

      return {
        text,
        confidence,
        pageBlock: Number(cols[index.block_num]),
        paragraph: Number(cols[index.par_num]),
        line: Number(cols[index.line_num]),
        word: Number(cols[index.word_num]),
        x: (left / imageWidth) * pdfWidth,
        y: pdfHeight - ((top + heightPx) / imageHeight) * pdfHeight,
        width: (widthPx / imageWidth) * pdfWidth,
        height: (heightPx / imageHeight) * pdfHeight,
      };
    })
    .filter(Boolean);
}

function publicDocument(document, { includeText = true, includeOcr = false } = {}) {
  return {
    filePath: document.filePath,
    fileName: document.fileName,
    size: document.size,
    pageCount: document.pageCount,
    coordinateSystem: document.coordinateSystem,
    pages: document.pages.map((page) => {
      const publicPage = {
        page: page.page,
        width: page.width,
        height: page.height,
        coordinateSystem: page.coordinateSystem,
      };
      if (includeText) {
        publicPage.text = page.text || [];
        if (page.textError) publicPage.textError = page.textError;
      }
      if (includeOcr) {
        publicPage.ocr = page.ocr || [];
        if (page.ocrEngine) publicPage.ocrEngine = page.ocrEngine;
        if (page.ocrError) publicPage.ocrError = page.ocrError;
        if (page.ocrSkipped) publicPage.ocrSkipped = page.ocrSkipped;
      }
      return publicPage;
    }),
  };
}

function summarizeCurrentDocument(document) {
  return {
    filePath: document.filePath,
    fileName: document.fileName,
    size: document.size,
    pageCount: document.pageCount,
  };
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    minWidth: 800,
    title: 'Signaturizer',
    icon: path.join(__dirname, '../..', 'build', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindowRef = mainWindow;

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log('RENDERER', `${message} (${sourceId}:${line}, level=${level})`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('RENDERER', `process gone: ${JSON.stringify(details)}`);
  });

  if (isDev) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const prodPath = path.join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    );
    mainWindow.loadFile(prodPath);
  }

  return mainWindow;
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('open-pdf-from-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  log('IPC', `Dialog opened: ${filePath}`);

  try {
    const buffer = fs.readFileSync(filePath);
    // Send as base64 — bulletproof against detached ArrayBuffer issues.
    // Electron IPC structured clone can detach ArrayBuffers; base64 never detaches.
    const base64 = buffer.toString('base64');
    log('IPC', `Read ${buffer.byteLength} bytes, encoding to base64 (${base64.length} chars)`);
    return {
      fileName: path.basename(filePath),
      base64,
    };
  } catch (err) {
    log('IPC', `Error reading file: ${err.message}`);
    return { error: err.message };
  }
});

ipcMain.handle('save-signed-pdf', async (_event, data, suggestedName) => {
  const result = await dialog.showSaveDialog({
    defaultPath: suggestedName || 'signed.pdf',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;

  try {
    // data is base64 from renderer
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    log('IPC', `Saved ${buffer.byteLength} bytes to ${result.filePath}`);
    return true;
  } catch (err) {
    log('IPC', `Error saving: ${err.message}`);
    return { error: err.message };
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('read-signatures', () => {
  try {
    const filePath = path.join(app.getPath('userData'), 'signatures.json');
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

ipcMain.handle('write-signatures', (_event, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'signatures.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  startApiServer();
});

app.on('window-all-closed', () => {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
