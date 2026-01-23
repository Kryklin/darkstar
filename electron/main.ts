import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, session, shell, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { updateElectronApp } from 'update-electron-app';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line
if (require('electron-squirrel-startup')) {
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
    console.log('Main: Initializing auto-updater...');
    try {
      updateElectronApp();
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

import { TorManager } from './tor.manager';
import { TorControl } from './tor.control';

// ... (imports)

app.whenReady().then(async () => {
  createWindow();
  createTray();
  
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
      TorManager.getInstance().setMainWindow(win);
  }


  // Start Tor
  const torManager = TorManager.getInstance();
  await torManager.start();

  // Update modules with dynamic ports
  // p2pBackend is global, just update its port
  p2pBackend.setSocksPort(torManager.socksPort);
  
  const torControl = TorControl.getInstance();
  torControl.setControlPort(torManager.controlPort);
  
  // Try connecting after a short delay (give Tor time to boot)
  setTimeout(async () => {
      if (await torControl.connect()) {
          try {
              await torControl.authenticate();
              console.log('TorControl: Authenticated successfully.');
          } catch (e) {
              console.error('TorControl: Auth failed', e);
          }
      }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  TorManager.getInstance().stop();
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
  console.log('IPC: check-for-updates received');
  try {
    const feedUrl = autoUpdater.getFeedURL();
    console.log('Current Feed URL:', feedUrl);
  } catch (e) {
    console.log('Error getting feed URL:', e);
  }
  autoUpdater.checkForUpdates();
});

ipcMain.handle('create-shortcut', async (_event, target: 'desktop' | 'start-menu') => {
  return await createShortcut(target);
});

ipcMain.on('set-version-lock', (_event, locked: boolean) => {
  isVersionLocked = locked;
  console.log(`Main: Version lock state changed to: ${locked}`);
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
  console.log('IPC: restart-and-install received');
  autoUpdater.quitAndInstall();
});

import { P2PBackend } from './p2p.backend';

const p2pBackend = new P2PBackend();

ipcMain.handle('p2p-create-service', async (event, localPort: number) => {
    // Start listening on the local port that Tor will forward to
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      p2pBackend.setMainWindow(win);
    }
    p2pBackend.startServer(localPort);
    
    // Tell Tor to create the hidden service mapping
    const onionAddress = await TorControl.getInstance().createHiddenService(localPort);
    return onionAddress;
});

ipcMain.handle('p2p-send-message', async (_event, onion: string, message: { id: string; sender: string; content: string; timestamp: number; signature?: string; publicKey?: JsonWebKey }) => {
    await p2pBackend.sendMessage(onion, message);
});

ipcMain.handle('p2p-stop-service', async (_event, onionAddress: string) => {
    // 1. Tell Tor to delete the hidden service
    await TorControl.getInstance().destroyHiddenService(onionAddress);
    // 2. Stop the local P2P backend server
    p2pBackend.stop();
});

ipcMain.handle('p2p-check-status', async (_event, onionAddress: string) => {
    return await p2pBackend.checkServiceStatus(onionAddress);
});

/**
 * Listen on `autoUpdater` events and relay status to the renderer process via IPC.
 */
autoUpdater.on('checking-for-update', () => {
  console.log('AutoUpdater: checking-for-update');
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', () => {
  console.log('AutoUpdater: update-available');
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'available' });
});

autoUpdater.on('update-not-available', () => {
  console.log('AutoUpdater: update-not-available');
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

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
  console.log('AutoUpdater: update-downloaded', { releaseName, releaseDate, updateURL });
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'downloaded' });
});
