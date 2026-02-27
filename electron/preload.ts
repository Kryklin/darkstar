import { contextBridge, ipcRenderer } from 'electron';

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
  vaultGenerateTotp: () => ipcRenderer.invoke('vault-generate-totp'),
  vaultVerifyTotp: (token: string, secret: string) => ipcRenderer.invoke('vault-verify-totp', token, secret),
  getDefaultBackupPath: () => ipcRenderer.invoke('get-default-backup-path'),
  saveBackup: (dir: string, filename: string, data: string) => ipcRenderer.invoke('save-backup', dir, filename, data),
  showDirectoryPicker: () => ipcRenderer.invoke('show-directory-picker'),
  checkIntegrity: () => ipcRenderer.invoke('check-integrity'),
  getMachineId: (): Promise<string | null> => ipcRenderer.invoke('get-machine-id'),
  biometricHandshake: (options: { action: 'create' | 'get', publicKey: any }): Promise<{ success: boolean, data?: any, error?: string }> => ipcRenderer.invoke('biometric-handshake', options),
  getPlatform: () => process.platform,
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
