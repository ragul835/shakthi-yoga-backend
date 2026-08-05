import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import {
  validateManualPaymentProof,
  validatePaymentScreenshot,
} from './payments.service';

describe('manual payment proof validation', () => {
  it('rejects verification when neither a reference nor screenshot is provided', () => {
    expect(() => validateManualPaymentProof(PaymentStatus.SUCCEEDED)).toThrow(
      BadRequestException,
    );
  });

  it('allows verification with only a transaction reference', () => {
    expect(() =>
      validateManualPaymentProof(PaymentStatus.SUCCEEDED, 'UTR-123'),
    ).not.toThrow();
  });

  it('allows verification with only a screenshot', () => {
    expect(() =>
      validateManualPaymentProof(PaymentStatus.SUCCEEDED, undefined, true),
    ).not.toThrow();
  });

  it('does not require proof when rejecting a payment', () => {
    expect(() =>
      validateManualPaymentProof(PaymentStatus.FAILED),
    ).not.toThrow();
  });
});

describe('payment screenshot validation', () => {
  it('accepts image content whose signature matches its MIME type', () => {
    expect(() =>
      validatePaymentScreenshot({
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).not.toThrow();
  });

  it('rejects a spoofed image MIME type', () => {
    expect(() =>
      validatePaymentScreenshot({
        mimetype: 'image/png',
        buffer: Buffer.from('not an image'),
      }),
    ).toThrow(BadRequestException);
  });
});
