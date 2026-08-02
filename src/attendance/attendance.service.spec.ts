import { AttendanceService } from './attendance.service';

describe('AttendanceService class-pass consumption', () => {
  const tx = {
    attendance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    userPass: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    enrollment: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new AttendanceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    // Window behavior is covered separately in attendance-time.spec.ts.
    process.env.ATTENDANCE_CHECK_IN_BEFORE_MINUTES = '525600';
    process.env.ATTENDANCE_CHECK_IN_AFTER_MINUTES = '525600';
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enrollment',
      class: {
        scheduleDay: '2026-08-02',
        scheduleTime: '7:00 AM',
        durationMinutes: 60,
      },
    });
    tx.attendance.findUnique.mockResolvedValue(null);
    tx.attendance.upsert.mockResolvedValue({ id: 'attendance' });
    tx.userPass.findFirst.mockResolvedValue({
      id: 'pass',
      remainingClasses: 3,
    });
    tx.userPass.updateMany.mockResolvedValue({ count: 1 });
  });

  it('deducts one class on first attendance', async () => {
    await service.selfMarkAttendance('user', 'enrollment', 'class');

    expect(tx.userPass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pass' }),
        data: { remainingClasses: { decrement: 1 } },
      }),
    );
    expect(tx.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userPassId: 'pass' }),
      }),
    );
  });

  it('does not deduct twice when the student joins repeatedly', async () => {
    tx.attendance.findUnique.mockResolvedValue({
      id: 'attendance',
      attended: true,
    });

    await service.selfMarkAttendance('user', 'enrollment', 'class');

    expect(tx.userPass.findFirst).not.toHaveBeenCalled();
    expect(tx.userPass.updateMany).not.toHaveBeenCalled();
    expect(tx.attendance.upsert).not.toHaveBeenCalled();
  });

  it('completes the pass when its last class is consumed', async () => {
    tx.userPass.findFirst.mockResolvedValue({
      id: 'pass',
      remainingClasses: 1,
    });

    await service.selfMarkAttendance('user', 'enrollment', 'class');

    expect(tx.userPass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          remainingClasses: { decrement: 1 },
          isActive: false,
        },
      }),
    );
  });

  it('supports a dynamic six-class pass and completes it on the sixth class', async () => {
    let remainingClasses = 6;
    let isActive = true;

    tx.attendance.findUnique.mockResolvedValue(null);
    tx.userPass.findFirst.mockImplementation(async () =>
      isActive ? { id: 'six-class-pass', remainingClasses } : null,
    );
    tx.userPass.updateMany.mockImplementation(async ({ data }) => {
      if (!isActive || remainingClasses <= 0) return { count: 0 };
      remainingClasses -= 1;
      if (data.isActive === false) isActive = false;
      return { count: 1 };
    });

    for (let classNumber = 1; classNumber <= 6; classNumber += 1) {
      prisma.enrollment.findFirst.mockResolvedValueOnce({
        id: `enrollment-${classNumber}`,
        class: {
          scheduleDay: `2026-08-${String(classNumber).padStart(2, '0')}`,
          scheduleTime: '7:00 AM',
          durationMinutes: 60,
        },
      });
      await service.selfMarkAttendance(
        'user',
        `enrollment-${classNumber}`,
        `class-${classNumber}`,
      );
      expect(remainingClasses).toBe(6 - classNumber);
    }

    expect(remainingClasses).toBe(0);
    expect(isActive).toBe(false);
    expect(tx.userPass.updateMany).toHaveBeenCalledTimes(6);
    expect(tx.userPass.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          remainingClasses: { decrement: 1 },
          isActive: false,
        },
      }),
    );
  });
});
