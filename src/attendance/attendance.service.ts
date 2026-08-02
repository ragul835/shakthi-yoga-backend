import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/attendance.dto';
import { assertAttendanceCheckInWindow } from './attendance-time';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async markAttendance(markedById: string, dto: MarkAttendanceDto) {
    const results = [];
    for (const record of dto.records) {
      const attendance = await this.prisma.attendance.upsert({
        where: {
          enrollmentId_sessionDate: {
            enrollmentId: record.enrollmentId,
            sessionDate: new Date(dto.sessionDate),
          },
        },
        create: {
          enrollmentId: record.enrollmentId,
          classId: dto.classId,
          sessionDate: new Date(dto.sessionDate),
          attended: record.attended,
          markedById,
        },
        update: {
          attended: record.attended,
          markedById,
        },
      });
      results.push(attendance);
    }
    return results;
  }

  async selfMarkAttendance(userId: string, enrollmentId: string, classId: string) {
    // Verify enrollment belongs to user
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, userId, classId },
      include: {
        class: {
          select: {
            scheduleDay: true,
            scheduleTime: true,
            durationMinutes: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found or does not belong to user');
    }

    assertAttendanceCheckInWindow(enrollment.class);

    // Always key attendance to the scheduled class date. Using the click date
    // would allow the same meeting link to consume another pass class tomorrow.
    const sessionDate = new Date(`${enrollment.class.scheduleDay}T00:00:00.000Z`);
    if (Number.isNaN(sessionDate.getTime())) {
      throw new ConflictException('Class schedule date is invalid');
    }

    return this.prisma.$transaction(async (tx) => {
      const attendanceKey = { enrollmentId, sessionDate };
      const existingAttendance = await tx.attendance.findUnique({
        where: { enrollmentId_sessionDate: attendanceKey },
      });

      // Joining the same class repeatedly must never consume multiple credits.
      if (existingAttendance?.attended) {
        return existingAttendance;
      }

      const now = new Date();
      const activePass = await tx.userPass.findFirst({
        where: {
          userId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          AND: [
            { OR: [{ remainingClasses: null }, { remainingClasses: { gt: 0 } }] },
          ],
        },
        orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      });

      if (activePass?.remainingClasses !== null && activePass?.remainingClasses !== undefined) {
        const deduction = await tx.userPass.updateMany({
          where: {
            id: activePass.id,
            isActive: true,
            remainingClasses: { gt: 0 },
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          },
          data: {
            remainingClasses: { decrement: 1 },
            ...(activePass.remainingClasses === 1 ? { isActive: false } : {}),
          },
        });

        // A concurrent join may have consumed the final class first. Retry the
        // transaction so another eligible pass can be selected, if one exists.
        if (deduction.count !== 1) {
          throw new ConflictException(
            'Class pass balance changed. Please try joining again.',
          );
        }
      }

      return tx.attendance.upsert({
        where: { enrollmentId_sessionDate: attendanceKey },
        create: {
          enrollmentId,
          classId,
          sessionDate,
          attended: true,
          markedById: userId,
          userPassId: activePass?.id,
        },
        update: {
          attended: true,
          markedById: userId,
          userPassId: activePass?.id,
        },
      });
    });
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
      this.prisma.attendance.count({ where: { enrollment: { userId }, attended: true } }),
    ]);

    return { total, attended, missed: total - attended, rate: total > 0 ? Math.round((attended / total) * 100) : 0 };
  }

  async getMakeupCredits(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.attendance.findMany({
      where: {
        enrollment: { userId },
        attended: false,
        makeupUsed: false,
        sessionDate: { gte: thirtyDaysAgo },
      },
      include: {
        class: { select: { name: true } },
      },
      orderBy: { sessionDate: 'asc' },
    });
  }
}
