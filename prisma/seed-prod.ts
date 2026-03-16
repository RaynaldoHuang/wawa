import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';
import { PrismaClient, Role } from './generated/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Initial Production Seeding...');

  // 1. Initial Global Settings for Production
  // These are core business rules that should be set from day one.
  const initialSettings = [
    {
      key: 'COMMISSION_PER_MSG',
      value: '10', // Default 10 IDR per message
      description:
        'Komisi yang didapatkan user per pesan yang berhasil terkirim',
    },
    {
      key: 'MIN_WITHDRAWAL',
      value: '50000',
      description: 'Batas minimum penarikan saldo (Rp 50.000)',
    },
    {
      key: 'WITHDRAWAL_FEE',
      value: '2500',
      description: 'Biaya administrasi per penarikan dana',
    },
    {
      key: 'MAX_DEVICES_PER_USER',
      value: '3',
      description: 'Maksimum perangkat WhatsApp per user',
    },
  ];

  for (const setting of initialSettings) {
    await prisma.globalSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Global settings initialized');

  // 2. Initial Admin Admin User
  // IMPORTANT: Change these credentials immediately after first login!
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@gudangwa.com';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await hashPassword(adminPassword);

    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        role: Role.ADMIN,
        status: 'ACTIVE',
        referralCode: 'ADMIN_CI',
        accounts: {
          create: {
            providerId: 'credential',
            accountId: adminEmail, // Better-auth standard uses email as provider account id for credentials
            password: passwordHash,
          },
        },
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin user already exists: ${adminEmail}`);
  }

  console.log('🏁 Initial Production Seeding Completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
