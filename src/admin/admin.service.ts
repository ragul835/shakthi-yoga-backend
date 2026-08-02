import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SITE_CONTENT_FIELDS, SITE_PAGE_KEYS, SitePageKey, UpdateSiteContentDto } from './dto/site-content.dto';

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
      totalRevenueResult,
      monthlyRevenueResult,
      successfulPayments,
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
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amountUsd: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          OR: [
            { paidAt: { gte: monthStart } },
            { paidAt: null, createdAt: { gte: monthStart } },
          ],
        },
        _sum: { amountUsd: true },
      }),
      this.prisma.payment.count({ where: { status: 'SUCCEEDED' } }),
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
      // Revenue includes settled payments only. Refunded, failed, and pending
      // payments are intentionally excluded from the studio's earned total.
      totalRevenueUsd: Number(totalRevenueResult._sum.amountUsd ?? 0),
      monthlyRevenueUsd: Number(monthlyRevenueResult._sum.amountUsd ?? 0),
      successfulPayments,
      revenueUpdatedAt: now.toISOString(),
      // Lists
      popularClasses,
      recentEnrollments,
      recentMessages,
    };
  }

  async getSiteContent(pageKey: string) {
    this.assertPageKey(pageKey);
    const record = await this.prisma.siteContent.findUnique({
      where: { pageKey_sectionKey: { pageKey, sectionKey: 'main' } },
      select: { pageKey: true, contentJson: true, updatedAt: true },
    });

    if (!record) throw new NotFoundException('No published content exists for this page');
    const parsed = JSON.parse(record.contentJson) as { content?: unknown };
    return {
      pageKey: record.pageKey,
      content: typeof parsed.content === 'string' ? parsed.content : '',
      updatedAt: record.updatedAt,
    };
  }

  async getPublicSiteContent(pageKey: string) {
    this.assertPageKey(pageKey);
    const record = await this.prisma.siteContent.findUnique({
      where: { pageKey_sectionKey: { pageKey, sectionKey: 'main' } },
      select: { pageKey: true, contentJson: true, updatedAt: true },
    });

    if (!record) return { pageKey, content: null, updatedAt: null };
    const parsed = JSON.parse(record.contentJson) as { content?: unknown };
    return {
      pageKey: record.pageKey,
      content: typeof parsed.content === 'string' ? parsed.content : null,
      updatedAt: record.updatedAt,
    };
  }

  async updateSiteContent(pageKey: string, dto: UpdateSiteContentDto, userId: string) {
    this.assertPageKey(pageKey);
    if (dto.pageKey !== pageKey) throw new BadRequestException('Page key does not match the request URL');

    this.validateStructuredContent(pageKey as SitePageKey, dto.content);

    const contentJson = JSON.stringify({ content: dto.content.trim() });
    const record = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.siteContent.upsert({
        where: { pageKey_sectionKey: { pageKey, sectionKey: 'main' } },
        create: { pageKey, sectionKey: 'main', contentJson, updatedById: userId },
        update: { contentJson, updatedById: userId },
        select: { id: true, pageKey: true, updatedAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_SITE_CONTENT',
          entityType: 'SiteContent',
          entityId: saved.id,
          detailsJson: JSON.stringify({ pageKey }),
        },
      });
      return saved;
    });

    return { ...record, content: dto.content.trim() };
  }

  private assertPageKey(pageKey: string) {
    if (!SITE_PAGE_KEYS.includes(pageKey as (typeof SITE_PAGE_KEYS)[number])) {
      throw new BadRequestException('Unsupported site page');
    }
  }

  private validateStructuredContent(pageKey: SitePageKey, content: string) {
    let fields: unknown;
    try {
      fields = JSON.parse(content);
    } catch {
      throw new BadRequestException('Content must use the structured CMS format');
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new BadRequestException('Content must be an object');
    }

    const allowedFields = new Set(SITE_CONTENT_FIELDS[pageKey]);
    for (const [key, value] of Object.entries(fields)) {
      if (!allowedFields.has(key)) throw new BadRequestException(`Unsupported content field: ${key}`);
      if (typeof value !== 'string' || !value.trim() || value.length > 2_000) {
        throw new BadRequestException(`Invalid content field: ${key}`);
      }
      if (key.endsWith('Url')) {
        if (/imageUrl$/i.test(key) && value.startsWith('/')) continue;
        let url: URL;
        try { url = new URL(value); } catch { throw new BadRequestException(`Invalid URL field: ${key}`); }
        if (url.protocol !== 'https:') throw new BadRequestException(`${key} must use HTTPS`);
      }
      if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new BadRequestException('Invalid studio email address');
      }
    }
  }
}
