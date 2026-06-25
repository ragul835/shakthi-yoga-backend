import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reviews = [
  {
    studentName: "Swetha Gunnala",
    rating: 5,
    content: "Two years in, this journey has been so much more than just yoga. From trying different classes to mixing in weights and cardio, it's been fun, challenging, and sometimes a little crazy 🤩.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Raji Any",
    rating: 5,
    content: "I have been learning yoga for almost 3 years at Shakthi yoga. Saranya is incredibly knowledgeable offering clear directions, explaining the benefits of each yoga asanas and refined changes that makes every class challenging. I always learn something new.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Gowthami Kollipara",
    rating: 5,
    content: "Saranya is an amazing instructor. She creates such a safe, peaceful space the moment you step onto the mat. Her voice is incredibly soothing, and I really appreciate the focus on mindfulness and breath-work. Her instructions are very clear too.",
    source: "GOOGLE",
    status: "APPROVED"
  }
];

async function main() {
  console.log('Seeding additional Google Reviews...');
  
  for (const review of reviews) {
    await prisma.testimonial.create({
      data: review as any
    });
    console.log(`Added review from ${review.studentName}`);
  }
  
  console.log('Done seeding additional Google Reviews!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
