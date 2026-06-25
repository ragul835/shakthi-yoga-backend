import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/attendance.dto';

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
    });

    if (!enrollment) {
      throw new Error('Enrollment not found or does not belong to user');
    }

    const sessionDate = new Date();
    // Normalize to start of day for session date
    sessionDate.setHours(0, 0, 0, 0);

    return this.prisma.attendance.upsert({
      where: {
        enrollmentId_sessionDate: {
          enrollmentId,
          sessionDate,
        },
      },
      create: {
        enrollmentId,
        classId,
        sessionDate,
        attended: true,
        markedById: userId,
      },
      update: {
        attended: true,
        markedById: userId,
      },
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
