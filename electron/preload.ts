import { contextBridge, ipcRenderer } from 'electron';
import { P2PMessage } from '../src/shared-types';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  onUpdateStatus: (callback: (status: { status: string; error?: string }) => void) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  onInitiateUpdateCheck: (callback: () => void) => ipcRenderer.on('initiate-update-check', callback),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  setVersionLock: (locked: boolean) => ipcRenderer.send('set-version-lock', locked),
  createShortcut: (target: 'desktop' | 'start-menu') => ipcRenderer.invoke('create-shortcut', target),
  resetApp: () => ipcRenderer.invoke('reset-app'),
  safeStorageEncrypt: (text: string) => ipcRenderer.invoke('safe-storage-encrypt', text),
  safeStorageDecrypt: (base64: string) => ipcRenderer.invoke('safe-storage-decrypt', base64),
  safeStorageAvailable: () => ipcRenderer.invoke('safe-storage-available'),
  // Vault V2 API
  vaultEnsureDir: () => ipcRenderer.invoke('vault-ensure-dir'),
  vaultSaveFile: (filename: string, buffer: Uint8Array) => ipcRenderer.invoke('vault-save-file', filename, buffer),
  vaultReadFile: (filename: string) => ipcRenderer.invoke('vault-read-file', filename),
  vaultDeleteFile: (filename: string) => ipcRenderer.invoke('vault-delete-file', filename),
  vaultListFiles: () => ipcRenderer.invoke('vault-list-files'),
  // P2P
  p2pCreateService: (port: number) => ipcRenderer.invoke('p2p-create-service', port),
  p2pStopService: (onion: string) => ipcRenderer.invoke('p2p-stop-service', onion),
  p2pCheckStatus: (onion: string) => ipcRenderer.invoke('p2p-check-status', onion),
  p2pSendMessage: (onion: string, message: P2PMessage) => ipcRenderer.invoke('p2p-send-message', onion, message),
  onP2PMessage: (callback: (message: P2PMessage) => void) => ipcRenderer.on('p2p-message-received', (_event, value: P2PMessage) => callback(value)),
  onTorProgress: (callback: (progress: { progress: number; summary: string }) => void) => ipcRenderer.on('tor-progress', (_event, value: { progress: number; summary: string }) => callback(value)),
});

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const type of ['chrome', 'node', 'electron']) {
    const version = process.versions[type as keyof NodeJS.ProcessVersions];
    if (version) {
      replaceText(`${type}-version`, version);
    }
  }
});
