
declare module 'portfinder' {
    export function getPortPromise(options?: { port: number }): Promise<number>;
}

interface ElectronAPI {
    minimize(): void;
    maximize(): void;
    close(): void;
    onUpdateStatus(callback: (status: { status: string; error?: string }) => void): void;
    onInitiateUpdateCheck(callback: () => void): void;
    checkForUpdates(): void;
    restartAndInstall(): void;
    setVersionLock(locked: boolean): void;
    createShortcut(target: 'desktop' | 'start-menu'): Promise<{ success: boolean; message: string }>;
    resetApp(): Promise<void>;
    safeStorageEncrypt(text: string): Promise<string>;
    safeStorageDecrypt(base64: string): Promise<string>;
    safeStorageAvailable(): Promise<boolean>;
    vaultEnsureDir(): Promise<boolean>;
    vaultSaveFile(filename: string, buffer: Uint8Array): Promise<boolean>;
    vaultReadFile(filename: string): Promise<Uint8Array>;
    vaultDeleteFile(filename: string): Promise<boolean>;
    vaultListFiles(): Promise<string[]>;
    p2pCreateService(port: number): Promise<string>;
    p2pStopService(onion: string): Promise<void>;
    p2pCheckStatus(onion: string): Promise<{ active: boolean }>;
    p2pSendMessage(onion: string, message: unknown): Promise<void>;
    onP2PMessage(callback: (message: unknown) => void): void;
    onTorProgress(callback: (progress: { progress: number; summary: string }) => void): void;
    torGetConfig(): Promise<{ useBridges: boolean; bridgeLines: string }>;
    torSaveConfig(config: { useBridges: boolean; bridgeLines: string }): Promise<boolean>;
}

interface Window {
    electronAPI: ElectronAPI;
}
