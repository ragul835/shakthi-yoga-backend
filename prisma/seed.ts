import { PrismaClient, Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@zenyoga.com' },
    update: {},
    create: {
      email: 'admin@zenyoga.com',
      name: 'Admin User',
      passwordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
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

