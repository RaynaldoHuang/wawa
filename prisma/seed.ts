import { hashPassword } from 'better-auth/crypto';
import {
  PrismaClient,
  Role,
  DeviceStatus,
  WithdrawalStatus,
} from './generated/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Cleanup existing data (optional, create fresh state)
  // Be careful in production, but fine for dev seed
  await prisma.auditLog.deleteMany();
  await prisma.suppressionList.deleteMany();
  await prisma.contactConsent.deleteMany();
  await prisma.blastRecipient.deleteMany();
  await prisma.blastJob.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.device.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.globalSetting.deleteMany();

  console.log('🧹 Cleaned up existing data');

  // 2. Global Settings
  await prisma.globalSetting.createMany({
    data: [
      {
        key: 'COMMISSION_PER_MSG',
        value: '500',
        description: 'Commission earnings per successful message',
      },
      {
        key: 'MIN_WITHDRAWAL',
        value: '50000',
        description: 'Minimum amount required to request withdrawal',
      },
      {
        key: 'WITHDRAWAL_FEE',
        value: '2500',
        description: 'Administrative fee per withdrawal',
      },
      {
        key: 'MAX_DEVICES_PER_USER',
        value: '5',
        description: 'Maximum WhatsApp devices per user',
      },
      {
        key: 'BLAST_QUIET_HOURS_START',
        value: '21:00',
        description: 'Start of quiet hours for marketing blast (local time)',
      },
      {
        key: 'BLAST_QUIET_HOURS_END',
        value: '08:00',
        description: 'End of quiet hours for marketing blast (local time)',
      },
      {
        key: 'BLAST_OPTOUT_KEYWORDS',
        value: 'STOP,UNSUBSCRIBE,BERHENTI',
        description: 'Comma-separated opt-out keywords for suppression flow',
      },
      {
        key: 'BLAST_MAX_RECIPIENTS_PER_JOB',
        value: '5000',
        description: 'Maximum recipients allowed per blast job',
      },
    ],
  });
  console.log('⚙️ Created Global Settings');

  // 3. Admin User
  const passwordHash = await hashPassword('password123');
  const admin = await prisma.user.create({
    data: {
      id: 'admin-user-id',
      name: 'Admin User',
      email: 'admin@wawa.com',
      role: Role.ADMIN,
      status: 'ACTIVE',
      image:
        'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff',
      walletBalance: 0,
      accounts: {
        create: {
          id: 'admin-account-id',
          providerId: 'credential',
          accountId: 'admin-account-id',
          password: passwordHash,
        },
      },
    },
  });
  console.log('👤 Created Admin');

  // 4. Staff Users
  await prisma.user.createMany({
    data: [
      {
        id: 'staff-1',
        name: 'Staff One',
        email: 'staff1@wawa.com',
        role: Role.STAFF,
        status: 'ACTIVE',
        walletBalance: 0,
        image:
          'https://ui-avatars.com/api/?name=Staff+One&background=6b7280&color=fff',
      },
      {
        id: 'staff-2',
        name: 'Staff Two',
        email: 'staff2@wawa.com',
        role: Role.STAFF,
        status: 'ACTIVE',
        walletBalance: 0,
        image:
          'https://ui-avatars.com/api/?name=Staff+Two&background=6b7280&color=fff',
      },
    ],
  });
  console.log('👥 Created Staff Users');

  // 5. Regular Users (with varied data)
  const usersData = [
    {
      name: 'Alice Wonderland',
      email: 'alice@example.com',
      balance: 150000,
      status: 'ACTIVE',
    },
    {
      name: 'Bob Builder',
      email: 'bob@example.com',
      balance: 5000,
      status: 'ACTIVE',
    },
    {
      name: 'Charlie Chaplin',
      email: 'charlie@example.com',
      balance: 750000,
      status: 'BANNED',
    },
    {
      name: 'David Beckham',
      email: 'david@example.com',
      balance: 45000,
      status: 'ACTIVE',
    },
    {
      name: 'Eve Polastri',
      email: 'eve@example.com',
      balance: 250000,
      status: 'ACTIVE',
    },
  ];

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        id: `user-${u.email.split('@')[0]}`,
        name: u.name,
        email: u.email,
        role: Role.USER,
        status: u.status,
        walletBalance: u.balance,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`,
      },
    });

    // Create Devices for ACTIVE users
    if (u.status === 'ACTIVE') {
      const isConnected = Math.random() > 0.3;
      await prisma.device.create({
        data: {
          userId: user.id,
          phoneNumber: `628${Math.floor(Math.random() * 1000000000)}`,
          sessionName: `session-${user.id}`,
          displayName: `${u.name}'s Device`,
          status: isConnected
            ? DeviceStatus.CONNECTED
            : DeviceStatus.DISCONNECTED,
          totalBlast: Math.floor(Math.random() * 1000),
          totalSuccess: Math.floor(Math.random() * 800),
          totalFailed: Math.floor(Math.random() * 200),
          connectedAt: isConnected ? new Date() : null,
        },
      });
    }

    // Create Withdrawals
    if (u.balance > 0 || Math.random() > 0.5) {
      await prisma.withdrawal.create({
        data: {
          userId: user.id,
          amount: 50000,
          fee: 2500,
          netAmount: 47500,
          bankName: 'BCA',
          accountNum: '1234567890',
          accountName: u.name.toUpperCase(),
          status:
            Math.random() > 0.5
              ? WithdrawalStatus.SUCCESS
              : WithdrawalStatus.PENDING,
          processedAt: Math.random() > 0.5 ? new Date() : null,
        },
      });
    }
  }
  console.log('users created');

  // 6. Compliance Seed Data
  await prisma.contactConsent.createMany({
    data: [
      {
        userId: 'user-alice',
        phone: '628123450001',
        source: 'IMPORT',
        notes: 'Imported from legacy CRM',
      },
      {
        userId: 'user-bob',
        phone: '628123450002',
        source: 'FORM',
        notes: 'Landing page opt-in',
      },
    ],
  });

  await prisma.suppressionList.createMany({
    data: [
      {
        userId: 'user-alice',
        phone: '628123459999',
        reason: 'User sent STOP',
        source: 'KEYWORD',
      },
      {
        userId: null,
        phone: '628111111111',
        reason: 'Global blocked recipient',
        source: 'ADMIN',
      },
    ],
  });
  console.log('🛡️ Created Compliance Seed Data');

  // 7. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        adminId: admin.id,
        action: 'UPDATE_COMMISSION',
        target: 'COMMISSION_PER_MSG',
        details: 'Changed from 400 to 500',
      },
      {
        adminId: admin.id,
        action: 'APPROVE_WITHDRAWAL',
        target: 'wd-123',
        details: 'Approved amount 50000',
      },
      {
        adminId: admin.id,
        action: 'BAN_USER',
        target: 'user-charlie',
        details: 'Suspicious activity detected',
      },
    ],
  });
  console.log('📝 Created Audit Logs');

  console.log('✅ Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
