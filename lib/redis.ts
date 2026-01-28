import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection for BullMQ
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Helper to create new Redis instances
export const createRedisClient = () =>
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
