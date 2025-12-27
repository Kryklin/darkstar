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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
