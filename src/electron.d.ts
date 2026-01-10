export interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onUpdateStatus: (callback: (status: { status: string; error?: string }) => void) => void;
  onInitiateUpdateCheck: (callback: () => void) => void;
  checkForUpdates: () => void;
  restartAndInstall: () => void;
  createShortcut: (target: 'desktop' | 'start-menu') => Promise<{ success: boolean; message: string }>;
  resetApp: () => Promise<void>;
  safeStorageEncrypt: (text: string) => Promise<string>;
  safeStorageDecrypt: (base64: string) => Promise<string>;
  safeStorageAvailable: () => Promise<boolean>;
  // Vault V2 API
  vaultEnsureDir: () => Promise<boolean>;
  vaultSaveFile: (filename: string, buffer: Uint8Array) => Promise<boolean>;
  vaultReadFile: (filename: string) => Promise<Uint8Array>;
  vaultDeleteFile: (filename: string) => Promise<boolean>;
  vaultListFiles: () => Promise<string[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
