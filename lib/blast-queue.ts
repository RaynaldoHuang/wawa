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

    // Send the message
    const result = await waManager.sendMessage(
      deviceId,
      recipientPhone,
      message,
    );

    // Update recipient status
    await db.blastRecipient.update({
      where: { id: recipientId },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
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
): Promise<void> {
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
      delay: index * waManager.getMessageDelay(), // Stagger messages
    },
  }));

  await blastQueue.addBulk(jobs);

  // Update job status to processing
  await db.blastJob.update({
    where: { id: blastJobId },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  });
}
