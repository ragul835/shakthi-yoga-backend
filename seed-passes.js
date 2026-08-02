const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.passOption.upsert({
    where: { name: '3-Class Pass' },
    update: {
      description: 'Valid for any 3 classes. No expiration date!',
      priceUsd: 45,
      totalClasses: 3,
      validityDays: null,
      isActive: true,
    },
    create: {
      name: '3-Class Pass',
      description: 'Valid for any 3 classes. No expiration date!',
      priceUsd: 45,
      totalClasses: 3,
      validityDays: null,
    },
  });
  console.log('Seeded 3-Class Pass.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
