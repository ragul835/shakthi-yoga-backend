import { ConflictException } from '@nestjs/common';
import { EnrollmentStatus, PaymentStatus } from '@prisma/client';
import {
  EnrollmentsService,
  validateEnrollmentStatusChange,
} from './enrollments.service';

describe('enrollment status transition validation', () => {
  it('blocks generic approval while a manual payment is pending', () => {
    expect(() =>
      validateEnrollmentStatusChange(
        EnrollmentStatus.PENDING,
        PaymentStatus.PENDING,
        EnrollmentStatus.APPROVED,
      ),
    ).toThrow(ConflictException);
  });

  it('allows a pending makeup enrollment without a payment to be approved', () => {
    expect(() =>
      validateEnrollmentStatusChange(
        EnrollmentStatus.PENDING,
        undefined,
        EnrollmentStatus.APPROVED,
      ),
    ).not.toThrow();
  });

  it('prevents terminal enrollments from being reactivated', () => {
    expect(() =>
      validateEnrollmentStatusChange(
        EnrollmentStatus.REJECTED,
        undefined,
        EnrollmentStatus.APPROVED,
      ),
    ).toThrow(ConflictException);
  });
});

describe('makeup-credit enrollment validation', () => {
  it('accepts an unused current-month absence from a paid booking', async () => {
    const tx = {
      class: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      enrollment: {
        create: jest.fn().mockResolvedValue({ id: 'makeup-enrollment' }),
      },
      attendance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'class',
          type: 'GROUP',
          status: 'ACTIVE',
          currentEnrollment: 0,
          maxCapacity: 10,
          meetingLink: 'https://example.com/class',
        }),
      },
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new EnrollmentsService(prisma as never);

    await expect(
      service.create('student', {
        classId: 'class',
        useMakeupCreditId: 'paid-booking-absence',
      }),
    ).resolves.toEqual({ id: 'makeup-enrollment' });

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EnrollmentStatus.APPROVED,
          meetingLink: 'https://example.com/class',
          makeupCreditId: 'paid-booking-absence',
          approvedAt: expect.any(Date),
        }),
      }),
    );

    expect(tx.attendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'paid-booking-absence',
          enrollment: { userId: 'student' },
          attended: false,
          makeupUsed: false,
        }),
      }),
    );
  });
});
