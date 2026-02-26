import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, session, shell, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { updateElectronApp } from 'update-electron-app';
import { machineIdSync } from 'node-machine-id';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup) {
  app.quit();
  process.exit(0);
}

let updaterInitialized = false;
let isVersionLocked = false;

/**
 * Initializes the auto-updater if the app is packaged and NOT version-locked.
 */
function initUpdater() {
  if (updaterInitialized) return;
  if (app.isPackaged && !isVersionLocked) {
    try {
      updateElectronApp({ notifyUser: false });
      updaterInitialized = true;
    } catch (err) {
      console.error('Main: Failed to initialize auto-updater', err);
    }
  }
}

function createShortcut(target: 'desktop' | 'start-menu'): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const targetPath = process.execPath;
    const shortcutName = 'Darkstar.lnk';
    let shortcutPath = '';

    if (target === 'desktop') {
      shortcutPath = path.join(app.getPath('desktop'), shortcutName);
    } else {
      shortcutPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', shortcutName);
    }

    const operation = shell.writeShortcutLink(shortcutPath, 'create', {
      target: targetPath,
      cwd: path.dirname(targetPath),
      description: 'Darkstar Application',
    });

    if (operation) {
      resolve({
        success: true,
        message: `Successfully created ${target === 'desktop' ? 'Desktop' : 'Start Menu'} shortcut.`,
      });
    } else {
      resolve({
        success: false,
        message: `Failed to create ${target === 'desktop' ? 'Desktop' : 'Start Menu'} shortcut.`,
      });
    }
  });
}

let tray: Tray | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    icon: path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: !app.isPackaged && !process.env['ELECTRON_PROD_DEBUG'],
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!app.isPackaged && !process.env['ELECTRON_PROD_DEBUG']) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser', 'index.html'));
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser', 'favicon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([{ label: `Version: ${app.getVersion()}`, enabled: false }, { type: 'separator' }, { label: 'Exit', click: () => app.quit() }]);

  tray.setToolTip('Darkstar');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isVisible()) {
        if (win.isMinimized()) {
          win.restore();
        } else {
          win.show();
        }
      } else {
        win.show();
      }
      win.focus();
    }
  });
}

import { verifyIntegrity } from './integrity';

app.whenReady().then(async () => {
  await verifyIntegrity();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.close();
  }
});

ipcMain.on('check-for-updates', () => {
  try {
    autoUpdater.getFeedURL();
  } catch (e) {
    console.log('Error getting feed URL:', e);
  }
  autoUpdater.checkForUpdates();
});

ipcMain.handle('create-shortcut', async (_event, target: 'desktop' | 'start-menu') => {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Shortcuts are only supported on Windows.' };
  }
  return await createShortcut(target);
});

ipcMain.on('set-version-lock', (_event, locked: boolean) => {
  isVersionLocked = locked;
  if (!locked) {
    initUpdater();
  }
});

ipcMain.handle('reset-app', async () => {
  await session.defaultSession.clearStorageData();
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('safe-storage-encrypt', async (_event, plainText: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system.');
  }
  return safeStorage.encryptString(plainText).toString('base64');
});

ipcMain.handle('safe-storage-decrypt', async (_event, encryptedBase64: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system.');
  }
  const buffer = Buffer.from(encryptedBase64, 'base64');
  return safeStorage.decryptString(buffer);
});

ipcMain.handle('safe-storage-available', () => {
  return safeStorage.isEncryptionAvailable();
});

ipcMain.handle('get-machine-id', () => {
  try {
    return machineIdSync();
  } catch (error) {
    console.error('Failed to get machine ID:', error);
    return null;
  }
});

ipcMain.handle('check-integrity', () => {
  // If the app is fully running, verifyIntegrity() has already passed at startup.
  return true;
});

// --- Vault V2 IPC Handlers ---

const getVaultPath = () => path.join(app.getPath('userData'), 'vault_storage');

ipcMain.handle('vault-ensure-dir', async () => {
  const vaultPath = getVaultPath();
  try {
    await fs.mkdir(vaultPath, { recursive: true });
    return true;
  } catch (err) {
    console.error('Failed to create vault directory:', err);
    throw err;
  }
});

ipcMain.handle('vault-save-file', async (_event, filename: string, buffer: Buffer) => {
  const filePath = path.join(getVaultPath(), filename);
  // Basic path traversal prevention
  if (path.basename(filePath) !== filename) {
    throw new Error('Invalid filename');
  }
  await fs.writeFile(filePath, buffer);
  return true;
});

ipcMain.handle('vault-read-file', async (_event, filename: string) => {
  const filePath = path.join(getVaultPath(), filename);
  if (path.basename(filePath) !== filename) {
    throw new Error('Invalid filename');
  }
  return await fs.readFile(filePath);
});

ipcMain.handle('vault-delete-file', async (_event, filename: string) => {
  const filePath = path.join(getVaultPath(), filename);
  if (path.basename(filePath) !== filename) {
    throw new Error('Invalid filename');
  }
  await fs.unlink(filePath);
  return true;
});

ipcMain.handle('vault-list-files', async () => {
  try {
    return await fs.readdir(getVaultPath());
  } catch {
    return [];
  }
});

ipcMain.on('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

/**
 * Listen on `autoUpdater` events and relay status to the renderer process via IPC.
 */
autoUpdater.on('checking-for-update', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'available' });
});

autoUpdater.on('update-not-available', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'not-available' });
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater: error', err);
  // Ignore "update check already running" errors
  if (err.message && (err.message.includes('Update check already running') || err.message.includes('already running'))) {
    return;
  }
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('update-downloaded', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'downloaded' });
});
