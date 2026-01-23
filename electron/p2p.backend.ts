import * as net from 'net';
import { BrowserWindow } from 'electron';
import { z } from 'zod';

export const P2PMessageSchema = z.object({
  id: z.string().uuid(),
  sender: z.string().min(1),
  content: z.string(),
  timestamp: z.number(),
  signature: z.string().optional(),
  publicKey: z.any().optional(), // JsonWebKey is complex, treating as any/object for Zod for now or define stricter
});

export type P2PMessage = z.infer<typeof P2PMessageSchema>;

export class P2PBackend {
  private server: net.Server | null = null;
  private socksPort = 9050; // Tor SOCKS5 port
  private mainWindow: BrowserWindow | null = null;



  public setSocksPort(port: number) {
      this.socksPort = port;
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  // Start listening for incoming connections from other peers (via Tor Hidden Service)
  public startServer(port: number): void {
    if (this.server) {
        console.log(`[P2P] Server already running on ${port}`);
        return;
    }

    this.server = net.createServer((socket) => {
      console.log('[P2P] Incoming connection established');

      socket.on('data', (data) => {
        try {
          const messageStr = data.toString().trim();
          console.log('[P2P] Received:', messageStr);
          
          const rawMessage = JSON.parse(messageStr);
          const validation = P2PMessageSchema.safeParse(rawMessage);

          if (!validation.success) {
              console.error('[P2P] Invalid message format:', validation.error);
              return;
          }

          const message = validation.data;
          
          if (this.mainWindow) {
            this.mainWindow.webContents.send('p2p-message-received', message);
          }
        } catch (e) {
          console.error('[P2P] Failed to parse incoming message:', e);
        }
      });

      socket.on('error', (err) => {
        console.error('[P2P] Incoming socket error:', err);
      });
    });

    // SECURITY: Bind ONLY to localhost to prevent LAN access
    this.server.listen(port, '127.0.0.1', () => {
      console.log(`[P2P] Server listening on 127.0.0.1:${port}`);
    });

    this.server.on('error', (err) => {
        console.error('[P2P] Server error:', err);
    });
  }

  // Send a message to another peer's onion address via Tor SOCKS5
  public async sendMessage(onionAddress: string, message: P2PMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      const dstPort = 80; // Hidden services usually listen on 80 virtual port
      // The onion address usually looks like "xyz...xyz.onion"

      let step = 0;

      socket.connect(this.socksPort, '127.0.0.1', () => {
        console.log('[P2P] Connected to SOCKS proxy');
        // Step 1: Greeting (No Auth)
        // VER(5) NMETHODS(1) METHODS(0)
        const greeting = Buffer.from([0x05, 0x01, 0x00]);
        socket.write(greeting);
      });

      socket.on('data', (data) => {
        if (step === 0) {
          // Response to Greeting
          // VER(5) METHOD(0)
          if (data.length >= 2 && data[0] === 0x05 && data[1] === 0x00) {
            console.log('[P2P] SOCKS Handshake OK. Sending Request...');
            step = 1;

            // Step 2: Connection Request
            // VER(5) CMD(1-Connect) RSV(0) ATYP(3-Domain) DST.ADDR(Len+Domain) DST.PORT(2 bytes)
            
            const domainBuffer = Buffer.from(onionAddress);
            const portBuffer = Buffer.alloc(2);
            portBuffer.writeUInt16BE(dstPort);

            const request = Buffer.concat([
              Buffer.from([0x05, 0x01, 0x00, 0x03, domainBuffer.length]),
              domainBuffer,
              portBuffer
            ]);

            socket.write(request);
          } else {
             socket.end();
             reject(new Error('SOCKS5 Handshake failed (Auth required?)'));
          }
        } else if (step === 1) {
          // Response to Connection Request
          // VER(5) REP(0-Success) RSV(0) ATYP BND.ADDR BND.PORT
          if (data.length >= 2 && data[1] === 0x00) {
              console.log('[P2P] Connection to Hidden Service established!');
              step = 2;
              
              // Now we can send the actual P2P payload
              const payload = JSON.stringify(message);
              socket.write(payload);
              // We can close after sending, or keep alive. For now, close after send.
              // socket.end(); 
              resolve();
          } else {
              socket.end();
              reject(new Error(`SOCKS5 Connection failed with code: ${data[1]}`));
          }
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('close', () => {
         // If we closed before step 2, it might be an issue.
         if (step < 2) {
             // reject(new Error('Connection closed prematurely'));
         }
      });
    });
  }

  // Check if a remote service is reachable by attempting a SOCKS5 handshake
  public async checkServiceStatus(onionAddress: string): Promise<boolean> {
      return new Promise((resolve) => {
          const socket = new net.Socket();
          const dstPort = 80;
          let step = 0;
          // Tor circuit creation and loopback can take time.
          // Increase timeout to 30s to allow for full circuit build/path finding.
          socket.setTimeout(30000);

          socket.connect(this.socksPort, '127.0.0.1', () => {
              const greeting = Buffer.from([0x05, 0x01, 0x00]);
              socket.write(greeting);
          });

          socket.on('data', (data) => {
              if (step === 0) {
                  if (data.length >= 2 && data[0] === 0x05 && data[1] === 0x00) {
                      step = 1;
                      const domainBuffer = Buffer.from(onionAddress);
                      const portBuffer = Buffer.alloc(2);
                      portBuffer.writeUInt16BE(dstPort);
                      const request = Buffer.concat([
                          Buffer.from([0x05, 0x01, 0x00, 0x03, domainBuffer.length]),
                          domainBuffer,
                          portBuffer
                      ]);
                      socket.write(request);
                  } else {
                      socket.destroy();
                      resolve(false);
                  }
              } else if (step === 1) {
                  if (data.length >= 2 && data[1] === 0x00) {
                      // Connection succeed!
                      socket.destroy();
                      resolve(true); 
                  } else {
                      socket.destroy();
                      resolve(false);
                  }
              }
          });

          socket.on('error', (err) => {
              console.error(`[P2P] Check Status Error for ${onionAddress}:`, err.message);
              resolve(false);
          });
          socket.on('timeout', () => {
              console.warn(`[P2P] Check Status Timeout (30s) for ${onionAddress}`);
              socket.destroy();
              resolve(false);
          });
          socket.on('close', () => {
             if (step < 2 && !socket.destroyed) resolve(false); // If closed before success
          });
      });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
