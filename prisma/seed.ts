import { PrismaClient, Role } from '@prisma/client';
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

  console.log('Successfully seeded admin user:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
