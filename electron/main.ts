import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, session, shell } from 'electron';
import * as childProcess from 'child_process';
import * as path from 'path';
import { updateElectronApp } from 'update-electron-app';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line
if (require('electron-squirrel-startup')) {
  app.quit();
  process.exit(0);
}

updateElectronApp();

function createShortcut(target: 'desktop' | 'start-menu'): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const targetPath = process.execPath;
    const shortcutName = 'Darkstar.lnk';
    let script = '';

    if (target === 'desktop') {
      script = `
        $ws = New-Object -ComObject WScript.Shell;
        $path = [System.Environment]::GetFolderPath('Desktop');
        $s = $ws.CreateShortcut("$path\\${shortcutName}");
        $s.TargetPath = "${targetPath}";
        $s.Save()
      `;
    } else {
      script = `
        $ws = New-Object -ComObject WScript.Shell;
        $path = [System.Environment]::GetFolderPath('StartMenu');
        $programsPath = "$path\\Programs";
        if (!(Test-Path $programsPath)) { New-Item -ItemType Directory -Force -Path $programsPath }
        $s = $ws.CreateShortcut("$programsPath\\${shortcutName}");
        $s.TargetPath = "${targetPath}";
        $s.Save()
      `;
    }

    const ps = childProcess.spawn('powershell.exe', ['-Command', script], {
      windowsHide: true,
    });

    ps.on('close', (code) => {
      if (code === 0) {
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

  const contextMenu = Menu.buildFromTemplate([
    { label: `Version: ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() },
  ]);

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

app.whenReady().then(() => {
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

ipcMain.handle('reset-app', async () => {
  await session.defaultSession.clearStorageData();
  app.relaunch();
  app.exit(0);
});

ipcMain.on('restart-and-install', () => {
  console.log('IPC: restart-and-install received');
  autoUpdater.quitAndInstall();
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
