import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, session, shell, safeStorage, dialog, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { updateElectronApp } from 'update-electron-app';
import { machineIdSync } from 'node-machine-id';

// Register custom protocol as secure/standard
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

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
    // In production, we run a background sequential migration to recover stranded localStorage
    // from previous path/app updates, before showing the window on the final origin.
    (async () => {
      try {
        const distPath = path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser');
        
        // 1. Read from legacy V1-V2.1.0 file:// origin
        await win.loadFile(path.join(distPath, 'index.html'));
        const fileData = await win.webContents.executeJavaScript('Object.assign({}, window.localStorage)');

        // 2. Read from legacy V2.1.1 app:// origin (which had matching domain issues)
        await win.loadURL('app://index.html');
        const appData = await win.webContents.executeJavaScript('Object.assign({}, window.localStorage)');

        // 3. Final Origin: Explicit domain for WebAuthn RP ID match (app://darkstar)
        await win.loadURL('app://darkstar/index.html');
        const currentData = await win.webContents.executeJavaScript('Object.assign({}, window.localStorage)');
        
        // If current origin has NO vault data, we inject priority data
        if (!currentData['darkstar_vault']) {
            // Priority: Older file:// origin (usually larger/older data), else intermediate app:// origin
            const bestData = fileData['darkstar_vault'] ? fileData : (appData['darkstar_vault'] ? appData : null);
            if (bestData) {
                // Safely insert key-values
                for (const key of Object.keys(bestData)) {
                    await win.webContents.executeJavaScript(`window.localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(bestData[key])});`);
                }
            }
        }
      } catch (e) {
          console.error("Migration/Startup Sequence Failed:", e);
          // Fallback to ensuring we load
          await win.loadURL('app://darkstar/index.html');
      } finally {
        win.show();
      }
    })();
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
  // Set up the custom protocol handler to serve files from the dist directory
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    // Normalize path to prevent directory traversal
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    const distPath = path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser');
    const fullPath = path.join(distPath, pathname);

    try {
        // Basic check to ensure we are within dist
        if (!fullPath.startsWith(distPath)) {
            return new Response('Forbidden', { status: 403 });
        }
        
        const fileContent = await fs.readFile(fullPath);
        const extension = path.extname(fullPath).toLowerCase();
        
        const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.json': 'application/json',
            '.svg': 'image/svg+xml'
        };

        return new Response(new Uint8Array(fileContent), {
            headers: { 'content-type': mimeTypes[extension] || 'application/octet-stream' }
        });
    } catch (e) {
        console.error('Protocol Error:', e);
        // Fallback for SPA routing: serve index.html for unknown routes
        try {
            const indexContent = await fs.readFile(path.join(distPath, 'index.html'));
            return new Response(new Uint8Array(indexContent), { headers: { 'content-type': 'text/html' } });
        } catch (_indexError) {
            return new Response('Not Found', { status: 404 });
        }
    }
  });

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

import { generateSecret, generateURI, verifySync } from 'otplib';

ipcMain.handle('vault-generate-totp', () => {
  const secret = generateSecret();
  // We use a generic name for now
  const uri = generateURI({
      issuer: 'Darkstar',
      label: 'user',
      secret
  });
  return { secret, uri };
});

ipcMain.handle('vault-verify-totp', (_event, token: string, secret: string) => {
  try {
    const result = verifySync({ token, secret });
    return result.valid;
  } catch (_e) {
    return false;
  }
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

ipcMain.handle('get-default-backup-path', () => {
  return path.join(app.getPath('documents'), 'DarkstarBackups');
});

ipcMain.handle('save-backup', async (_event, dir: string, filename: string, data: string) => {
  try {
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    await fs.writeFile(fullPath, data, 'utf-8');
    return true;
  } catch (err) {
    console.error('Save Backup failed:', err);
    return false;
  }
});

ipcMain.handle('show-directory-picker', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Backup Folder',
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});
