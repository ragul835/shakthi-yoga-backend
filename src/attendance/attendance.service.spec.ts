import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttendanceService } from './attendance.service';

describe('AttendanceService admin marking', () => {
  const tx = {
    enrollment: { findMany: jest.fn() },
    attendance: { create: jest.fn(), findMany: jest.fn() },
    attendanceSession: { create: jest.fn() },
    userPass: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    attendance: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new AttendanceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.enrollment.findMany.mockResolvedValue([
      { id: 'present-student', userId: 'present-user' },
      { id: 'absent-student', userId: 'absent-user' },
    ]);
    tx.attendanceSession.create.mockResolvedValue({ id: 'session-lock' });
    tx.attendance.create.mockImplementation(async (args) => ({
      id: args.data.enrollmentId,
      ...args.data,
    }));
    tx.userPass.findFirst.mockResolvedValue(null);
    tx.userPass.updateMany.mockResolvedValue({ count: 1 });
  });

  it('saves Present and Absent while consuming a finite pass only for Present', async () => {
    tx.userPass.findFirst.mockResolvedValueOnce({
      id: 'pass-1',
      remainingClasses: 3,
      expiresAt: null,
      createdAt: new Date(),
      isActive: true,
    });

    const result = await service.markAttendance('admin', {
      classId: 'class',
      sessionDate: '2026-08-04',
      records: [
        { enrollmentId: 'present-student', attended: true },
        { enrollmentId: 'absent-student', attended: false },
      ],
    });

    expect(tx.userPass.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.userPass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pass-1' }),
        data: { remainingClasses: { decrement: 1 } },
      }),
    );
    expect(tx.attendance.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ attended: true, userPassId: 'pass-1' }),
      }),
    );
    expect(tx.attendance.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ attended: false, userPassId: null }),
      }),
    );
    expect(result).toHaveLength(2);
  });

  it('rejects a second submission for the same class and session date', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
      },
    );
    tx.attendanceSession.create.mockRejectedValue(duplicate);

    await expect(
      service.markAttendance('admin', {
        classId: 'class',
        sessionDate: '2026-08-04',
        records: [{ enrollmentId: 'present-student', attended: true }],
      }),
    ).rejects.toThrow('Attendance has already been submitted');

    expect(tx.enrollment.findMany).not.toHaveBeenCalled();
    expect(tx.userPass.findFirst).not.toHaveBeenCalled();
    expect(tx.userPass.updateMany).not.toHaveBeenCalled();
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it('links attendance to the pass reserved by the enrollment without consuming it twice', async () => {
    tx.enrollment.findMany.mockResolvedValue([
      {
        id: 'present-student',
        userId: 'present-user',
        userPassId: 'reserved-pass',
      },
    ]);

    await service.markAttendance('admin', {
      classId: 'class',
      sessionDate: '2026-08-04',
      records: [{ enrollmentId: 'present-student', attended: true }],
    });

    expect(tx.userPass.findFirst).not.toHaveBeenCalled();
    expect(tx.userPass.updateMany).not.toHaveBeenCalled();
    expect(tx.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userPassId: 'reserved-pass' }),
      }),
    );
  });

  it('deactivates a finite pass when Present consumes its final class', async () => {
    tx.enrollment.findMany.mockResolvedValue([
      { id: 'present-student', userId: 'present-user' },
    ]);
    tx.userPass.findFirst.mockResolvedValue({
      id: 'last-class-pass',
      remainingClasses: 1,
      expiresAt: null,
      createdAt: new Date(),
      isActive: true,
    });

    await service.markAttendance('admin', {
      classId: 'class',
      sessionDate: '2026-08-04',
      records: [{ enrollmentId: 'present-student', attended: true }],
    });

    expect(tx.userPass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { remainingClasses: { decrement: 1 }, isActive: false },
      }),
    );
  });

  it('keeps explicit Absent records available to the makeup-credit flow', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { id: 'absence', attended: false, makeupUsed: false },
    ]);

    await service.getMakeupCredits('student');

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollment: { userId: 'student' },
          attended: false,
          makeupUsed: false,
        }),
      }),
    );
  });

  it('rejects records for students outside the selected class', async () => {
    tx.enrollment.findMany.mockResolvedValue([]);
    await expect(
      service.markAttendance('admin', {
        classId: 'class',
        sessionDate: '2026-08-04',
        records: [{ enrollmentId: 'other-class-student', attended: true }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate students in one submission', async () => {
    await expect(
      service.markAttendance('admin', {
        classId: 'class',
        sessionDate: '2026-08-04',
        records: [
          { enrollmentId: 'student', attended: true },
          { enrollmentId: 'student', attended: false },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid session dates', async () => {
    await expect(
      service.markAttendance('admin', {
        classId: 'class',
        sessionDate: 'not-a-date',
        records: [{ enrollmentId: 'student', attended: true }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
