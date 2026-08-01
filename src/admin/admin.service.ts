import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalStudents,
      totalAdmins,
      totalInstructorUsers,
      totalClasses,
      activeClasses,
      totalInstructorProfiles,
      totalEnrollments,
      activeEnrollments,
      pendingEnrollments,
      cancelledEnrollments,
      completedEnrollments,
      newUsersThisWeek,
      newUsersThisMonth,
      totalContactMessages,
      unreadContactMessages,
      totalTestimonials,
      pendingTestimonials,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      this.prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
      this.prisma.user.count({ where: { role: 'INSTRUCTOR' } }),
      this.prisma.class.count(),
      this.prisma.class.count({ where: { status: 'ACTIVE' } }),
      this.prisma.instructorProfile.count({ where: { isActive: true } }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } }),
      this.prisma.enrollment.count({ where: { status: 'PENDING' } }),
      this.prisma.enrollment.count({ where: { status: 'CANCELLED' } }),
      this.prisma.enrollment.count({ where: { status: 'COMPLETED' } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo }, role: 'STUDENT' } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart }, role: 'STUDENT' } }),
      this.prisma.contactMessage.count(),
      this.prisma.contactMessage.count({ where: { isRead: false } }),
      this.prisma.testimonial.count(),
      this.prisma.testimonial.count({ where: { status: 'PENDING' } }),
    ]);

    // Popular classes
    const popularClasses = await this.prisma.class.findMany({
      take: 5,
      orderBy: { currentEnrollment: 'desc' },
      select: {
        id: true, name: true, type: true,
        currentEnrollment: true, maxCapacity: true,
        scheduleDay: true, scheduleTime: true,
      },
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

    // Recent contact messages
    const recentMessages = await this.prisma.contactMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, subject: true, isRead: true, createdAt: true },
    });

    return {
      // Users
      totalStudents,
      totalAdmins,
      totalInstructorUsers,
      // Classes
      totalClasses,
      activeClasses,
      totalInstructorProfiles,
      // Enrollments
      totalEnrollments,
      activeEnrollments,
      pendingEnrollments,
      cancelledEnrollments,
      completedEnrollments,
      // Growth
      newUsersThisWeek,
      newUsersThisMonth,
      // Engagement
      totalContactMessages,
      unreadContactMessages,
      totalTestimonials,
      pendingTestimonials,
      // Lists
      popularClasses,
      recentEnrollments,
      recentMessages,
    };
  }
}
