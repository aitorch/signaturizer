import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // PDF operations — specific actions, no generic file read/write
  openPdfFromDialog: () => ipcRenderer.invoke('open-pdf-from-dialog'),
  saveSignedPdf: (data, suggestedName) => ipcRenderer.invoke('save-signed-pdf', data, suggestedName),

  // Signature storage — scoped to userData/signatures.json
  readSignatures: () => ipcRenderer.invoke('read-signatures'),
  writeSignatures: (data) => ipcRenderer.invoke('write-signatures', data),
});
