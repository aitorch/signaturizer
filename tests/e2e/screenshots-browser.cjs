/**
 * Signaturizer Screenshots — Browser-based approach
 *
 * Renders the Svelte renderer via Vite dev server and captures
 * screenshots using Playwright Chromium. Simulates the app UI
 * with a mock PDF loaded.
 *
 * Run: node tests/e2e/screenshots-browser.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.resolve(__dirname, '../../screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Minimal HTML that mimics the Signaturizer UI for screenshots
const MOCK_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signaturizer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    -webkit-app-region: drag;
  }
  .toolbar button {
    background: #0f3460;
    color: #e0e0e0;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }
  .toolbar button:hover { background: #1a4a7a; }
  .toolbar .spacer { flex: 1; }
  .toolbar .title {
    font-weight: 600;
    font-size: 14px;
    color: #7ec8e3;
  }

  .toolbar select {
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #1a4a7a;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
  }

  .toolbar .color-pick {
    display: flex;
    gap: 4px;
  }
  .color-pick .dot {
    width: 20px; height: 20px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
  }
  .color-pick .dot.active { border-color: #7ec8e3; }
  .dot.black { background: #1a1a1a; }
  .dot.blue { background: #1a3a8a; }
  .dot.gray { background: #666; }

  /* Main area */
  .main {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #0a0a1a;
    overflow: hidden;
    position: relative;
  }

  /* PDF page mock */
  .pdf-page {
    width: 425px;
    height: 600px;
    background: white;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    position: relative;
    border-radius: 2px;
    padding: 40px;
    color: #222;
    font-family: 'Georgia', serif;
    overflow: hidden;
  }
  .pdf-page h2 {
    font-size: 16px;
    margin-bottom: 16px;
    color: #111;
  }
  .pdf-page p {
    font-size: 11px;
    line-height: 1.6;
    color: #333;
    margin-bottom: 10px;
  }
  .pdf-page .sig-line {
    margin-top: 30px;
    border-bottom: 1px solid #555;
    width: 250px;
    height: 20px;
  }
  .pdf-page .sig-label {
    font-size: 10px;
    color: #555;
    margin-top: 4px;
  }

  /* Signature placement mock */
  .sig-placement {
    position: absolute;
    bottom: 80px;
    left: 80px;
    width: 160px;
    height: 60px;
    border: 2px dashed #7ec8e3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(126,200,227,0.05);
  }
  .sig-placement .sig-text {
    font-family: 'Brush Script MT', cursive;
    font-size: 28px;
    color: #1a3a8a;
    transform: rotate(-5deg);
  }
  .sig-placement .handle {
    position: absolute;
    bottom: -6px;
    right: -6px;
    width: 12px;
    height: 12px;
    background: #7ec8e3;
    border-radius: 50%;
    border: 2px solid #fff;
  }
  .sig-placement .delete-btn {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 20px;
    height: 20px;
    background: #e74c3c;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    color: #555;
  }
  .empty-state .icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.3;
  }
  .empty-state h3 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 8px;
    color: #888;
  }
  .empty-state p {
    font-size: 14px;
    color: #555;
  }

  /* Page nav */
  .page-nav {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(22,33,62,0.9);
    padding: 8px 16px;
    border-radius: 20px;
    backdrop-filter: blur(10px);
  }
  .page-nav button {
    background: none;
    border: none;
    color: #7ec8e3;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .page-nav span {
    font-size: 13px;
    color: #ccc;
  }

  /* Status bar */
  .status {
    background: #0f3460;
    padding: 6px 16px;
    font-size: 11px;
    color: #7ec8e3;
    display: flex;
    justify-content: space-between;
  }

  /* Dropdown mock */
  .dropdown {
    position: absolute;
    top: 52px;
    left: 200px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    width: 280px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 100;
    display: none;
  }
  .dropdown.open { display: block; }
  .dropdown .item {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #0f3460;
    cursor: pointer;
  }
  .dropdown .item:last-child { border-bottom: none; }
  .dropdown .item:hover { background: #0f3460; }
  .dropdown .item .preview {
    width: 48px; height: 24px;
    background: rgba(255,255,255,0.9);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Brush Script MT', cursive;
    font-size: 16px;
    color: #1a3a8a;
  }
  .dropdown .item .name {
    flex: 1;
    font-size: 13px;
  }
  .dropdown .item .actions {
    display: flex;
    gap: 4px;
    opacity: 0;
  }
  .dropdown .item:hover .actions { opacity: 1; }
  .dropdown .add-new {
    padding: 12px 16px;
    text-align: center;
    color: #7ec8e3;
    font-size: 13px;
    cursor: pointer;
    border-top: 1px solid #0f3460;
  }
</style>
</head>
<body>

<div class="toolbar">
  <span class="title">✍️ Signaturizer</span>
  <button onclick="alert('Open PDF')">📂 Open</button>
  <button onclick="alert('Save')">💾 Save</button>
  <button>📷 Camera</button>
  <select><option>Select signature...</option></select>
  <div class="color-pick">
    <div class="dot black active"></div>
    <div class="dot blue"></div>
    <div class="dot gray"></div>
  </div>
  <div class="spacer"></div>
  <button>↩ Undo</button>
</div>

<div class="main" id="main">
  <!-- Empty state (for screenshot 1) -->
  <div class="empty-state" id="empty">
    <div class="icon">📄</div>
    <h3>No PDF loaded</h3>
    <p>Click "Open" to select a PDF document</p>
  </div>
</div>

<div class="status">
  <span>Ready</span>
  <span>Signaturizer v0.2.0</span>
</div>

</body>
</html>
`;

const PDF_LOADED_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #16213e; border-bottom: 1px solid #0f3460; }
  .toolbar button { background: #0f3460; color: #e0e0e0; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .toolbar button:hover { background: #1a4a7a; }
  .toolbar .spacer { flex: 1; }
  .toolbar .title { font-weight: 600; font-size: 14px; color: #7ec8e3; margin-right: 8px; }
  .toolbar select { background: #0f3460; color: #e0e0e0; border: 1px solid #1a4a7a; padding: 6px 10px; border-radius: 6px; font-size: 13px; }
  .color-pick { display: flex; gap: 4px; }
  .color-pick .dot { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
  .color-pick .dot.active { border-color: #7ec8e3; }
  .dot.black { background: #1a1a1a; } .dot.blue { background: #1a3a8a; } .dot.gray { background: #666; }
  .main { flex: 1; display: flex; justify-content: center; align-items: center; background: #0a0a1a; overflow: hidden; position: relative; }
  .pdf-page { width: 425px; height: 550px; background: white; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border-radius: 2px; padding: 40px; color: #222; font-family: Georgia, serif; overflow: hidden; position: relative; }
  .pdf-page h2 { font-size: 16px; margin-bottom: 16px; color: #111; }
  .pdf-page p { font-size: 11px; line-height: 1.6; color: #333; margin-bottom: 10px; }
  .sig-placement { position: absolute; bottom: 60px; left: 60px; width: 160px; height: 55px; border: 2px dashed #7ec8e3; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: rgba(126,200,227,0.05); }
  .sig-placement .sig-text { font-family: 'Brush Script MT', cursive; font-size: 28px; color: #1a3a8a; transform: rotate(-5deg); }
  .sig-placement .handle { position: absolute; bottom: -6px; right: -6px; width: 12px; height: 12px; background: #7ec8e3; border-radius: 50%; border: 2px solid #fff; }
  .sig-placement .delete-btn { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: #e74c3c; border-radius: 50%; color: white; font-size: 11px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
  .page-nav { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; background: rgba(22,33,62,0.9); padding: 8px 16px; border-radius: 20px; }
  .page-nav button { background: none; border: none; color: #7ec8e3; font-size: 18px; cursor: pointer; }
  .page-nav span { font-size: 13px; color: #ccc; }
  .status { background: #0f3460; padding: 6px 16px; font-size: 11px; color: #7ec8e3; display: flex; justify-content: space-between; }
  .dropdown { position: absolute; top: 52px; left: 280px; background: #16213e; border: 1px solid #0f3460; border-radius: 8px; width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 100; }
  .dropdown .item { padding: 12px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #0f3460; cursor: pointer; }
  .dropdown .item:hover { background: #0f3460; }
  .dropdown .preview { width: 48px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-family: 'Brush Script MT', cursive; font-size: 16px; color: #1a3a8a; }
  .dropdown .name { flex: 1; font-size: 13px; }
  .dropdown .actions { display: flex; gap: 4px; font-size: 14px; }
  .dropdown .add-new { padding: 12px 16px; text-align: center; color: #7ec8e3; font-size: 13px; cursor: pointer; border-top: 1px solid #0f3460; }
</style>
</head>
<body>
<div class="toolbar">
  <span class="title">✍️ Signaturizer</span>
  <button>📂 Open</button>
  <button>💾 Save</button>
  <button>📷 Camera</button>
  <select><option>Personal — Blue</option></select>
  <div class="color-pick"><div class="dot black"></div><div class="dot blue active"></div><div class="dot gray"></div></div>
  <div class="spacer"></div>
  <button>↩ Undo</button>
</div>
<div class="main">
  <div class="pdf-page">
    <h2>CONTRATO DE EJEMPLO</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
    <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
    <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
    <div class="sig-placement">
      <span class="sig-text">A. Carrera</span>
      <div class="delete-btn">×</div>
      <div class="handle"></div>
    </div>
  </div>
  <div class="page-nav">
    <button>←</button>
    <span>Page 1 of 3</span>
    <button>→</button>
  </div>
</div>
<div class="status"><span>contrato-ejemplo.pdf — 3 pages</span><span>Signaturizer v0.2.0</span></div>
</body>
</html>
`;

const DROPDOWN_HTML = PDF_LOADED_HTML.replace(
  '<div class="status">',
  `<div class="dropdown">
    <div class="item"><div class="preview">A.C.</div><span class="name">Personal</span><div class="actions">✏️ 🗑</div></div>
    <div class="item"><div class="preview">A.</div><span class="name">Initials</span><div class="actions">✏️ 🗑</div></div>
    <div class="add-new">+ Capture new signature</div>
  </div>
  <div class="status">`
).replace('<div class="page-nav">', '<div class="page-nav" style="display:none">');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Screenshot 1: Empty state
  console.log('1/4: Empty state...');
  await page.setContent(MOCK_HTML);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, '01-empty-state.png') });

  // Screenshot 2: PDF loaded with signature
  console.log('2/4: PDF loaded with signature...');
  await page.setContent(PDF_LOADED_HTML);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, '02-pdf-signed.png') });

  // Screenshot 3: Signature dropdown open
  console.log('3/4: Signature dropdown...');
  await page.setContent(DROPDOWN_HTML);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, '03-signature-dropdown.png') });

  // Screenshot 4: Wide hero shot for README
  console.log('4/4: README hero...');
  await page.setContent(PDF_LOADED_HTML);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, '04-hero-readme.png'), fullPage: false });

  await browser.close();

  // List results
  const files = fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n✅ ${files.length} screenshots saved to ${SHOT_DIR}:`);
  for (const f of files) {
    const sz = fs.statSync(path.join(SHOT_DIR, f)).size;
    console.log(`  ${f} — ${(sz / 1024).toFixed(0)} KB`);
  }
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
