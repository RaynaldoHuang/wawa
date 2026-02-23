import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from './redis';
import { waManager } from './wa-manager';
import db from './db';

// Queue name
const BLAST_QUEUE = 'blast-queue';

// Rate limiting configuration
const RATE_LIMIT = {
  max: 30, // Max jobs per time window
  duration: 60 * 1000, // 1 minute
};

// Job data interface
export interface BlastJobData {
  jobId: string;
  deviceId: string;
  recipientPhone: string;
  message: string;
  recipientId: string;
}

function applyTemplateVariables(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function markJobAsProcessing(jobId: string): Promise<void> {
  await db.blastJob.updateMany({
    where: {
      id: jobId,
      status: 'QUEUED',
    },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  });
}

async function finalizeBlastJob(jobId: string): Promise<void> {
  const blastJob = await db.blastJob.findUnique({
    where: { id: jobId },
    select: {
      totalMessages: true,
      sentCount: true,
      failedCount: true,
      status: true,
    },
  });

  if (!blastJob) return;

  if (blastJob.status === 'CANCELLED' || blastJob.status === 'COMPLETED') {
    return;
  }

  const processedCount = blastJob.sentCount + blastJob.failedCount;
  if (processedCount < blastJob.totalMessages) {
    return;
  }

  await db.blastJob.update({
    where: { id: jobId },
    data: {
      status: blastJob.failedCount > 0 ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

// Create the blast queue
export const blastQueue = new Queue<BlastJobData>(BLAST_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Create the worker to process jobs
export const blastWorker = new Worker<BlastJobData>(
  BLAST_QUEUE,
  async (job: Job<BlastJobData>) => {
    const { deviceId, recipientPhone, message, recipientId, jobId } = job.data;

    await markJobAsProcessing(jobId);

    const blastJob = await db.blastJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (!blastJob || blastJob.status === 'CANCELLED') {
      await db.$transaction([
        db.blastRecipient.update({
          where: { id: recipientId },
          data: {
            status: 'FAILED',
            errorMsg: 'BLAST_CANCELLED',
          },
        }),
        db.blastJob.update({
          where: { id: jobId },
          data: { failedCount: { increment: 1 } },
        }),
      ]);
      await finalizeBlastJob(jobId);
      return { success: false, error: 'BLAST_CANCELLED' };
    }

    const [recipient, blastJobMeta] = await Promise.all([
      db.blastRecipient.findUnique({
        where: { id: recipientId },
        select: {
          recipientName: true,
          metaData: true,
        },
      }),
      db.blastJob.findUnique({
        where: { id: jobId },
        select: {
          attachmentUrl: true,
          attachmentType: true,
          ctaData: true,
          variablesData: true,
        },
      }),
    ]);

    const globalVariables = toObject(blastJobMeta?.variablesData);
    const recipientVariables = toObject(recipient?.metaData);
    const variables = {
      ...globalVariables,
      ...recipientVariables,
      phone: recipientPhone,
      recipientPhone,
      name:
        (recipientVariables.name as string | undefined) ||
        recipient?.recipientName ||
        '',
    };

    const renderedMessage = applyTemplateVariables(message, variables);
    const ctaData = toObject(blastJobMeta?.ctaData);

    // Send the message
    const result = await waManager.sendMessage(
      deviceId,
      recipientPhone,
      renderedMessage,
      {
        attachmentUrl: blastJobMeta?.attachmentUrl || undefined,
        attachmentType:
          blastJobMeta?.attachmentType === 'video' ||
          blastJobMeta?.attachmentType === 'document' ||
          blastJobMeta?.attachmentType === 'image'
            ? blastJobMeta.attachmentType
            : undefined,
        ctaLabel:
          typeof ctaData.label === 'string'
            ? ctaData.label
            : typeof ctaData.text === 'string'
              ? ctaData.text
              : undefined,
        ctaUrl: typeof ctaData.url === 'string' ? ctaData.url : undefined,
      },
    );

    // Update recipient status
    await db.blastRecipient.update({
      where: { id: recipientId },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        renderedMessage,
        sentAt: result.success ? new Date() : null,
        errorMsg: result.error || null,
      },
    });

    // Update blast job and device counters
    if (result.success) {
      await db.$transaction([
        db.blastJob.update({
          where: { id: jobId },
          data: { sentCount: { increment: 1 } },
        }),
        db.device.update({
          where: { id: deviceId },
          data: {
            totalBlast: { increment: 1 },
            totalSuccess: { increment: 1 },
            lastActiveAt: new Date(),
          },
        }),
      ]);

      // Add commission to user wallet (e.g., Rp 25 per message)
      const device = await db.device.findUnique({
        where: { id: deviceId },
        select: { userId: true },
      });

      if (device) {
        await db.user.update({
          where: { id: device.userId },
          data: { walletBalance: { increment: 25 } },
        });
      }

      await finalizeBlastJob(jobId);
    } else {
      await db.$transaction([
        db.blastJob.update({
          where: { id: jobId },
          data: { failedCount: { increment: 1 } },
        }),
        db.device.update({
          where: { id: deviceId },
          data: {
            totalFailed: { increment: 1 },
            lastActiveAt: new Date(),
          },
        }),
      ]);

      await finalizeBlastJob(jobId);

      throw new Error(result.error);
    }

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one at a time per worker
    limiter: RATE_LIMIT,
  },
);

// Event handlers
blastWorker.on('completed', (job) => {
  console.log(`Blast job ${job.id} completed`);
});

blastWorker.on('failed', (job, err) => {
  console.error(`Blast job ${job?.id} failed:`, err.message);
});

/**
 * Add messages to the blast queue
 */
export async function enqueueBlastJob(
  blastJobId: string,
  deviceId: string,
  recipients: { id: string; phone: string }[],
  message: string,
  scheduledAt?: Date,
): Promise<void> {
  const nowMs = Date.now();
  const scheduledDelayMs = scheduledAt
    ? Math.max(0, scheduledAt.getTime() - nowMs)
    : 0;

  const jobs = recipients.map((recipient, index) => ({
    name: `blast-${blastJobId}-${index}`,
    data: {
      jobId: blastJobId,
      deviceId,
      recipientPhone: recipient.phone,
      message,
      recipientId: recipient.id,
    } as BlastJobData,
    opts: {
      delay:
        scheduledDelayMs +
        index * waManager.getMessageDelay() +
        Math.floor(Math.random() * 1000),
    },
  }));

  await blastQueue.addBulk(jobs);
}
