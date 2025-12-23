import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, autoUpdater, dialog, session } from 'electron';
// eslint-disable-next-line
if (require('electron-squirrel-startup')) app.quit();

import { updateElectronApp } from 'update-electron-app';
updateElectronApp();
import * as path from 'path';

let tray: Tray | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    icon: path.join(__dirname, '..', '..', 'dist', 'darkstar', 'browser', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
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
    { label: 'Check for Updates', click: () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.send('initiate-update-check');
      }
    }},
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
          cancelId: 0
        });

        if (response === 1) {
          await session.defaultSession.clearStorageData();
          app.relaunch();
          app.exit(0);
        }
      } 
    },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
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

// Update Events
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
