import { ConflictException } from '@nestjs/common';
import { EnrollmentStatus, PaymentStatus } from '@prisma/client';
import { validateEnrollmentStatusChange } from './enrollments.service';

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
