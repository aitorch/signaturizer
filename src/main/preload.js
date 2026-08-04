import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // PDF operations — returns { fileName, base64 } or { error }
  openPdfFromDialog: () => ipcRenderer.invoke('open-pdf-from-dialog'),
  saveSignedPdf: (data, suggestedName) => ipcRenderer.invoke('save-signed-pdf', data, suggestedName),

  // Signature storage — scoped to userData/signatures.json
  readSignatures: () => ipcRenderer.invoke('read-signatures'),
  writeSignatures: (data) => ipcRenderer.invoke('write-signatures', data),

  // API channel — allows external agents to open PDFs programmatically
  onApiOpenPdf: (callback) => {
    ipcRenderer.on('api-open-pdf', (_event, data) => callback(data));
  },
});
