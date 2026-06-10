import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

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

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled) return null;
  return result.filePaths[0] || null;
});

ipcMain.handle('save-file-dialog', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName || 'document.pdf',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('read-file', (_event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('write-file', (_event, filePath, data) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
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
