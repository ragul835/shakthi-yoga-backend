import { PrismaClient, Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LEGACY_SEED_ADMIN_EMAIL, SEED_ADMIN_EMAIL } from './seed-config';

const prisma = new PrismaClient();

async function main() {
  const environment = process.env.NODE_ENV ?? 'development';
  if (environment !== 'development') {
    throw new Error(
      `Database seeding is disabled when NODE_ENV=${environment}. ` +
        'Run seeds only against an explicitly configured development database.',
    );
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.user.findUnique({ where: { email: SEED_ADMIN_EMAIL } });
    if (existingAdmin) {
      return tx.user.update({
        where: { id: existingAdmin.id },
        data: { role: Role.ADMIN, emailVerified: true },
      });
    }

    const legacyAdmin = await tx.user.findUnique({ where: { email: LEGACY_SEED_ADMIN_EMAIL } });
    if (legacyAdmin) {
      return tx.user.update({
        where: { id: legacyAdmin.id },
        data: { email: SEED_ADMIN_EMAIL, role: Role.ADMIN, emailVerified: true },
      });
    }

    return tx.user.create({
      data: {
        email: SEED_ADMIN_EMAIL,
        name: 'Admin User',
        passwordHash,
        role: Role.ADMIN,
        emailVerified: true,
      },
    });
  });

  console.log('✅ Successfully seeded admin user:', admin.email);
}

main()
  .catch((e) => {
    // P2021 = table does not exist → migrations have not been applied yet
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2021'
    ) {
      console.error(
        '❌ Seed failed: Database tables do not exist.\n' +
          '   Run migrations first: npx prisma migrate deploy\n' +
          `   (Table missing: ${(e.meta as { table?: string })?.table ?? 'unknown'})`,
      );
    } else {
      console.error('❌ Seed failed:', e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
