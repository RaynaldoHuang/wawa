import { PrismaClient } from '@/prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prismaSingleton = () => {
  return new PrismaClient({ adapter });
};

declare const globalThis: { db: ReturnType<typeof prismaSingleton> };

const db = globalThis.db ?? prismaSingleton();

export default db;
