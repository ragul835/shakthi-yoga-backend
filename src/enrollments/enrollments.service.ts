import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/enrollment.dto';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEnrollmentDto) {
    // Check class exists and is available
    const yogaClass = await this.prisma.class.findUnique({ 
      where: { id: dto.classId }
    });
    if (!yogaClass) throw new NotFoundException('Class not found');
    if (yogaClass.status === 'INACTIVE') throw new BadRequestException('Class is not active');
    if (yogaClass.status === 'FULL') throw new BadRequestException('Class is full');

    // Check if already enrolled
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId: dto.classId } },
    });
    if (existing) throw new ConflictException('You are already enrolled in this class');

    // Check capacity for group classes
    if (yogaClass.type === 'GROUP' && yogaClass.currentEnrollment >= yogaClass.maxCapacity) {
      throw new BadRequestException('Class is full');
    }

    // Handle makeup credit if provided
    let makeupCredit = null;
    if (dto.useMakeupCreditId) {
      const makeupCreditCutoff = new Date();
      makeupCreditCutoff.setDate(makeupCreditCutoff.getDate() - 30);

      makeupCredit = await this.prisma.attendance.findFirst({
        where: {
          id: dto.useMakeupCreditId,
          enrollment: { userId },
          attended: false,
          makeupUsed: false,
          sessionDate: { gte: makeupCreditCutoff },
        },
      });
      if (!makeupCredit) {
        throw new BadRequestException('Makeup credit is invalid, expired, or already used');
      }
    }

    // Determine the meeting link to give the student
    const actualMeetingLink = yogaClass.meetingLink;

    const enrollment = await this.prisma.$transaction(async (tx) => {
      // Reserve capacity atomically. A prior read alone can overbook when two
      // students purchase the final place at the same time.
      const reservation = await tx.class.updateMany({
        where: {
          id: dto.classId,
          status: { notIn: ['INACTIVE', 'FULL'] },
          currentEnrollment: { lt: yogaClass.maxCapacity },
        },
        data: { currentEnrollment: { increment: 1 } },
      });
      if (reservation.count !== 1) {
        throw new BadRequestException('Class is full');
      }

      const createdEnrollment = await tx.enrollment.create({
        data: { 
          userId, 
          classId: dto.classId, 
          status: EnrollmentStatus.APPROVED,
          meetingLink: actualMeetingLink
        },
        include: {
          class: { select: { name: true, type: true, scheduleDay: true, scheduleTime: true } },
        },
      });

      if (makeupCredit) {
        const creditUse = await tx.attendance.updateMany({
          where: {
            id: makeupCredit.id,
            makeupUsed: false,
          },
          data: { makeupUsed: true },
        });
        if (creditUse.count !== 1) {
          throw new BadRequestException(
            'Makeup credit is invalid, expired, or already used',
          );
        }
      }

      return createdEnrollment;
    });

    return enrollment;
  }

  async findUserEnrollments(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { enrolledAt: 'desc' },
        include: {
          class: {
            include: {
              instructor: { include: { user: { select: { name: true } } } },
            },
          },
          // Select only fields used by the dashboard. This keeps enrollment
          // reads compatible during a rolling deployment before newer optional
          // attendance columns have been migrated.
          attendances: {
            select: {
              id: true,
              attended: true,
              sessionDate: true,
            },
          },
        },
      }),
      this.prisma.enrollment.count({ where: { userId } }),
    ]);

    return {
      data: enrollments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(page = 1, limit = 20, status?: EnrollmentStatus, classId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (classId) where.classId = classId;

    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { enrolledAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          class: { select: { id: true, name: true, type: true, scheduleDay: true, scheduleTime: true } },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return {
      data: enrollments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: {
          include: { instructor: { include: { user: { select: { name: true } } } } },
        },
        payment: true,
        attendances: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    const enrollment = await this.findOne(id);

    const data: any = { ...dto };
    if (dto.status === 'APPROVED' || dto.status === 'ACTIVE') {
      data.approvedAt = new Date();
    }

    return this.prisma.enrollment.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async cancel(id: string, userId?: string) {
    const enrollment = await this.findOne(id);

    // If userId provided, check ownership
    if (userId && enrollment.user.id !== userId) {
      throw new BadRequestException('You can only cancel your own enrollments');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.enrollment.update({
        where: { id },
        data: { status: EnrollmentStatus.CANCELLED },
      }),
      this.prisma.class.update({
        where: { id: enrollment.class.id },
        data: { currentEnrollment: { decrement: 1 } },
      }),
    ]);

    return updated;
  }

  async getUpcoming(userId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
      include: {
        class: {
          include: {
            instructor: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
