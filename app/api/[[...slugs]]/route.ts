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
        const userWithRole = user as typeof user & { role: string };
        if (role && userWithRole.role !== role)
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
  )
  // ==================== ADMIN: USERS ====================
  .get(
    '/admin/users',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const sortField = query.sortField || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const search = query.search || '';
      const role = query.role || undefined;
      const status = query.status || undefined;

      const skip = (page - 1) * limit;

      const where = {
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {},
          role ? { role: role as 'USER' | 'STAFF' | 'ADMIN' } : {},
          status ? { status } : {},
        ],
      };

      const [data, total] = await Promise.all([
        db.user.findMany({
          skip,
          take: limit,
          where,
          orderBy: { [sortField]: sortOrder },
          include: {
            _count: {
              select: { devices: true },
            },
          },
        }),
        db.user.count({ where }),
      ]);

      return {
        data: data.map((user) => ({
          ...user,
          deviceCount: user._count.devices,
          _count: undefined,
        })),
        totalPages: Math.ceil(total / limit),
        total,
      };
    },
    { role: 'ADMIN' },
  )
  .patch(
    '/admin/users/:id/ban',
    async ({ params, user }) => {
      const targetUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      const newStatus = targetUser.status === 'BANNED' ? 'ACTIVE' : 'BANNED';

      const updated = await db.user.update({
        where: { id: params.id },
        data: { status: newStatus },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: newStatus === 'BANNED' ? 'BAN_USER' : 'UNBAN_USER',
          target: params.id,
          details: JSON.stringify({ email: targetUser.email }),
        },
      });

      return { success: true, status: newStatus };
    },
    { role: 'ADMIN' },
  )
  .patch(
    '/admin/users/bulk-ban',
    async ({ body, user }) => {
      const { userIds } = body;

      await db.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: 'BANNED' },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'BULK_BAN_USERS',
          target: userIds.join(','),
          details: JSON.stringify({ count: userIds.length }),
        },
      });

      return { success: true, count: userIds.length };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        userIds: t.Array(t.String()),
      }),
    },
  )
  .patch(
    '/admin/users/:id/role',
    async ({ params, body, user }) => {
      const updated = await db.user.update({
        where: { id: params.id },
        data: { role: body.role },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_USER_ROLE',
          target: params.id,
          details: JSON.stringify({ newRole: body.role }),
        },
      });

      return { success: true, role: updated.role };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        role: t.Union([
          t.Literal('USER'),
          t.Literal('STAFF'),
          t.Literal('ADMIN'),
        ]),
      }),
    },
  )
  // ==================== ADMIN: DEVICES ====================
  .get(
    '/admin/devices',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const sortField = query.sortField || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const status = query.status || undefined;

      const skip = (page - 1) * limit;

      const where = status
        ? {
            status: status as
              | 'CONNECTED'
              | 'DISCONNECTED'
              | 'PAIRING'
              | 'BANNED',
          }
        : {};

      const [data, total] = await Promise.all([
        db.device.findMany({
          skip,
          take: limit,
          where,
          orderBy: { [sortField]: sortOrder },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.device.count({ where }),
      ]);

      return {
        data,
        totalPages: Math.ceil(total / limit),
        total,
      };
    },
    { role: 'ADMIN' },
  )
  .post(
    '/admin/devices/:id/disconnect',
    async ({ params, user }) => {
      const device = await db.device.findUnique({
        where: { id: params.id },
      });

      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not found' }), {
          status: 404,
        });
      }

      // Disconnect via WAManager
      await waManager.disconnect(device.id, false);

      await db.device.update({
        where: { id: params.id },
        data: { status: 'DISCONNECTED' },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'FORCE_DISCONNECT_DEVICE',
          target: params.id,
          details: JSON.stringify({ phoneNumber: device.phoneNumber }),
        },
      });

      return { success: true };
    },
    { role: 'ADMIN' },
  )
  .delete(
    '/admin/sessions/cleanup',
    async ({ user }) => {
      // Get all disconnected devices older than 7 days
      const oldDevices = await db.device.findMany({
        where: {
          status: 'DISCONNECTED',
          updatedAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // Clean up sessions
      for (const device of oldDevices) {
        await waManager.disconnect(device.id, true); // true = delete session files
      }

      const count = oldDevices.length;

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'CLEANUP_JUNK_SESSIONS',
          target: 'system',
          details: JSON.stringify({ cleanedCount: count }),
        },
      });

      return { success: true, cleanedCount: count };
    },
    { role: 'ADMIN' },
  )
  // ==================== ADMIN: WITHDRAWALS ====================
  .get(
    '/admin/withdrawals',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const sortField = query.sortField || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const status = query.status || undefined;
      const pendingOver24h = query.pendingOver24h === 'true';

      const skip = (page - 1) * limit;

      const where = {
        AND: [
          status
            ? {
                status: status as
                  | 'PENDING'
                  | 'PROCESSING'
                  | 'SUCCESS'
                  | 'REJECTED',
              }
            : {},
          pendingOver24h
            ? {
                status: 'PENDING' as const,
                createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              }
            : {},
        ],
      };

      const [data, total] = await Promise.all([
        db.withdrawal.findMany({
          skip,
          take: limit,
          where,
          orderBy: { [sortField]: sortOrder },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.withdrawal.count({ where }),
      ]);

      return {
        data,
        totalPages: Math.ceil(total / limit),
        total,
      };
    },
    { role: 'ADMIN' },
  )
  .patch(
    '/admin/withdrawals/:id/approve',
    async ({ params, user }) => {
      const withdrawal = await db.withdrawal.findUnique({
        where: { id: params.id },
      });

      if (!withdrawal) {
        return new Response(JSON.stringify({ error: 'Withdrawal not found' }), {
          status: 404,
        });
      }

      if (withdrawal.status !== 'PENDING') {
        return new Response(
          JSON.stringify({ error: 'Withdrawal is not pending' }),
          { status: 400 },
        );
      }

      await db.withdrawal.update({
        where: { id: params.id },
        data: { status: 'SUCCESS', processedAt: new Date() },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'APPROVE_WITHDRAWAL',
          target: params.id,
          details: JSON.stringify({
            amount: withdrawal.amount,
            userId: withdrawal.userId,
          }),
        },
      });

      return { success: true };
    },
    { role: 'ADMIN' },
  )
  .patch(
    '/admin/withdrawals/:id/reject',
    async ({ params, body, user }) => {
      const withdrawal = await db.withdrawal.findUnique({
        where: { id: params.id },
        include: { user: true },
      });

      if (!withdrawal) {
        return new Response(JSON.stringify({ error: 'Withdrawal not found' }), {
          status: 404,
        });
      }

      if (withdrawal.status !== 'PENDING') {
        return new Response(
          JSON.stringify({ error: 'Withdrawal is not pending' }),
          { status: 400 },
        );
      }

      // Refund the amount back to user's wallet
      await db.$transaction([
        db.withdrawal.update({
          where: { id: params.id },
          data: {
            status: 'REJECTED',
            note: body.reason,
            processedAt: new Date(),
          },
        }),
        db.user.update({
          where: { id: withdrawal.userId },
          data: { walletBalance: { increment: withdrawal.amount } },
        }),
      ]);

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'REJECT_WITHDRAWAL',
          target: params.id,
          details: JSON.stringify({
            amount: withdrawal.amount,
            userId: withdrawal.userId,
            reason: body.reason,
          }),
        },
      });

      return { success: true };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        reason: t.String(),
      }),
    },
  )
  .patch(
    '/admin/withdrawals/bulk-approve',
    async ({ body, user }) => {
      const { withdrawalIds } = body;

      await db.withdrawal.updateMany({
        where: {
          id: { in: withdrawalIds },
          status: 'PENDING',
        },
        data: { status: 'SUCCESS', processedAt: new Date() },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'BULK_APPROVE_WITHDRAWALS',
          target: withdrawalIds.join(','),
          details: JSON.stringify({ count: withdrawalIds.length }),
        },
      });

      return { success: true, count: withdrawalIds.length };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        withdrawalIds: t.Array(t.String()),
      }),
    },
  )
  // ==================== ADMIN: SETTINGS ====================
  .get(
    '/admin/settings',
    async () => {
      const settings = await db.globalSetting.findMany();
      return settings;
    },
    { role: 'ADMIN' },
  )
  .put(
    '/admin/settings/:key',
    async ({ params, body, user }) => {
      const existing = await db.globalSetting.findUnique({
        where: { key: params.key },
      });

      const oldValue = existing?.value;

      const setting = await db.globalSetting.upsert({
        where: { key: params.key },
        update: { value: body.value, description: body.description },
        create: {
          key: params.key,
          value: body.value,
          description: body.description,
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_SETTING',
          target: params.key,
          details: JSON.stringify({ oldValue, newValue: body.value }),
        },
      });

      return setting;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        value: t.String(),
        description: t.Optional(t.String()),
      }),
    },
  )
  // ==================== ADMIN: AUDIT LOGS ====================
  .get(
    '/admin/audit-logs',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        db.auditLog.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.auditLog.count(),
      ]);

      return {
        data,
        totalPages: Math.ceil(total / limit),
        total,
      };
    },
    { role: 'ADMIN' },
  )
  // ==================== ADMIN: STATS ====================
  .get(
    '/admin/stats',
    async () => {
      const [totalUsers, connectedDevices, pendingWithdrawals, messagesToday] =
        await Promise.all([
          db.user.count(),
          db.device.count({ where: { status: 'CONNECTED' } }),
          db.withdrawal.count({ where: { status: 'PENDING' } }),
          db.blastRecipient.count({
            where: {
              status: 'SENT',
              sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
        ]);

      return {
        totalUsers,
        connectedDevices,
        pendingWithdrawals,
        messagesToday,
      };
    },
    { role: 'ADMIN' },
  );

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const HEAD = app.fetch;

export type App = typeof app;
