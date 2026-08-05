/**
 * Signaturizer Screenshot Generator
 *
 * Launches the Electron app, opens a sample PDF via API,
 * and captures screenshots for README and release assets.
 *
 * Run: node tests/e2e/screenshots.cjs
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../..');
const SAMPLE_PDF = path.join(__dirname, 'sample.pdf');
const SHOT_DIR = path.resolve(__dirname, '../../screenshots');

fs.mkdirSync(SHOT_DIR, { recursive: true });

function openPdfViaApi(filePath) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ filePath });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 17398,
      path: '/open',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(data);
    req.end();
  });
}

async function waitForApi(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:17398/health', (res) => {
          let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(b));
        }).on('error', reject);
      });
      if (resp) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

(async () => {
  console.log('Launching Signaturizer...');
  const app = await electron.launch({
    cwd: APP_PATH,
    args: ['.'],
    timeout: 30000,
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(2000);

    // Shot 1: Empty state
    console.log('Screenshot 1: empty state');
    await win.screenshot({ path: path.join(SHOT_DIR, '01-empty-state.png') });

    // Wait for API server
    console.log('Waiting for API server...');
    const apiUp = await waitForApi();
    console.log('API server:', apiUp ? 'ready' : 'not available');

    if (apiUp) {
      console.log('Opening sample PDF...');
      const result = await openPdfViaApi(SAMPLE_PDF);
      console.log('Open result:', result?.ok ? 'success' : 'failed');
    }

    await win.waitForTimeout(3000);

    // Shot 2: PDF loaded
    console.log('Screenshot 2: PDF loaded');
    await win.screenshot({ path: path.join(SHOT_DIR, '02-pdf-loaded.png') });

    // Shot 3: Try page 2
    const nextBtn = win.locator('button:has-text("→"), button:has-text("Sig"), [data-testid="next-page"]').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click().catch(() => {});
      await win.waitForTimeout(1500);
      console.log('Screenshot 3: page 2');
      await win.screenshot({ path: path.join(SHOT_DIR, '03-page-2.png') });
    }

    // Shot 4: Signature dropdown
    const sigBtn = win.locator('button:has-text("Signature"), button:has-text("Firma"), [data-testid="signature-dropdown"]').first();
    if (await sigBtn.count() > 0) {
      await sigBtn.click().catch(() => {});
      await win.waitForTimeout(1000);
      console.log('Screenshot 4: signature panel');
      await win.screenshot({ path: path.join(SHOT_DIR, '04-signature-panel.png') });
    }

    // Shot 5: Camera modal
    const camBtn = win.locator('button:has-text("Camera"), button:has-text("Cámara"), [data-testid="camera-btn"]').first();
    if (await camBtn.count() > 0) {
      await camBtn.click().catch(() => {});
      await win.waitForTimeout(1500);
      console.log('Screenshot 5: camera modal');
      await win.screenshot({ path: path.join(SHOT_DIR, '05-camera-modal.png') });
      await win.keyboard.press('Escape').catch(() => {});
    }

    // List screenshots
    const files = fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png'));
    console.log(`\nDone! ${files.length} screenshots in ${SHOT_DIR}:`);
    for (const f of files) {
      const sz = fs.statSync(path.join(SHOT_DIR, f)).size;
      console.log(`  ${f} (${(sz/1024).toFixed(0)} KB)`);
    }

  } finally {
    await app.close();
  }
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
