import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';

// Session storage path
const SESSIONS_PATH = join(process.cwd(), 'storages', 'wa-sessions');

// Rate limiting config (recommended)
const RATE_LIMIT = {
  messagesPerMinute: 30, // Safe limit to avoid bans
  delayBetweenMessages: 2000, // 2 seconds between messages
};

export interface WADevice {
  socket: WASocket;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING';
  phoneNumber?: string;
  qr?: string;
  pairingCode?: string;
}

export interface WASendOptions {
  attachmentUrl?: string;
  attachmentType?: 'image' | 'document' | 'video';
  ctaLabel?: string;
  ctaUrl?: string;
}

// Store for active connections
const deviceStore = new Map<string, WADevice>();
const connectingStore = new Map<string, Promise<WADevice>>();

export class WAManager {
  private static instance: WAManager;

  private constructor() {}

  static getInstance(): WAManager {
    if (!WAManager.instance) {
      WAManager.instance = new WAManager();
    }
    return WAManager.instance;
  }

  /**
   * Get session folder path for a device
   */
  private getSessionPath(deviceId: string): string {
    return join(SESSIONS_PATH, deviceId);
  }

  /**
   * Connect or initialize a WhatsApp device
   */
  async connect(
    deviceId: string,
    options: {
      phoneNumber?: string;
      usePairingCode?: boolean;
      onQR?: (qr: string) => void;
      onPairingCode?: (code: string) => void;
      onConnected?: (phoneNumber: string) => void;
      onDisconnected?: (reason: string) => void;
    } = {},
  ): Promise<WADevice> {
    const existingConnect = connectingStore.get(deviceId);
    if (existingConnect) {
      return existingConnect;
    }

    // Reuse active in-memory session when possible
    const existing = deviceStore.get(deviceId);
    if (
      existing &&
      (existing.status === 'CONNECTED' || existing.status === 'PAIRING')
    ) {
      return existing;
    }

    if (existing?.status === 'DISCONNECTED') {
      try {
        existing.socket.end(undefined);
      } catch {
        // Ignore socket end errors
      }
      deviceStore.delete(deviceId);
    }

    const connectPromise = this.createConnection(deviceId, options);
    connectingStore.set(deviceId, connectPromise);

    try {
      return await connectPromise;
    } finally {
      connectingStore.delete(deviceId);
    }
  }

  private async createConnection(
    deviceId: string,
    options: {
      phoneNumber?: string;
      usePairingCode?: boolean;
      onQR?: (qr: string) => void;
      onPairingCode?: (code: string) => void;
      onConnected?: (phoneNumber: string) => void;
      onDisconnected?: (reason: string) => void;
    } = {},
  ): Promise<WADevice> {
    const sessionPath = this.getSessionPath(deviceId);
    await mkdir(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    console.info('[WA] connect start', {
      deviceId,
      usePairingCode: !!options.usePairingCode,
    });

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['WAWA Platform', 'Chrome', '120.0.0'],
    });

    const device: WADevice = {
      socket,
      status: 'PAIRING',
    };

    deviceStore.set(deviceId, device);

    // Handle connection updates
    socket.ev.on(
      'connection.update',
      async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        console.info('[WA] update', {
          deviceId,
          connection,
          hasQr: !!qr,
          statusCode,
        });

        if (qr) {
          console.info('[WA] qr update', { deviceId });
        }

        if (qr && !options.usePairingCode) {
          device.qr = qr;
          device.status = 'PAIRING';
          options.onQR?.(qr);
        }

        if (connection === 'open') {
          console.info('[WA] connected', { deviceId });
          device.status = 'CONNECTED';
          device.qr = undefined;
          device.pairingCode = undefined;

          // Get phone number from socket
          const phoneNumber = socket.user?.id?.split(':')[0] || '';
          device.phoneNumber = phoneNumber;

          options.onConnected?.(phoneNumber);
        }

        if (connection === 'close') {
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn('[WA] disconnected', {
            deviceId,
            statusCode,
            shouldReconnect,
          });

          device.status = 'DISCONNECTED';

          if (shouldReconnect) {
            // Auto-reconnect
            setTimeout(() => {
              this.connect(deviceId, options);
            }, 3000);
          } else {
            deviceStore.delete(deviceId);
            options.onDisconnected?.('Logged out');
          }
        }
      },
    );

    // Save credentials on update
    socket.ev.on('creds.update', saveCreds);

    // Request pairing code if needed
    if (options.usePairingCode && options.phoneNumber) {
      setTimeout(async () => {
        try {
          const code = await socket.requestPairingCode(options.phoneNumber!);
          device.pairingCode = code;
          options.onPairingCode?.(code);
        } catch (error) {
          console.error('Failed to request pairing code:', error);
        }
      }, 3000);
    }

    return device;
  }

  /**
   * Disconnect and optionally delete a device
   */
  async disconnect(deviceId: string, deleteSession = false): Promise<void> {
    const device = deviceStore.get(deviceId);

    if (device?.socket) {
      try {
        await device.socket.logout();
      } catch {
        // Ignore logout errors
      }
      device.socket.end(undefined);
    }

    deviceStore.delete(deviceId);

    if (deleteSession) {
      try {
        await rm(this.getSessionPath(deviceId), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore deletion errors
      }
    }
  }

  /**
   * Get device status
   */
  getDevice(deviceId: string): WADevice | undefined {
    return deviceStore.get(deviceId);
  }

  /**
   * Get all active devices
   */
  getAllDevices(): Map<string, WADevice> {
    return deviceStore;
  }

  /**
   * Send a message with rate limiting
   */
  async sendMessage(
    deviceId: string,
    to: string,
    content: string,
    options: WASendOptions = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const device = deviceStore.get(deviceId);

    if (!device || device.status !== 'CONNECTED') {
      return { success: false, error: 'Device not connected' };
    }

    try {
      // Format number: remove non-digits and add @s.whatsapp.net
      const jid = to.replace(/\D/g, '') + '@s.whatsapp.net';

      let finalText = content;
      if (options.ctaLabel && options.ctaUrl) {
        finalText = `${content}\n\n${options.ctaLabel}: ${options.ctaUrl}`;
      }

      let result;

      if (options.attachmentUrl) {
        const response = await fetch(options.attachmentUrl);
        if (!response.ok) {
          return {
            success: false,
            error: `Failed to fetch attachment (${response.status})`,
          };
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (options.attachmentType === 'video') {
          result = await device.socket.sendMessage(jid, {
            video: buffer,
            caption: finalText,
          });
        } else if (options.attachmentType === 'document') {
          result = await device.socket.sendMessage(jid, {
            document: buffer,
            fileName: 'attachment',
            mimetype:
              response.headers.get('content-type') ||
              'application/octet-stream',
            caption: finalText,
          });
        } else {
          result = await device.socket.sendMessage(jid, {
            image: buffer,
            caption: finalText,
          });
        }
      } else {
        result = await device.socket.sendMessage(jid, { text: finalText });
      }

      return {
        success: true,
        messageId: result?.key?.id ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recommended delay between messages (rate limiting)
   */
  getMessageDelay(): number {
    return RATE_LIMIT.delayBetweenMessages;
  }

  /**
   * Get messages per minute limit
   */
  getMessagesPerMinuteLimit(): number {
    return RATE_LIMIT.messagesPerMinute;
  }
}

export const waManager = WAManager.getInstance();
