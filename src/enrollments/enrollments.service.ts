import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/enrollment.dto';
import { EnrollmentStatus } from '@prisma/client';
import { getMakeupCreditWindow } from '../attendance/makeup-credit';

export function validateEnrollmentStatusChange(
  currentStatus: EnrollmentStatus,
  paymentStatus: string | undefined,
  requestedStatus: EnrollmentStatus | undefined,
) {
  if (!requestedStatus) return;
  const changesAccess = [
    'APPROVED',
    'ACTIVE',
    'REJECTED',
    'CANCELLED',
  ].includes(requestedStatus);
  if (changesAccess && paymentStatus === 'PENDING') {
    throw new ConflictException(
      'Review the pending payment in Bookings & Payments before changing this enrollment',
    );
  }
  if (
    ['REJECTED', 'CANCELLED'].includes(currentStatus) &&
    requestedStatus !== currentStatus
  ) {
    throw new ConflictException(
      'A rejected or cancelled enrollment cannot be reactivated',
    );
  }
}

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEnrollmentDto) {
    if (Boolean(dto.useMakeupCreditId) === Boolean(dto.userPassId)) {
      throw new BadRequestException(
        'Select exactly one active class pass or makeup credit',
      );
    }
    // Check class exists and is available
    const yogaClass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });
    if (!yogaClass) throw new NotFoundException('Class not found');
    if (yogaClass.status === 'INACTIVE')
      throw new BadRequestException('Class is not active');
    if (yogaClass.status === 'FULL')
      throw new BadRequestException('Class is full');

    // Check if already enrolled
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId: dto.classId } },
    });
    if (existing)
      throw new ConflictException('You are already enrolled in this class');

    // Check capacity for group classes
    if (
      yogaClass.type === 'GROUP' &&
      yogaClass.currentEnrollment >= yogaClass.maxCapacity
    ) {
      throw new BadRequestException('Class is full');
    }

    // Determine the meeting link to give the student
    const actualMeetingLink = yogaClass.meetingLink;

    const enrollment = await this.prisma.$transaction(
      async (tx) => {
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

        let selectedPass: {
          id: string;
          remainingClasses: number | null;
        } | null = null;
        if (dto.userPassId) {
          const now = new Date();
          selectedPass = await tx.userPass.findFirst({
            where: {
              id: dto.userPassId,
              userId,
              isActive: true,
              AND: [
                { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
                {
                  OR: [
                    { remainingClasses: null },
                    { remainingClasses: { gt: 0 } },
                  ],
                },
              ],
            },
            select: { id: true, remainingClasses: true },
          });
          if (!selectedPass) {
            throw new BadRequestException(
              'This class pass is expired, inactive, depleted, or unavailable',
            );
          }

          if (selectedPass.remainingClasses != null) {
            const consumed = await tx.userPass.updateMany({
              where: {
                id: selectedPass.id,
                userId,
                isActive: true,
                remainingClasses: { gt: 0 },
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
              data: {
                remainingClasses: { decrement: 1 },
                ...(selectedPass.remainingClasses === 1
                  ? { isActive: false }
                  : {}),
              },
            });
            if (consumed.count !== 1) {
              throw new ConflictException(
                'The class pass changed while booking. Please retry.',
              );
            }
          }
        }

        const createdEnrollment = await tx.enrollment.create({
          data: {
            userId,
            classId: dto.classId,
            status: EnrollmentStatus.APPROVED,
            meetingLink: actualMeetingLink,
            userPassId: selectedPass?.id,
            makeupCreditId: dto.useMakeupCreditId,
            approvedAt: new Date(),
          },
          include: {
            class: {
              select: {
                name: true,
                type: true,
                scheduleDay: true,
                scheduleTime: true,
              },
            },
          },
        });

        if (dto.useMakeupCreditId) {
          const { startsAt, endsAt } = getMakeupCreditWindow();
          const creditUse = await tx.attendance.updateMany({
            where: {
              id: dto.useMakeupCreditId,
              enrollment: { userId },
              attended: false,
              makeupUsed: false,
              sessionDate: { gte: startsAt, lte: endsAt },
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
      },
      { isolationLevel: 'Serializable' },
    );

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
          payment: {
            select: { id: true, status: true, receiptUrl: true },
          },
        },
      }),
      this.prisma.enrollment.count({ where: { userId } }),
    ]);

    const accessControlledEnrollments = enrollments.map((enrollment) => {
      const accessApproved =
        enrollment.status === 'APPROVED' || enrollment.status === 'ACTIVE';
      return {
        ...enrollment,
        meetingLink: accessApproved ? enrollment.meetingLink : null,
        payment:
          accessApproved && enrollment.payment?.status === 'SUCCEEDED'
            ? enrollment.payment
            : null,
        class: {
          ...enrollment.class,
          meetingLink: accessApproved ? enrollment.class.meetingLink : null,
        },
      };
    });

    return {
      data: accessControlledEnrollments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(
    page = 1,
    limit = 20,
    status?: EnrollmentStatus,
    classId?: string,
  ) {
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
          class: {
            select: {
              id: true,
              name: true,
              type: true,
              scheduleDay: true,
              scheduleTime: true,
            },
          },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    const typedEnrollments = enrollments.map((enrollment) => ({
      ...enrollment,
      bookingType: enrollment.makeupCreditId
        ? ('MAKEUP_CLASS' as const)
        : enrollment.userPassId
          ? ('CLASS_PASS' as const)
          : ('STANDARD' as const),
    }));

    return {
      data: typedEnrollments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: {
          include: {
            instructor: { include: { user: { select: { name: true } } } },
          },
        },
        payment: true,
        attendances: true,
        userPass: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    const enrollment = await this.findOne(id);

    validateEnrollmentStatusChange(
      enrollment.status,
      enrollment.payment?.status,
      dto.status,
    );

    const data: any = { ...dto };
    if (dto.status === 'APPROVED' || dto.status === 'ACTIVE') {
      data.approvedAt = new Date();
      data.meetingLink = enrollment.class.meetingLink;
    }
    if (dto.status === 'REJECTED' || dto.status === 'CANCELLED')
      data.meetingLink = null;

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.enrollment.update({
          where: { id },
          data,
          include: {
            user: { select: { id: true, name: true, email: true } },
            class: { select: { id: true, name: true, type: true } },
          },
        });

        if (
          (dto.status === 'REJECTED' || dto.status === 'CANCELLED') &&
          enrollment.status !== EnrollmentStatus.REJECTED &&
          enrollment.status !== EnrollmentStatus.CANCELLED
        ) {
          await tx.class.updateMany({
            where: { id: enrollment.class.id, currentEnrollment: { gt: 0 } },
            data: { currentEnrollment: { decrement: 1 } },
          });
          if (enrollment.makeupCreditId) {
            await tx.attendance.updateMany({
              where: { id: enrollment.makeupCreditId, makeupUsed: true },
              data: { makeupUsed: false },
            });
          }
          if (
            enrollment.userPassId &&
            enrollment.userPass?.remainingClasses != null
          ) {
            const isUnexpired =
              enrollment.userPass.expiresAt == null ||
              enrollment.userPass.expiresAt >= new Date();
            await tx.userPass.update({
              where: { id: enrollment.userPassId },
              data: {
                remainingClasses: { increment: 1 },
                ...(isUnexpired ? { isActive: true } : {}),
              },
            });
          }
        }

        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async cancel(id: string, userId?: string) {
    const enrollment = await this.findOne(id);

    // If userId provided, check ownership
    if (userId && enrollment.user.id !== userId) {
      throw new BadRequestException('You can only cancel your own enrollments');
    }

    if (enrollment.status === EnrollmentStatus.CANCELLED) return enrollment;
    if (enrollment.attendances.some((attendance) => attendance.attended)) {
      throw new BadRequestException('An attended class cannot be cancelled');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.enrollment.update({
          where: { id },
          data: { status: EnrollmentStatus.CANCELLED, meetingLink: null },
        });
        await tx.class.updateMany({
          where: { id: enrollment.class.id, currentEnrollment: { gt: 0 } },
          data: { currentEnrollment: { decrement: 1 } },
        });

        if (
          enrollment.userPassId &&
          enrollment.userPass?.remainingClasses != null
        ) {
          const isUnexpired =
            enrollment.userPass.expiresAt == null ||
            enrollment.userPass.expiresAt >= new Date();
          await tx.userPass.update({
            where: { id: enrollment.userPassId },
            data: {
              remainingClasses: { increment: 1 },
              ...(isUnexpired ? { isActive: true } : {}),
            },
          });
        }

        if (enrollment.makeupCreditId) {
          await tx.attendance.updateMany({
            where: { id: enrollment.makeupCreditId, makeupUsed: true },
            data: { makeupUsed: false },
          });
        }

        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
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
