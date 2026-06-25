import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalClasses,
      totalInstructors,
      totalEnrollments,
      activeEnrollments,
      pendingEnrollments,
      newUsersThisWeek,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.class.count(),
      this.prisma.instructorProfile.count({ where: { isActive: true } }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } }),
      this.prisma.enrollment.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          role: 'STUDENT',
        },
      }),
    ]);

    // Get popular classes
    const popularClasses = await this.prisma.class.findMany({
      take: 5,
      orderBy: { currentEnrollment: 'desc' },
      select: { id: true, name: true, type: true, currentEnrollment: true, maxCapacity: true },
    });

    // Recent enrollments
    const recentEnrollments = await this.prisma.enrollment.findMany({
      take: 10,
      orderBy: { enrolledAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        class: { select: { name: true, type: true } },
      },
    });

    return {
      totalUsers,
      totalClasses,
      totalInstructors,
      totalEnrollments,
      activeEnrollments,
      pendingEnrollments,
      newUsersThisWeek,
      popularClasses,
      recentEnrollments,
    };
  }
}
