

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
    vaultVerifyTotp(token: string, secret: string): Promise<boolean>;
    vaultGenerateTotp(): Promise<{ secret: string; uri: string }>;
    getDefaultBackupPath(): Promise<string>;
    saveBackup(dir: string, filename: string, data: string): Promise<boolean>;
    showDirectoryPicker(): Promise<string | null>;
    showFilePicker(): Promise<string | null>;
    openBackup(filePath: string): Promise<string | null>;
    checkIntegrity(): Promise<boolean>;
    getMachineId(): Promise<string | null>;
    biometricHandshake(options: { action: 'create' | 'get', publicKey: any }): Promise<{ success: boolean; data?: any; error?: string }>;
    getPlatform(): NodeJS.Platform;
}

interface Window {
    electronAPI: ElectronAPI;
}
