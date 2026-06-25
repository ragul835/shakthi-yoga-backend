import { PrismaClient, Role, ExperienceLevel, ClassStatus, ClassType, AgeGroup } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get admin user to be the instructor
  let instructorUser = await prisma.user.findFirst({
    where: { email: 'admin@zenyoga.com' },
    include: { instructorProfile: true }
  });

  if (!instructorUser) {
    console.log("No admin user found. Please run regular seed first.");
    return;
  }

  let instructorId;
  if (!instructorUser.instructorProfile) {
    const profile = await prisma.instructorProfile.create({
      data: {
        userId: instructorUser.id,
        bio: 'Saranya (Raji) is a dedicated yoga instructor.',
      }
    });
    instructorId = profile.id;
  } else {
    instructorId = instructorUser.instructorProfile.id;
  }

  // Disable old classes
  await prisma.class.updateMany({
    data: { status: ClassStatus.INACTIVE }
  });

  // Create new classes
  await prisma.class.create({
    data: {
      name: 'Online Adult 1-hour Class (Weekday)',
      shortDescription: 'Begins on Jan 3rd. Mon/Wed/Fri morning sessions.',
      description: 'Join Saranya for a 1-hour online adult yoga class. Offered on Mondays, Wednesdays, and Fridays with a choice of 5:30 AM or 11:00 AM (PST).',
      scheduleDay: 'Mon/Wed/Fri',
      scheduleTime: '5:30AM / 11:00AM (PST)',
      durationMinutes: 60,
      priceUsd: '60.00',
      maxCapacity: 50,
      experienceLevel: ExperienceLevel.ALL,
      ageGroup: AgeGroup.ADULTS,
      type: ClassType.GROUP,
      status: ClassStatus.ACTIVE,
      instructorId: instructorId,
      meetingLink: 'https://zoom.us/j/sample-weekday'
    }
  });

  await prisma.class.create({
    data: {
      name: 'Online Adult 1-hour Class (Weekend)',
      shortDescription: 'Begins on Jan 3rd. Sat/Sun morning sessions.',
      description: 'Start your weekend right. 1-hour online adult yoga class offered on Saturdays and Sundays at 6:00 AM (PST).',
      scheduleDay: 'Sat/Sun',
      scheduleTime: '6:00AM (PST)',
      durationMinutes: 60,
      priceUsd: '45.00',
      maxCapacity: 50,
      experienceLevel: ExperienceLevel.ALL,
      ageGroup: AgeGroup.ADULTS,
      type: ClassType.GROUP,
      status: ClassStatus.ACTIVE,
      instructorId: instructorId,
      meetingLink: 'https://zoom.us/j/sample-weekend'
    }
  });

  console.log('Successfully seeded new classes!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
