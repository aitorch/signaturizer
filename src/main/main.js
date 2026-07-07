import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('disable-gpu-sandbox');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    minWidth: 800,
    title: 'Signaturizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Remove default menu — we'll build our own toolbar in the renderer
  Menu.setApplicationMenu(null);

  if (isDev) {
    // In dev, Vite dev server will be injected by electron-forge
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // In production, load the built index.html
    const prodPath = path.join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    );
    mainWindow.loadFile(prodPath);
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

// Open a PDF file via dialog and return its bytes — replaces generic read-file
ipcMain.handle('open-pdf-from-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    return {
      fileName: path.basename(filePath),
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  } catch (err) {
    return { error: err.message };
  }
});

// Save signed PDF bytes to a file chosen via dialog — replaces generic write-file
ipcMain.handle('save-signed-pdf', async (_event, data, suggestedName) => {
  const result = await dialog.showSaveDialog({
    defaultPath: suggestedName || 'signed.pdf',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;

  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);
    return true;
  } catch (err) {
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
