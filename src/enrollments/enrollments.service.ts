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
      makeupCredit = await this.prisma.attendance.findFirst({
        where: {
          id: dto.useMakeupCreditId,
          enrollment: { userId },
          attended: false,
          makeupUsed: false,
        },
      });
      if (!makeupCredit) {
        throw new BadRequestException('Invalid or already used makeup credit');
      }
    }

    // Determine the meeting link to give the student
    const actualMeetingLink = yogaClass.meetingLink || 'https://zoom.us/j/mock123';

    const transactionOps: any[] = [
      this.prisma.enrollment.create({
        data: { 
          userId, 
          classId: dto.classId, 
          status: EnrollmentStatus.APPROVED,
          meetingLink: actualMeetingLink
        },
        include: {
          class: { select: { name: true, type: true, scheduleDay: true, scheduleTime: true } },
        },
      }),
      this.prisma.class.update({
        where: { id: dto.classId },
        data: { currentEnrollment: { increment: 1 } },
      }),
    ];

    if (makeupCredit) {
      transactionOps.push(
        this.prisma.attendance.update({
          where: { id: makeupCredit.id },
          data: { makeupUsed: true },
        })
      );
    }

    // Create enrollment and update class count
    const [enrollment] = await this.prisma.$transaction(transactionOps);

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
          attendances: true,
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
