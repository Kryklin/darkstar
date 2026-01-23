import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const portfinder = require('portfinder');

export class TorManager {
  private static instance: TorManager;
  private torProcess: ChildProcess | null = null;
  private isShuttingDown = false;
  private mainWindow: BrowserWindow | null = null;
  
  public socksPort = 9050;
  public controlPort = 9051;

  public static getInstance(): TorManager {
    if (!TorManager.instance) {
      TorManager.instance = new TorManager();
    }
    return TorManager.instance;
  }

  public setMainWindow(window: BrowserWindow) {
      this.mainWindow = window;
  }

  public async start(): Promise<void> {
    if (this.torProcess) {
      console.log('TorManager: Tor is already running.');
      return;
    }

    // Find free ports
    try {
        this.socksPort = await portfinder.getPortPromise({ port: 9050 });
        this.controlPort = await portfinder.getPortPromise({ port: 9051 });
        console.log(`TorManager: Selected ports - SOCKS: ${this.socksPort}, Control: ${this.controlPort}`);
    } catch (e) {
        console.error('TorManager: Failed to find free ports', e);
        // Fallback or throw? Fallback for now/or let Tor fail
    }

    const torPath = this.getTorExecutablePath();
    const dataDir = path.join(app.getPath('userData'), 'tor');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`TorManager: Spawning Tor from ${torPath}`);
    console.log(`TorManager: Data Directory: ${dataDir}`);

    const args = [
      '--SocksPort', String(this.socksPort),
      '--ControlPort', String(this.controlPort),
      '--DataDirectory', dataDir,
      // 'GeoIPFile', path.join(path.dirname(torPath), 'geoip'),
      // 'GeoIPv6File', path.join(path.dirname(torPath), 'geoip6'),
    ];

    try {
        // In dev, we might not have the binary, so we wrap in try-catch or check existence
        if (!fs.existsSync(torPath)) {
            console.error('TorManager: Tor binary not found. P2P features will be disabled.');
            return;
        }

        this.torProcess = spawn(torPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        this.torProcess.on('error', (err) => {
            console.error('TorManager: Failed to spawn Tor:', err);
            this.mainWindow?.webContents.send('tor-error', err.message);
        });

        this.torProcess.stdout?.on('data', (data) => {
            const msg = data.toString().trim();
            console.log(`Tor: ${msg}`);
            
            // Parse Bootstrap Progress
            // Example: Bootstrapped 10% (conn_done): Connected to a relay
            if (msg.includes('Bootstrapped')) {
                const percentMatch = msg.match(/Bootstrapped (\d+)%/);
                const summaryMatch = msg.match(/\): (.+)$/);
                
                if (percentMatch) {
                    const progress = parseInt(percentMatch[1], 10);
                    const summary = summaryMatch ? summaryMatch[1] : msg;
                    this.mainWindow?.webContents.send('tor-progress', { progress, summary });
                }
            }
        });

        this.torProcess.stderr?.on('data', (data) => {
            console.error(`Tor Error: ${data.toString().trim()}`);
        });

        this.torProcess.on('exit', (code, signal) => {
            console.log(`TorManager: Tor exited with code ${code} signal ${signal}`);
            this.torProcess = null;
            if (!this.isShuttingDown) {
                // TODO: Restart logic?
                console.warn('TorManager: Tor exited unexpectedly.');
            }
        });

        console.log('TorManager: Tor started successfully.');

    } catch (e) {
        console.error('TorManager: Exception spawning Tor:', e);
    }
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (this.torProcess) {
      console.log('TorManager: Killing Tor process...');
      this.torProcess.kill();
      this.torProcess = null;
    }
  }

  private getTorExecutablePath(): string {
    // In production (bundled), it should be in resources/extra/tor/
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'extra', 'tor', process.platform === 'win32' ? 'tor.exe' : 'tor');
    }
    
    // In dev, look in a local 'bin' folder or similar
    return path.join(app.getAppPath(), 'resources', 'extra', 'tor', process.platform === 'win32' ? 'tor.exe' : 'tor');
  }
}
