import { Elysia, t } from 'elysia';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'crypto';
import archiver from 'archiver';
import { stat } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { PassThrough, Readable } from 'stream';

import { auth } from '@/lib/auth';
import { enqueueBlastJob } from '@/lib/blast-queue';
import db from '@/lib/db';
import { waManager } from '@/lib/wa-manager';

const MAX_RECIPIENTS_PER_BLAST = 5000;

function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

function parseRecipients(recipients: string[]): string[] {
  const normalized = recipients
    .map(normalizePhoneNumber)
    .filter((phone) => phone.length >= 10);

  return [...new Set(normalized)];
}

type RecipientMetaMap = Record<
  string,
  {
    name?: string;
    [key: string]: unknown;
  }
>;

function parseHHMM(value: string, fallback: { hour: number; minute: number }) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallback;
  }

  return { hour, minute };
}

function isInQuietHours(
  currentDate: Date,
  startTime: string,
  endTime: string,
): boolean {
  const start = parseHHMM(startTime, { hour: 21, minute: 0 });
  const end = parseHHMM(endTime, { hour: 8, minute: 0 });

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function parseOptionalJson(value?: string): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseRecipientsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return parseRecipients(
    value.filter((item): item is string => typeof item === 'string'),
  );
}

function applyTemplateVariables(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

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
  // ==================== PROFILE ====================
  .get(
    '/profile',
    async ({ user }) => {
      const userData = await db.user.findUnique({
        where: { id: user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      });
      return userData;
    },
    { auth: true },
  )
  .patch(
    '/profile',
    async ({ user, body }) => {
      const { name, password } = body;

      const updateData: any = {};
      if (name) updateData.name = name;

      if (password) {
        const hashedPassword = await hashPassword(password);
        const account = await db.account.findFirst({
          where: { userId: user!.id, providerId: 'credential' },
        });

        if (account) {
          await db.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
          });
        } else {
          await db.account.create({
            data: {
              id: randomUUID(),
              userId: user!.id,
              providerId: 'credential',
              accountId: user!.email,
              password: hashedPassword,
            },
          });
        }
      }

      const updatedUser = await db.user.update({
        where: { id: user!.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_PROFILE',
          target: user!.id,
          details: JSON.stringify({
            nameChanged: !!name,
            passwordChanged: !!password,
          }),
        },
      });

      return updatedUser;
    },
    {
      auth: true,
      body: t.Object({
        name: t.Optional(t.String()),
        password: t.Optional(t.String()),
      }),
    },
  )
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
    { role: 'ADMIN' },
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

      // Wait for the first pairing artifact so the client can render immediately
      let settlePairing: (value: {
        qr?: string;
        pairingCode?: string;
        status?: 'CONNECTED';
      }) => void;
      let pairingSettled = false;
      const settleOnce = (value: {
        qr?: string;
        pairingCode?: string;
        status?: 'CONNECTED';
      }) => {
        if (!pairingSettled) {
          pairingSettled = true;
          settlePairing(value);
        }
      };
      const pairingPromise = new Promise<{
        qr?: string;
        pairingCode?: string;
        status?: 'CONNECTED';
      }>((resolve) => {
        settlePairing = resolve;
        setTimeout(() => settleOnce({}), 15000);
      });

      // Connect via WAManager
      await waManager.connect(device.id, {
        phoneNumber,
        usePairingCode,
        onQR: (qr) => {
          qrCode = qr;
          settleOnce({ qr });
        },
        onPairingCode: (code) => {
          pairingCode = code;
          settleOnce({ pairingCode: code });
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
          settleOnce({ status: 'CONNECTED' });
        },
        onDisconnected: async () => {
          await db.device.update({
            where: { id: device.id },
            data: { status: 'DISCONNECTED' },
          });
        },
      });

      const pairingResult = await pairingPromise;

      const waDevice = waManager.getDevice(device.id);

      return {
        deviceId: device.id,
        status: waDevice?.status || 'PAIRING',
        qr: waDevice?.qr || pairingResult.qr || qrCode,
        pairingCode:
          waDevice?.pairingCode || pairingResult.pairingCode || pairingCode,
      };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        phoneNumber: t.String(),
        usePairingCode: t.Optional(t.Boolean()),
      }),
    },
  )
  .get(
    '/devices/:id/status',
    async ({ user, params, query }) => {
      const device = await db.device.findFirst({
        where: { id: params.id, userId: user!.id },
      });
      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not found' }), {
          status: 404,
        });
      }

      let waDevice = waManager.getDevice(device.id);
      const queryParams = query as Record<string, string | undefined>;
      const isResumeRequest =
        queryParams.resume === '1' || queryParams.resume === 'true';
      const resumeMethod = queryParams.method === 'code' ? 'code' : 'qr';
      let resumeQr: string | undefined;
      let resumePairingCode: string | undefined;

      if (
        (!waDevice || waDevice.status === 'DISCONNECTED') &&
        device.status !== 'BANNED'
      ) {
        try {
          let settleResume:
            | ((value: { qr?: string; pairingCode?: string }) => void)
            | undefined;
          let resumeSettled = false;
          const settleResumeOnce = (value: {
            qr?: string;
            pairingCode?: string;
          }) => {
            if (!resumeSettled && settleResume) {
              resumeSettled = true;
              settleResume(value);
            }
          };

          const resumePromise = isResumeRequest
            ? new Promise<{ qr?: string; pairingCode?: string }>((resolve) => {
                settleResume = resolve;
                setTimeout(() => settleResumeOnce({}), 8000);
              })
            : null;

          waDevice = await waManager.connect(device.id, {
            phoneNumber: device.phoneNumber,
            usePairingCode: isResumeRequest && resumeMethod === 'code',
            onQR: (qr) => {
              resumeQr = qr;
              if (isResumeRequest && resumeMethod === 'qr') {
                settleResumeOnce({ qr });
              }
            },
            onPairingCode: (code) => {
              resumePairingCode = code;
              if (isResumeRequest && resumeMethod === 'code') {
                settleResumeOnce({ pairingCode: code });
              }
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

          if (isResumeRequest) {
            if (waDevice?.qr && resumeMethod === 'qr') {
              settleResumeOnce({ qr: waDevice.qr });
            }
            if (waDevice?.pairingCode && resumeMethod === 'code') {
              settleResumeOnce({ pairingCode: waDevice.pairingCode });
            }

            const resumeResult = await resumePromise;
            if (resumeResult?.qr) {
              resumeQr = resumeResult.qr;
            }
            if (resumeResult?.pairingCode) {
              resumePairingCode = resumeResult.pairingCode;
            }

            const stillNoPairingArtifact =
              resumeMethod === 'qr'
                ? !(waDevice?.qr || resumeQr)
                : !(waDevice?.pairingCode || resumePairingCode);

            if (stillNoPairingArtifact && waDevice?.status !== 'CONNECTED') {
              console.warn('[WA] resume fallback: recreate session', {
                deviceId: device.id,
                resumeMethod,
              });

              await waManager.disconnect(device.id, true);

              let settleFallback:
                | ((value: { qr?: string; pairingCode?: string }) => void)
                | undefined;
              let fallbackSettled = false;
              const settleFallbackOnce = (value: {
                qr?: string;
                pairingCode?: string;
              }) => {
                if (!fallbackSettled && settleFallback) {
                  fallbackSettled = true;
                  settleFallback(value);
                }
              };

              const fallbackPromise = new Promise<{
                qr?: string;
                pairingCode?: string;
              }>((resolve) => {
                settleFallback = resolve;
                setTimeout(() => settleFallbackOnce({}), 10000);
              });

              waDevice = await waManager.connect(device.id, {
                phoneNumber: device.phoneNumber,
                usePairingCode: resumeMethod === 'code',
                onQR: (qr) => {
                  resumeQr = qr;
                  if (resumeMethod === 'qr') {
                    settleFallbackOnce({ qr });
                  }
                },
                onPairingCode: (code) => {
                  resumePairingCode = code;
                  if (resumeMethod === 'code') {
                    settleFallbackOnce({ pairingCode: code });
                  }
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

              const fallbackResult = await fallbackPromise;
              if (fallbackResult?.qr) {
                resumeQr = fallbackResult.qr;
              }
              if (fallbackResult?.pairingCode) {
                resumePairingCode = fallbackResult.pairingCode;
              }
            }
          }
        } catch (error) {
          console.error('[WA] failed to resume device session', {
            deviceId: device.id,
            error,
          });
        }
      }

      return {
        id: device.id,
        phoneNumber: device.phoneNumber,
        status: waDevice?.status || device.status,
        qr: waDevice?.qr || resumeQr,
        pairingCode: waDevice?.pairingCode || resumePairingCode,
      };
    },
    { role: 'ADMIN' },
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
    { role: 'ADMIN' },
  )
  // ==================== BLASTS ====================
  .get(
    '/blasts',
    async ({ query }) => {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        db.blastJob.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
            device: {
              select: {
                id: true,
                phoneNumber: true,
                status: true,
              },
            },
          },
        }),
        db.blastJob.count(),
      ]);

      return {
        data,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },
    {
      role: 'ADMIN',
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    '/blasts/:id',
    async ({ params, query }) => {
      const recipientsLimit = Math.min(
        500,
        Math.max(1, Number(query.recipientsLimit) || 100),
      );

      const blast = await db.blastJob.findFirst({
        where: { id: params.id },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          device: {
            select: {
              id: true,
              phoneNumber: true,
              status: true,
            },
          },
          recipients: {
            orderBy: { createdAt: 'asc' },
            take: recipientsLimit,
          },
        },
      });

      if (!blast) {
        return new Response(JSON.stringify({ error: 'Blast job not found' }), {
          status: 404,
        });
      }

      return blast;
    },
    {
      role: 'ADMIN',
      query: t.Object({
        recipientsLimit: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/blasts',
    async ({ user, body }) => {
      let recipients = parseRecipients(body.recipients || []);
      let title = body.title;
      let message = body.message || '';
      let attachmentUrl = body.attachmentUrl;
      let attachmentType = body.attachmentType;
      let campaignType = body.campaignType || 'MARKETING';
      let variablesData = parseOptionalJson(body.variablesData);
      let ctaData = parseOptionalJson(body.ctaData);
      let campaignId: string | null = null;

      if (body.campaignId) {
        const campaign = await db.campaign.findFirst({
          where: {
            id: body.campaignId,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!campaign) {
          return new Response(JSON.stringify({ error: 'Campaign not found' }), {
            status: 404,
          });
        }

        recipients = parseRecipientsFromUnknown(campaign.recipients);
        title = campaign.name;
        message = campaign.message;
        attachmentUrl = campaign.attachmentUrl || undefined;
        attachmentType = campaign.attachmentType || undefined;
        campaignType = campaign.campaignType;
        variablesData = parseOptionalJson(
          campaign.variablesData
            ? JSON.stringify(campaign.variablesData)
            : undefined,
        );
        ctaData = parseOptionalJson(
          campaign.ctaData ? JSON.stringify(campaign.ctaData) : undefined,
        );
        campaignId = campaign.id;
      }

      if (!message.trim()) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
        });
      }

      if (recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Recipient list cannot be empty' }),
          { status: 400 },
        );
      }

      if (recipients.length > MAX_RECIPIENTS_PER_BLAST) {
        return new Response(
          JSON.stringify({
            error: `Maximum ${MAX_RECIPIENTS_PER_BLAST} recipients per blast`,
          }),
          { status: 400 },
        );
      }

      const [quietHourStartSetting, quietHourEndSetting] = await Promise.all([
        db.globalSetting.findUnique({
          where: { key: 'BLAST_QUIET_HOURS_START' },
          select: { value: true },
        }),
        db.globalSetting.findUnique({
          where: { key: 'BLAST_QUIET_HOURS_END' },
          select: { value: true },
        }),
      ]);

      const quietHourStart = quietHourStartSetting?.value || '21:00';
      const quietHourEnd = quietHourEndSetting?.value || '08:00';

      const device = await db.device.findFirst({
        where: { id: body.deviceId },
        select: { id: true, status: true },
      });

      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not found' }), {
          status: 404,
        });
      }

      if (device.status !== 'CONNECTED') {
        return new Response(
          JSON.stringify({ error: 'Device is not connected' }),
          { status: 400 },
        );
      }

      const parsedSchedule = body.scheduleAt ? new Date(body.scheduleAt) : null;
      if (parsedSchedule && Number.isNaN(parsedSchedule.getTime())) {
        return new Response(JSON.stringify({ error: 'Invalid scheduleAt' }), {
          status: 400,
        });
      }

      if (
        !parsedSchedule &&
        isInQuietHours(new Date(), quietHourStart, quietHourEnd)
      ) {
        return new Response(
          JSON.stringify({
            error: 'Saat ini masuk quiet hours. Silakan jadwalkan campaign.',
          }),
          { status: 400 },
        );
      }

      const suppressed = await db.suppressionList.findMany({
        where: {
          OR: [{ userId: user!.id }, { userId: null }],
          phone: { in: recipients },
        },
        select: { phone: true },
      });

      const suppressedPhones = new Set(suppressed.map((item) => item.phone));
      const filteredRecipients = recipients.filter(
        (phone) => !suppressedPhones.has(phone),
      );

      if (filteredRecipients.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Semua recipient masuk suppression list',
          }),
          { status: 400 },
        );
      }

      const templateData = parseOptionalJson(body.templateData);
      const recipientMetaDataRaw = parseOptionalJson(body.recipientMetaData);
      const recipientMetaData =
        (recipientMetaDataRaw as RecipientMetaMap | null) || {};

      const blastJob = await db.blastJob.create({
        data: {
          userId: user!.id,
          deviceId: device.id,
          campaignId,
          title,
          message,
          totalMessages: filteredRecipients.length,
          scheduleAt: parsedSchedule,
          timezone: body.timezone,
          templateName: body.templateName,
          templateData,
          attachmentUrl,
          attachmentType,
          ctaData,
          variablesData,
          campaignType,
          status: 'QUEUED',
        },
      });

      if (campaignId) {
        await db.campaign.update({
          where: { id: campaignId },
          data: { lastBlastedAt: new Date() },
        });
      }

      const recipientRows = filteredRecipients.map((phone) => ({
        recipientName:
          typeof recipientMetaData[phone]?.name === 'string'
            ? recipientMetaData[phone].name
            : null,
        metaData: recipientMetaData[phone] || null,
        jobId: blastJob.id,
        phone,
      }));

      await db.blastRecipient.createMany({
        data: recipientRows,
      });

      const recipientData = await db.blastRecipient.findMany({
        where: { jobId: blastJob.id },
        select: { id: true, phone: true },
        orderBy: { createdAt: 'asc' },
      });

      await enqueueBlastJob(
        blastJob.id,
        device.id,
        recipientData,
        message,
        parsedSchedule || undefined,
      );

      return {
        id: blastJob.id,
        status: 'QUEUED',
        totalMessages: filteredRecipients.length,
        filteredSuppressed: recipients.length - filteredRecipients.length,
        scheduled: Boolean(parsedSchedule),
        scheduleAt: parsedSchedule?.toISOString() || null,
      };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        campaignId: t.Optional(t.String()),
        deviceId: t.String(),
        title: t.Optional(t.String()),
        message: t.Optional(t.String({ minLength: 1 })),
        recipients: t.Optional(t.Array(t.String(), { minItems: 1 })),
        scheduleAt: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        templateName: t.Optional(t.String()),
        templateData: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
        attachmentType: t.Optional(t.String()),
        ctaData: t.Optional(t.String()),
        variablesData: t.Optional(t.String()),
        recipientMetaData: t.Optional(t.String()),
        campaignType: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/blasts/:id/cancel',
    async ({ params }) => {
      const blast = await db.blastJob.findFirst({
        where: { id: params.id },
        select: { id: true, status: true },
      });

      if (!blast) {
        return new Response(JSON.stringify({ error: 'Blast job not found' }), {
          status: 404,
        });
      }

      if (blast.status === 'COMPLETED' || blast.status === 'FAILED') {
        return new Response(
          JSON.stringify({
            error: 'Blast job already finished and cannot be cancelled',
          }),
          { status: 400 },
        );
      }

      await db.blastJob.update({
        where: { id: blast.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      return { success: true };
    },
    { role: 'ADMIN' },
  )
  .post(
    '/blasts/:id/retry-failed',
    async ({ user, params }) => {
      const sourceJob = await db.blastJob.findFirst({
        where: { id: params.id },
        include: {
          recipients: {
            where: { status: 'FAILED' },
            select: {
              phone: true,
              recipientName: true,
              metaData: true,
            },
          },
          device: {
            select: { id: true, status: true },
          },
        },
      });

      if (!sourceJob) {
        return new Response(JSON.stringify({ error: 'Blast job not found' }), {
          status: 404,
        });
      }

      if (sourceJob.recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No failed recipients to retry' }),
          { status: 400 },
        );
      }

      if (sourceJob.device.status !== 'CONNECTED') {
        return new Response(
          JSON.stringify({ error: 'Device is not connected' }),
          { status: 400 },
        );
      }

      const retryJob = await db.blastJob.create({
        data: {
          userId: user!.id,
          deviceId: sourceJob.device.id,
          campaignId: sourceJob.campaignId,
          title: sourceJob.title,
          message: sourceJob.message,
          totalMessages: sourceJob.recipients.length,
          timezone: sourceJob.timezone,
          templateName: sourceJob.templateName,
          templateData: sourceJob.templateData,
          attachmentUrl: sourceJob.attachmentUrl,
          attachmentType: sourceJob.attachmentType,
          ctaData: sourceJob.ctaData,
          variablesData: sourceJob.variablesData,
          campaignType: sourceJob.campaignType,
          status: 'QUEUED',
        },
      });

      await db.blastRecipient.createMany({
        data: sourceJob.recipients.map((recipient) => ({
          jobId: retryJob.id,
          phone: recipient.phone,
          recipientName: recipient.recipientName,
          metaData: recipient.metaData,
        })),
      });

      const retryRecipients = await db.blastRecipient.findMany({
        where: { jobId: retryJob.id },
        select: { id: true, phone: true },
        orderBy: { createdAt: 'asc' },
      });

      await enqueueBlastJob(
        retryJob.id,
        sourceJob.device.id,
        retryRecipients,
        sourceJob.message,
      );

      return {
        id: retryJob.id,
        sourceJobId: sourceJob.id,
        totalMessages: retryRecipients.length,
        status: 'QUEUED',
      };
    },
    { role: 'ADMIN' },
  )
  .get(
    '/blasts/compliance/suppressions',
    async ({ user, query }) => {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
      const skip = (page - 1) * limit;
      const search = (query.search || '').trim();

      const where = {
        userId: user!.id,
        ...(search
          ? {
              OR: [
                { phone: { contains: search, mode: 'insensitive' as const } },
                { reason: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        db.suppressionList.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.suppressionList.count({ where }),
      ]);

      return {
        data,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },
    {
      role: 'ADMIN',
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/blasts/compliance/suppressions',
    async ({ user, body }) => {
      const phone = normalizePhoneNumber(body.phone);
      if (phone.length < 10) {
        return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
          status: 400,
        });
      }

      const entry = await db.suppressionList.upsert({
        where: {
          userId_phone: {
            userId: user!.id,
            phone,
          },
        },
        update: {
          reason: body.reason,
          source: body.source || 'ADMIN',
        },
        create: {
          userId: user!.id,
          phone,
          reason: body.reason,
          source: body.source || 'ADMIN',
        },
      });

      return entry;
    },
    {
      auth: true,
      body: t.Object({
        phone: t.String(),
        reason: t.Optional(t.String()),
        source: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    '/blasts/compliance/suppressions/:id',
    async ({ user, params }) => {
      const record = await db.suppressionList.findFirst({
        where: { id: params.id, userId: user!.id },
        select: { id: true },
      });

      if (!record) {
        return new Response(
          JSON.stringify({ error: 'Suppression record not found' }),
          { status: 404 },
        );
      }

      await db.suppressionList.delete({ where: { id: record.id } });
      return { success: true };
    },
    { role: 'ADMIN' },
  )
  .post(
    '/blasts/preview',
    async ({ body }) => {
      const variables = parseOptionalJson(body.variablesData) || {};
      const rendered = applyTemplateVariables(body.message, variables);

      return {
        message: body.message,
        rendered,
        variables,
      };
    },
    {
      role: 'ADMIN',
      body: t.Object({
        message: t.String(),
        variablesData: t.Optional(t.String()),
      }),
    },
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
  // ==================== ADMIN: CAMPAIGNS ====================
  .get(
    '/admin/campaigns',
    async ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const sortField = query.sortField || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const search = query.search || '';
      const status = query.status || 'all';

      const skip = (page - 1) * limit;

      const where = {
        AND: [
          { deletedAt: null },
          search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  {
                    description: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {},
          status === 'active'
            ? { isActive: true }
            : status === 'inactive'
              ? { isActive: false }
              : {},
        ],
      };

      const [data, total] = await Promise.all([
        db.campaign.findMany({
          skip,
          take: limit,
          where,
          orderBy: { [sortField]: sortOrder },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { blastJobs: true },
            },
          },
        }),
        db.campaign.count({ where }),
      ]);

      return {
        data: data.map((campaign) => ({
          ...campaign,
          blastCount: campaign._count.blastJobs,
          _count: undefined,
        })),
        totalPages: Math.ceil(total / limit),
        total,
      };
    },
    { role: 'ADMIN' },
  )
  .get(
    '/admin/campaigns/options',
    async () => {
      const campaigns = await db.campaign.findMany({
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { blastJobs: true },
          },
        },
      });

      return campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        campaignType: campaign.campaignType,
        recipientCount: parseRecipientsFromUnknown(campaign.recipients).length,
        blastCount: campaign._count.blastJobs,
        lastBlastedAt: campaign.lastBlastedAt,
      }));
    },
    { role: 'ADMIN' },
  )
  .post(
    '/admin/campaigns',
    async ({ body, user }) => {
      const recipients = parseRecipients(body.recipients);

      if (recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Recipient list cannot be empty' }),
          { status: 400 },
        );
      }

      if (recipients.length > MAX_RECIPIENTS_PER_BLAST) {
        return new Response(
          JSON.stringify({
            error: `Maximum ${MAX_RECIPIENTS_PER_BLAST} recipients per campaign`,
          }),
          { status: 400 },
        );
      }

      const variablesData = parseOptionalJson(body.variablesData);
      const ctaData = parseOptionalJson(body.ctaData);

      const campaign = await db.campaign.create({
        data: {
          name: body.name,
          description: body.description,
          message: body.message,
          recipients,
          variablesData,
          ctaData,
          attachmentUrl: body.attachmentUrl,
          attachmentType: body.attachmentType,
          campaignType: body.campaignType || 'MARKETING',
          isActive: body.isActive ?? true,
          createdById: user!.id,
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'CREATE_CAMPAIGN',
          target: campaign.id,
          details: JSON.stringify({
            name: campaign.name,
            recipientCount: recipients.length,
            campaignType: campaign.campaignType,
          }),
        },
      });

      return campaign;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        message: t.String({ minLength: 1 }),
        recipients: t.Array(t.String(), { minItems: 1 }),
        variablesData: t.Optional(t.String()),
        ctaData: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
        attachmentType: t.Optional(t.String()),
        campaignType: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    '/admin/campaigns/:id',
    async ({ params, body, user }) => {
      const campaign = await db.campaign.findFirst({
        where: {
          id: params.id,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { blastJobs: true },
          },
        },
      });

      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
        });
      }

      const hasBlastHistory = campaign._count.blastJobs > 0;
      const touchesSensitiveField =
        body.message !== undefined ||
        body.recipients !== undefined ||
        body.variablesData !== undefined ||
        body.ctaData !== undefined ||
        body.attachmentUrl !== undefined ||
        body.attachmentType !== undefined ||
        body.campaignType !== undefined;

      if (hasBlastHistory && touchesSensitiveField) {
        return new Response(
          JSON.stringify({
            error:
              'Campaign yang sudah dipakai blast hanya bisa diubah nama, deskripsi, dan status aktif.',
          }),
          { status: 400 },
        );
      }

      const updateData: Record<string, unknown> = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      if (!hasBlastHistory) {
        if (body.message !== undefined) updateData.message = body.message;
        if (body.campaignType !== undefined)
          updateData.campaignType = body.campaignType;
        if (body.attachmentUrl !== undefined)
          updateData.attachmentUrl = body.attachmentUrl;
        if (body.attachmentType !== undefined)
          updateData.attachmentType = body.attachmentType;
        if (body.variablesData !== undefined)
          updateData.variablesData = parseOptionalJson(body.variablesData);
        if (body.ctaData !== undefined)
          updateData.ctaData = parseOptionalJson(body.ctaData);
        if (body.recipients !== undefined) {
          const normalizedRecipients = parseRecipients(body.recipients);
          if (normalizedRecipients.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Recipient list cannot be empty' }),
              { status: 400 },
            );
          }

          if (normalizedRecipients.length > MAX_RECIPIENTS_PER_BLAST) {
            return new Response(
              JSON.stringify({
                error: `Maximum ${MAX_RECIPIENTS_PER_BLAST} recipients per campaign`,
              }),
              { status: 400 },
            );
          }

          updateData.recipients = normalizedRecipients;
        }
      }

      const updated = await db.campaign.update({
        where: { id: campaign.id },
        data: updateData,
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_CAMPAIGN',
          target: campaign.id,
          details: JSON.stringify({
            hasBlastHistory,
            fields: Object.keys(updateData),
          }),
        },
      });

      return updated;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
        message: t.Optional(t.String({ minLength: 1 })),
        recipients: t.Optional(t.Array(t.String(), { minItems: 1 })),
        variablesData: t.Optional(t.String()),
        ctaData: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
        attachmentType: t.Optional(t.String()),
        campaignType: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    '/admin/campaigns/:id',
    async ({ params, user }) => {
      const campaign = await db.campaign.findFirst({
        where: {
          id: params.id,
          deletedAt: null,
        },
      });

      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
        });
      }

      await db.campaign.update({
        where: { id: campaign.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'DELETE_CAMPAIGN',
          target: campaign.id,
          details: JSON.stringify({ name: campaign.name }),
        },
      });

      return { success: true };
    },
    { role: 'ADMIN' },
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

      await db.user.update({
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
  .post(
    '/admin/users',
    async ({ body, user }) => {
      const { name, email, password, role } = body;

      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), {
          status: 400,
        });
      }

      const hashedPassword = await hashPassword(password);
      const userId = randomUUID();

      const newUser = await db.user.create({
        data: {
          id: userId,
          name,
          email,
          role: role as 'USER' | 'STAFF' | 'ADMIN',
          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          walletBalance: 0,
          status: 'ACTIVE',
          accounts: {
            create: {
              id: randomUUID(),
              providerId: 'credential',
              accountId: email,
              password: hashedPassword,
            },
          },
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'CREATE_USER',
          target: newUser.id,
          details: JSON.stringify({ name, email, role }),
        },
      });

      return newUser;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.String(),
        email: t.String(),
        password: t.String(),
        role: t.Union([
          t.Literal('USER'),
          t.Literal('STAFF'),
          t.Literal('ADMIN'),
        ]),
      }),
    },
  )
  .patch(
    '/admin/users/:id',
    async ({ params, body, user }) => {
      const { name, email, password, role } = body;

      const existingUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;

      if (password) {
        const hashedPassword = await hashPassword(password);
        const account = await db.account.findFirst({
          where: { userId: params.id, providerId: 'credential' },
        });

        if (account) {
          await db.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
          });
        } else {
          await db.account.create({
            data: {
              id: randomUUID(),
              userId: params.id,
              providerId: 'credential',
              accountId: email || existingUser.email,
              password: hashedPassword,
            },
          });
        }
      }

      const updatedUser = await db.user.update({
        where: { id: params.id },
        data: updateData,
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_USER',
          target: params.id,
          details: JSON.stringify({
            name,
            email,
            role,
            passwordChanged: !!password,
          }),
        },
      });

      return updatedUser;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        password: t.Optional(t.String()),
        role: t.Optional(
          t.Union([t.Literal('USER'), t.Literal('STAFF'), t.Literal('ADMIN')]),
        ),
      }),
    },
  )
  .delete(
    '/admin/users/:id',
    async ({ params, user }) => {
      const targetUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      const newStatus = 'BANNED';

      await db.user.update({
        where: { id: params.id },
        data: { status: newStatus },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'DELETE_USER',
          target: params.id,
          details: JSON.stringify({
            email: targetUser.email,
            note: 'Soft deleted (BANNED)',
          }),
        },
      });

      return { success: true, status: newStatus };
    },
    { role: 'ADMIN' },
  )
  .post(
    '/admin/users',
    async ({ body, user }) => {
      const { name, email, password, role } = body;

      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), {
          status: 400,
        });
      }

      const hashedPassword = await hashPassword(password);

      const newUser = await db.user.create({
        data: {
          name,
          email,
          role: role as 'USER' | 'STAFF' | 'ADMIN',
          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          walletBalance: 0,
          status: 'ACTIVE',
          accounts: {
            create: {
              providerId: 'credential',
              accountId: email,
              password: hashedPassword,
            },
          },
        },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'CREATE_USER',
          target: newUser.id,
          details: JSON.stringify({ name, email, role }),
        },
      });

      return newUser;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.String(),
        email: t.String(),
        password: t.String(),
        role: t.Union([
          t.Literal('USER'),
          t.Literal('STAFF'),
          t.Literal('ADMIN'),
        ]),
      }),
    },
  )
  .patch(
    '/admin/users/:id',
    async ({ params, body, user }) => {
      const { name, email, password, role } = body;

      const existingUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;

      if (password) {
        const hashedPassword = await hashPassword(password);
        const account = await db.account.findFirst({
          where: { userId: params.id, providerId: 'credential' },
        });

        if (account) {
          await db.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
          });
        } else {
          await db.account.create({
            data: {
              userId: params.id,
              providerId: 'credential',
              accountId: email || existingUser.email,
              password: hashedPassword,
            },
          });
        }
      }

      const updatedUser = await db.user.update({
        where: { id: params.id },
        data: updateData,
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'UPDATE_USER',
          target: params.id,
          details: JSON.stringify({
            name,
            email,
            role,
            passwordChanged: !!password,
          }),
        },
      });

      return updatedUser;
    },
    {
      role: 'ADMIN',
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        password: t.Optional(t.String()),
        role: t.Optional(
          t.Union([t.Literal('USER'), t.Literal('STAFF'), t.Literal('ADMIN')]),
        ),
      }),
    },
  )
  .delete(
    '/admin/users/:id',
    async ({ params, user }) => {
      const targetUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
        });
      }

      const newStatus = 'BANNED';

      await db.user.update({
        where: { id: params.id },
        data: { status: newStatus },
      });

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'DELETE_USER',
          target: params.id,
          details: JSON.stringify({
            email: targetUser.email,
            note: 'Soft deleted (BANNED)',
          }),
        },
      });

      return { success: true, status: newStatus };
    },
    { role: 'ADMIN' },
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
  .get(
    '/admin/devices/export',
    async ({ query }) => {
      const sortField = query.sortField || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const status = query.status || undefined;
      const search = query.search || '';
      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const where = {
        AND: [
          search
            ? {
                user: {
                  OR: [
                    {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                    {
                      email: { contains: search, mode: 'insensitive' as const },
                    },
                  ],
                },
              }
            : {},
          status
            ? {
                status: status as
                  | 'CONNECTED'
                  | 'DISCONNECTED'
                  | 'PAIRING'
                  | 'BANNED',
              }
            : {},
          startDate ? { createdAt: { gte: startDate } } : {},
          endDate ? { createdAt: { lte: endDate } } : {},
        ],
      };

      const devices = await db.device.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const csvRows = [
        [
          'ID',
          'User Name',
          'User Email',
          'Phone Number',
          'Session Name',
          'Status',
          'Total Blast',
          'Total Success',
          'Total Failed',
          'Connected At',
          'Created At',
        ].join(','),
      ];

      for (const d of devices) {
        csvRows.push(
          [
            d.id,
            `"${d.user.name}"`,
            d.user.email,
            d.phoneNumber,
            d.sessionName,
            d.status,
            d.totalBlast,
            d.totalSuccess,
            d.totalFailed,
            d.connectedAt ? d.connectedAt.toISOString() : '',
            d.createdAt.toISOString(),
          ].join(','),
        );
      }

      const csvContent = csvRows.join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="devices-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    },
    { role: 'ADMIN' },
  )
  .get(
    '/admin/devices/sessions/export',
    async ({ user }) => {
      const sessionsRoot = join(process.cwd(), 'storages', 'wa-sessions');
      const sessionsRootPrefix = `${resolve(sessionsRoot)}${sep}`;

      const devices = await db.device.findMany({
        select: {
          id: true,
        },
      });

      const output = new PassThrough();
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      const exportedDeviceIds: string[] = [];
      const missingDeviceIds: string[] = [];

      archive.on('warning', (error: Error & { code?: string }) => {
        if (error.code !== 'ENOENT') {
          output.destroy(error);
        }
      });

      archive.on('error', (error: Error) => {
        output.destroy(error);
      });

      archive.pipe(output);

      for (const device of devices) {
        const sessionPath = resolve(sessionsRoot, device.id);

        if (!sessionPath.startsWith(sessionsRootPrefix)) {
          missingDeviceIds.push(device.id);
          continue;
        }

        const sessionStats = await stat(sessionPath).catch(() => null);

        if (!sessionStats?.isDirectory()) {
          missingDeviceIds.push(device.id);
          continue;
        }

        archive.directory(sessionPath, device.id);
        exportedDeviceIds.push(device.id);
      }

      archive.append(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            totalDevices: devices.length,
            exportedCount: exportedDeviceIds.length,
            missingCount: missingDeviceIds.length,
            missingDeviceIds,
          },
          null,
          2,
        ),
        { name: 'manifest.json' },
      );

      await db.auditLog.create({
        data: {
          adminId: user!.id,
          action: 'EXPORT_WA_SESSIONS_ZIP',
          target: 'system',
          details: JSON.stringify({
            totalDevices: devices.length,
            exportedCount: exportedDeviceIds.length,
            missingCount: missingDeviceIds.length,
          }),
        },
      });

      void archive.finalize();

      const fileDate = new Date().toISOString().split('T')[0];

      return new Response(Readable.toWeb(output) as ReadableStream, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="wa-sessions-${fileDate}.zip"`,
          'Cache-Control': 'no-store',
        },
      });
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
