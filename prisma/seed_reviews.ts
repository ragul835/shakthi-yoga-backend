import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reviews = [
  {
    studentName: "Indhu Naveen",
    rating: 5,
    content: "I highly recommend Saranya as a yoga instructor. She is knowledgeable , patient, and inspiring instructor who helps to connect our breath to our movement. She closely watches and corrects the postures as needed. I am impressed by her discipline and clarity in her instructions.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Saravanan Sankar",
    rating: 5,
    content: "Saranya is an well trained senior yoga guru in Pleasanton area. She understands the students needs and customizes the program and yoga postures by the need. Her caring follow up after each class to ensure student well being makes her a wonderful teacher.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Pallavi Mishra",
    rating: 5,
    content: "My child attended yoga sessions with Saranya a couple of years ago, and it was such a wonderful experience. She absolutely loved the classes and always looked forward to them. Saranya has a lovely way of connecting with kids, making each session enjoyable.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "anusha natarajan",
    rating: 5,
    content: "Mrs. Saranya is an amazing yoga teacher with a truly personal touch. She genuinely cares about your overall well-being and creates a warm, positive, and calming environment in every session. Her energy and great vibes naturally reflect on her students.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Smitha Honnudike",
    rating: 5,
    content: "Calm, motivating, and incredibly knowledgeable instructor who makes every class welcoming and effective. I've had a wonderful experience learning from Saranya and would absolutely recommend her to others.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Tricia Harvester",
    rating: 5,
    content: "Saranya provided an amazing yoga experience for our daughter. Her thoughtful, creative and kind approach to teaching the kids, made this the highlight of their week.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Liezl Cruz",
    rating: 5,
    content: "We've had Saranya lead yoga sessions at Vintage Hills for the past two years and it's been great! Kids are engaged, she is responsive, and thoughtful about her approach.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "niranjana sreedharan",
    rating: 5,
    content: "After suffering from leg pain and back ache for sometime, I learned yoga at Shakthi yoga and achieved complete relief. Instructor Raji takes extreme care and prioritizing safety while teaching various asanas. Under her instructions I have gained flexibility and stamina in my muscles. I highly recommend her classes.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Priya Raju",
    rating: 5,
    content: "Raji is a very genuine and authentic teacher. She has dedicated time and has acquired her yoga skills by learning from the best and that shows in her teaching. Her classes are very personalized. She takes the time to understand your needs and work with you.",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "Sindhu Manipatti",
    rating: 5,
    content: "Amazing experience with my mentor Saranya. She has the utmost patience when it comes to teaching the right technique. Helped me a lot with my issues . I highly recommend this place :)",
    source: "GOOGLE",
    status: "APPROVED"
  },
  {
    studentName: "shruti Gandhi",
    rating: 5,
    content: "Saranya is a wonderful teacher, and makes yoga fun for kids making them want to learn more. She makes each class worth attending. I would highly recommend Shakti Yoga for young kids.",
    source: "GOOGLE",
    status: "APPROVED"
  }
];

async function main() {
  console.log('Seeding Google Reviews...');
  
  // Clear existing testimonials
  await prisma.testimonial.deleteMany({});
  
  for (const review of reviews) {
    await prisma.testimonial.create({
      data: review as any
    });
    console.log(`Added review from ${review.studentName}`);
  }
  
  console.log('Done seeding Google Reviews!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
