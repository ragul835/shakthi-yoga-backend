const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear existing passes to keep it clean
  await prisma.passOption.deleteMany({});
  
  await prisma.passOption.create({
    data: {
      name: '3-Class Pass',
      description: 'Valid for any 3 classes. No expiration date!',
      priceUsd: 45.00,
      totalClasses: 3,
      validityDays: null, // No expiry
    }
  });
  console.log('Seeded 3-Class Pass.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
