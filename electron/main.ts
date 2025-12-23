import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, dialog, session } from 'electron';
import * as childProcess from 'child_process';
import * as path from 'path';
import { updateElectronApp } from 'update-electron-app';

/**
 * Handles Squirrel events for Windows installer lifecycle management.
 * Explicitly manages shortcuts and app quit/launch behavior.
 */
const handleSquirrelEvent = () => {
  if (process.argv.length === 1) {
    return false;
  }

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function (command: string, args: string[]) {
    let spawnedProcess;

    try {
      spawnedProcess = childProcess.spawn(command, args, { detached: true });
    } catch (error) {
      console.warn('Failed to spawn process', error);
    }

    return spawnedProcess;
  };

  const spawnUpdate = function (args: string[]) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
  return false;
};

if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  process.exit(0);
}

updateElectronApp();

function createShortcut(target: 'desktop' | 'start-menu') {
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
      dialog.showMessageBox({
        type: 'info',
        title: 'Shortcut Created',
        message: `Successfully created ${target === 'desktop' ? 'Desktop' : 'Start Menu'} shortcut.`,
        buttons: ['OK'],
      });
    } else {
      dialog.showErrorBox(
        'Shortcut Creation Failed',
        `Failed to create ${target === 'desktop' ? 'Desktop' : 'Start Menu'} shortcut.`,
      );
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
    },
  });

  if (!app.isPackaged) {
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
    {
      label: 'Check for Updates',
      click: () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
          win.webContents.send('initiate-update-check');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Create Desktop Shortcut',
      click: () => createShortcut('desktop'),
    },
    {
      label: 'Create Start Menu Shortcut',
      click: () => createShortcut('start-menu'),
    },
    { type: 'separator' },
    {
      label: 'Reset App',
      click: async () => {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Reset'],
          title: 'Reset Application',
          message: 'Are you sure you want to reset the application? This will clear all data and restart the app.',
          defaultId: 0,
          cancelId: 0,
        });

        if (response === 1) {
          await session.defaultSession.clearStorageData();
          app.relaunch();
          app.exit(0);
        }
      },
    },
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
  autoUpdater.checkForUpdates();
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
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('update-downloaded', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-status', { status: 'downloaded' });
});
