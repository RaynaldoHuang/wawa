import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { join } from 'path';
import { rm } from 'fs/promises';

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

// Store for active connections
const deviceStore = new Map<string, WADevice>();

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
    // Check if already connected
    const existing = deviceStore.get(deviceId);
    if (existing && existing.status === 'CONNECTED') {
      return existing;
    }

    const sessionPath = this.getSessionPath(deviceId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

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

        if (qr && !options.usePairingCode) {
          device.qr = qr;
          device.status = 'PAIRING';
          options.onQR?.(qr);
        }

        if (connection === 'open') {
          device.status = 'CONNECTED';
          device.qr = undefined;
          device.pairingCode = undefined;

          // Get phone number from socket
          const phoneNumber = socket.user?.id?.split(':')[0] || '';
          device.phoneNumber = phoneNumber;

          options.onConnected?.(phoneNumber);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

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
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const device = deviceStore.get(deviceId);

    if (!device || device.status !== 'CONNECTED') {
      return { success: false, error: 'Device not connected' };
    }

    try {
      // Format number: remove non-digits and add @s.whatsapp.net
      const jid = to.replace(/\D/g, '') + '@s.whatsapp.net';

      const result = await device.socket.sendMessage(jid, { text: content });

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
