import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/attendance.dto';
import { getMakeupCreditWindow } from './makeup-credit';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async markAttendance(markedById: string, dto: MarkAttendanceDto) {
    const sessionDate = new Date(dto.sessionDate);
    if (Number.isNaN(sessionDate.getTime())) {
      throw new BadRequestException('Invalid attendance session date');
    }

    const enrollmentIds = [
      ...new Set(dto.records.map((record) => record.enrollmentId)),
    ];
    if (enrollmentIds.length !== dto.records.length) {
      throw new BadRequestException(
        'Duplicate students are not allowed in an attendance submission',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.attendanceSession.create({
            data: { classId: dto.classId, sessionDate },
          });

          const enrollments = await tx.enrollment.findMany({
            where: { id: { in: enrollmentIds }, classId: dto.classId },
            select: { id: true, userId: true, userPassId: true },
          });
          if (enrollments.length !== enrollmentIds.length) {
            throw new BadRequestException(
              'One or more students are not enrolled in the selected class',
            );
          }

          const enrollmentUsers = new Map(
            enrollments.map((enrollment) => [enrollment.id, enrollment.userId]),
          );
          const enrollmentPasses = new Map(
            enrollments.map((enrollment) => [
              enrollment.id,
              enrollment.userPassId,
            ]),
          );
          const savedAttendance = [];

          for (const record of dto.records) {
            const reservedPassId =
              enrollmentPasses.get(record.enrollmentId) ?? null;
            let userPassId = reservedPassId;

            // A transition to Present consumes one eligible class exactly once.
            if (record.attended && !reservedPassId) {
              const userId = enrollmentUsers.get(record.enrollmentId)!;
              const now = new Date();
              const activePass = await tx.userPass.findFirst({
                where: {
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
                orderBy: [
                  { expiresAt: { sort: 'asc', nulls: 'last' } },
                  { createdAt: 'asc' },
                ],
              });

              if (activePass?.remainingClasses != null) {
                const consumed = await tx.userPass.updateMany({
                  where: {
                    id: activePass.id,
                    isActive: true,
                    remainingClasses: { gt: 0 },
                  },
                  data: {
                    remainingClasses: { decrement: 1 },
                    ...(activePass.remainingClasses === 1
                      ? { isActive: false }
                      : {}),
                  },
                });
                if (consumed.count !== 1) {
                  throw new ConflictException(
                    'The student pass changed while attendance was being saved. Please retry.',
                  );
                }
              }
              userPassId = activePass?.id ?? null;
            }

            savedAttendance.push(
              await tx.attendance.create({
                data: {
                  enrollmentId: record.enrollmentId,
                  classId: dto.classId,
                  sessionDate,
                  attended: record.attended,
                  markedById,
                  userPassId,
                },
              }),
            );
          }

          return savedAttendance;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Attendance has already been submitted for this class and session date',
        );
      }
      throw error;
    }
  }

  async getClassAttendance(classId: string, sessionDate?: string) {
    const where: any = { classId };
    if (sessionDate) where.sessionDate = new Date(sessionDate);

    return this.prisma.attendance.findMany({
      where,
      include: {
        enrollment: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { sessionDate: 'desc' },
    });
  }

  async getUserAttendance(userId: string) {
    return this.prisma.attendance.findMany({
      where: { enrollment: { userId } },
      include: {
        class: { select: { id: true, name: true, type: true } },
      },
      orderBy: { sessionDate: 'desc' },
    });
  }

  async getAttendanceStats(userId: string) {
    const [total, attended] = await Promise.all([
      this.prisma.attendance.count({ where: { enrollment: { userId } } }),
      this.prisma.attendance.count({
        where: { enrollment: { userId }, attended: true },
      }),
    ]);

    return {
      total,
      attended,
      missed: total - attended,
      rate: total > 0 ? Math.round((attended / total) * 100) : 0,
    };
  }

  async getMakeupCredits(userId: string) {
    const { startsAt, endsAt } = getMakeupCreditWindow();

    return this.prisma.attendance.findMany({
      where: {
        enrollment: { userId },
        attended: false,
        makeupUsed: false,
        sessionDate: { gte: startsAt, lte: endsAt },
      },
      include: {
        class: { select: { name: true } },
      },
      orderBy: { sessionDate: 'asc' },
    });
  }
}
