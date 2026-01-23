import * as net from 'net';

export class TorControl {
  private static instance: TorControl;
  private client: net.Socket | null = null;
  private controlPort = 9051;
  private isConnected = false;

  public setControlPort(port: number) {
      this.controlPort = port;
  }

  public static getInstance(): TorControl {
    if (!TorControl.instance) {
      TorControl.instance = new TorControl();
    }
    return TorControl.instance;
  }

  public async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client = new net.Socket();

      this.client.connect(this.controlPort, '127.0.0.1', () => {
        console.log('TorControl: Connected to Control Port');
        this.isConnected = true;
        resolve(true);
      });

      this.client.on('error', (err) => {
        console.error('TorControl: Connection error:', err);
        this.isConnected = false;
        resolve(false);
      });

      this.client.on('close', () => {
        console.log('TorControl: Connection closed');
        this.isConnected = false;
      });

      this.client.on('data', (data) => {
        // Handle Tor responses
        console.log('TorControl RX:', data.toString().trim());
      });
    });
  }

  public async authenticate(password = ''): Promise<void> {
    if (!this.isConnected || !this.client) throw new Error('Not connected');
    
    // Default Tor configuration often allows cookie auth or null auth for localhost
    // Sending AUTHENTICATE with empty string usually works for cookie/open auth
    const cmd = `AUTHENTICATE "${password}"\r\n`;
    this.client.write(cmd);
  }

  public async createHiddenService(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) return reject(new Error('Not connected'));

      // ADD_ONION NEW:BEST Port=80,127.0.0.1:4200
      // Request a new ephemeral hidden service mapping port 80 (onion) to local port
      const cmd = `ADD_ONION NEW:BEST Port=80,127.0.0.1:${port}\r\n`;
      
      const handler = (data: Buffer) => {
        const str = data.toString();
        // Expected: 250-ServiceID=...
        if (str.includes('250-ServiceID=')) {
          const match = str.match(/250-ServiceID=([a-z0-9]+)/);
          if (match) {
            this.client?.removeListener('data', handler);
            resolve(`${match[1]}.onion`);
          }
        } else if (str.startsWith('510') || str.startsWith('550')) {
             this.client?.removeListener('data', handler);
             reject(new Error(`Tor Error: ${str}`));
        }
      };

      this.client.on('data', handler);
      this.client.write(cmd);
    });
  }

  public async destroyHiddenService(onionAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) return reject(new Error('Not connected'));
      
      // Strip .onion just in case, though Tor usually requires the ServiceID (hostname without .onion)
      // Actually DEL_ONION takes the ServiceID.
      // E.g. DEL_ONION ag4.....
      const serviceId = onionAddress.replace('.onion', '');

      const cmd = `DEL_ONION ${serviceId}\r\n`;
      
      const handler = (data: Buffer) => {
        const str = data.toString();
        // Expected: 250 OK
        if (str.includes('250 OK')) {
            this.client?.removeListener('data', handler);
            resolve();
        } else if (str.startsWith('510') || str.startsWith('550')) {
             this.client?.removeListener('data', handler);
             reject(new Error(`Tor Error: ${str}`));
        }
      };

      this.client.on('data', handler);
      this.client.write(cmd);
    });
  }

  public disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client.destroy();
      this.client = null;
    }
  }
}
