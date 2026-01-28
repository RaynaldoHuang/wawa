import { Elysia, t } from 'elysia';

import { auth } from '@/lib/auth';
import db from '@/lib/db';
import { waManager } from '@/lib/wa-manager';

export const app = new Elysia({ prefix: '/api' })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      user: session?.user,
      session: session?.session,
    };
  })
  .macro({
    role: (role: 'ADMIN' | 'USER') => ({
      beforeHandle({ user }) {
        if (!user) return new Response('Unauthorized', { status: 401 });
        const userWithRole = user as typeof user & { type: string };
        if (role && userWithRole.type !== role)
          return new Response('Forbidden', { status: 403 });
      },
    }),
    auth: () => ({
      beforeHandle({ user }) {
        if (!user) return new Response('Unauthorized', { status: 401 });
      },
    }),
  })
  .get('/', () => 'Hello Nextjs')
  .post('/', ({ body }) => body, {
    body: t.Object({
      name: t.String(),
    }),
  })
  .get('/admin', () => 'Admin Secret', {
    role: 'ADMIN',
  })
  .get('/user', () => 'User Secret', {
    role: 'USER',
  })
  // ==================== DEVICES ====================
  .get(
    '/devices',
    async ({ user }) => {
      const devices = await db.device.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: 'desc' },
      });
      return devices;
    },
    { auth: true },
  )
  .post(
    '/devices/connect',
    async ({ user, body }) => {
      const { phoneNumber, usePairingCode } = body;
      const userId = user!.id;

      // Check if phone already exists
      const existing = await db.device.findUnique({
        where: { phoneNumber },
      });
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Phone number already registered' }),
          { status: 400 },
        );
      }

      // Create device record
      const device = await db.device.create({
        data: {
          userId,
          phoneNumber,
          sessionName: `session-${userId}-${Date.now()}`,
          status: 'PAIRING',
        },
      });

      // Store for async updates
      let qrCode: string | undefined;
      let pairingCode: string | undefined;

      // Connect via WAManager
      await waManager.connect(device.id, {
        phoneNumber,
        usePairingCode,
        onQR: (qr) => {
          qrCode = qr;
        },
        onPairingCode: (code) => {
          pairingCode = code;
        },
        onConnected: async (phone) => {
          await db.device.update({
            where: { id: device.id },
            data: {
              status: 'CONNECTED',
              phoneNumber: phone,
              connectedAt: new Date(),
            },
          });
        },
        onDisconnected: async () => {
          await db.device.update({
            where: { id: device.id },
            data: { status: 'DISCONNECTED' },
          });
        },
      });

      // Wait briefly for QR/code
      await new Promise((r) => setTimeout(r, 3500));

      const waDevice = waManager.getDevice(device.id);

      return {
        deviceId: device.id,
        status: waDevice?.status || 'PAIRING',
        qr: waDevice?.qr || qrCode,
        pairingCode: waDevice?.pairingCode || pairingCode,
      };
    },
    {
      auth: true,
      body: t.Object({
        phoneNumber: t.String(),
        usePairingCode: t.Optional(t.Boolean()),
      }),
    },
  )
  .get(
    '/devices/:id/status',
    async ({ user, params }) => {
      const device = await db.device.findFirst({
        where: { id: params.id, userId: user!.id },
      });
      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not found' }), {
          status: 404,
        });
      }

      const waDevice = waManager.getDevice(device.id);

      return {
        id: device.id,
        phoneNumber: device.phoneNumber,
        status: waDevice?.status || device.status,
        qr: waDevice?.qr,
        pairingCode: waDevice?.pairingCode,
      };
    },
    { auth: true },
  )
  .delete(
    '/devices/:id',
    async ({ user, params }) => {
      const device = await db.device.findFirst({
        where: { id: params.id, userId: user!.id },
      });
      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not found' }), {
          status: 404,
        });
      }

      // Disconnect and delete session
      await waManager.disconnect(device.id, true);

      // Delete from database
      await db.device.delete({ where: { id: device.id } });

      return { success: true };
    },
    { auth: true },
  )
  // ==================== WALLET ====================
  .get(
    '/wallet',
    async ({ user }) => {
      const userData = await db.user.findUnique({
        where: { id: user!.id },
        select: {
          walletBalance: true,
          bankName: true,
          bankAccount: true,
          bankHolder: true,
        },
      });
      return userData;
    },
    { auth: true },
  )
  .put(
    '/wallet/bank',
    async ({ user, body }) => {
      const updated = await db.user.update({
        where: { id: user!.id },
        data: {
          bankName: body.bankName,
          bankAccount: body.bankAccount,
          bankHolder: body.bankHolder,
        },
        select: {
          bankName: true,
          bankAccount: true,
          bankHolder: true,
        },
      });
      return updated;
    },
    {
      auth: true,
      body: t.Object({
        bankName: t.String(),
        bankAccount: t.String(),
        bankHolder: t.String(),
      }),
    },
  )
  // ==================== WITHDRAWALS ====================
  .get(
    '/withdrawals',
    async ({ user }) => {
      const withdrawals = await db.withdrawal.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: 'desc' },
      });
      return withdrawals;
    },
    { auth: true },
  )
  .post(
    '/withdrawals',
    async ({ user, body }) => {
      const userData = await db.user.findUnique({
        where: { id: user!.id },
        select: {
          walletBalance: true,
          bankName: true,
          bankAccount: true,
          bankHolder: true,
        },
      });

      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      if (!userData.bankName || !userData.bankAccount || !userData.bankHolder) {
        return new Response(
          JSON.stringify({ error: 'Please set up your bank account first' }),
          { status: 400 },
        );
      }

      const minWithdraw = 50000;
      const fee = 2500;

      if (body.amount < minWithdraw) {
        return new Response(
          JSON.stringify({
            error: `Minimum withdrawal is Rp ${minWithdraw.toLocaleString()}`,
          }),
          { status: 400 },
        );
      }

      if (userData.walletBalance < body.amount) {
        return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
          status: 400,
        });
      }

      // Create withdrawal and deduct balance
      const [withdrawal] = await db.$transaction([
        db.withdrawal.create({
          data: {
            userId: user!.id,
            amount: body.amount,
            fee,
            netAmount: body.amount - fee,
            bankName: userData.bankName,
            accountNum: userData.bankAccount,
            accountName: userData.bankHolder,
            status: 'PENDING',
          },
        }),
        db.user.update({
          where: { id: user!.id },
          data: { walletBalance: { decrement: body.amount } },
        }),
      ]);

      return withdrawal;
    },
    {
      auth: true,
      body: t.Object({
        amount: t.Number(),
      }),
    },
  );

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const HEAD = app.fetch;

export type App = typeof app;
