import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateManualPaymentDto,
  ManualPurchaseType,
  ReviewManualPaymentDto,
} from './dto/manual-payment.dto';
import PDFDocument from 'pdfkit';

const taxMultiplier = new Prisma.Decimal('1.0875');
const totalWithTax = (value: Prisma.Decimal) =>
  value.mul(taxMultiplier).toDecimalPlaces(2);
type PaymentScreenshot = { buffer: Buffer; mimetype: string };
const studioGreen = '#315B45';
const softGreen = '#EAF1EC';
const ink = '#1E2A23';
const muted = '#66736B';
const line = '#DDE5DF';

export function validateManualPaymentProof(
  status: PaymentStatus,
  referenceText?: string,
  hasScreenshot = false,
) {
  if (
    status === PaymentStatus.SUCCEEDED &&
    !referenceText?.trim() &&
    !hasScreenshot
  ) {
    throw new BadRequestException(
      'A transaction reference/payment note or payment screenshot is required to verify payment',
    );
  }
}

export function validatePaymentScreenshot(screenshot?: PaymentScreenshot) {
  if (!screenshot) return;
  const { buffer, mimetype } = screenshot;
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const valid =
    (mimetype === 'image/jpeg' && isJpeg) ||
    (mimetype === 'image/png' && isPng) ||
    (mimetype === 'image/webp' && isWebp);
  if (!valid)
    throw new BadRequestException(
      'Payment screenshot content does not match its image type',
    );
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createManual(userId: string, dto: CreateManualPaymentDto) {
    if (dto.purchaseType === ManualPurchaseType.CLASS) {
      if (!dto.classId) throw new BadRequestException('classId is required');
      return this.createClassPayment(userId, dto.classId);
    }
    if (!dto.passOptionId)
      throw new BadRequestException('passOptionId is required');
    return this.createPassPayment(userId, dto.passOptionId);
  }

  private async createClassPayment(userId: string, classId: string) {
    const yogaClass = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!yogaClass || yogaClass.status === 'INACTIVE')
      throw new NotFoundException('Class is not available');
    if (
      await this.prisma.enrollment.findUnique({
        where: { userId_classId: { userId, classId } },
      })
    )
      throw new ConflictException('You already have a booking for this class');
    return this.prisma.$transaction(
      async (tx) => {
        const reserved = await tx.class.updateMany({
          where: {
            id: classId,
            status: { notIn: ['INACTIVE', 'FULL'] },
            currentEnrollment: { lt: yogaClass.maxCapacity },
          },
          data: { currentEnrollment: { increment: 1 } },
        });
        if (reserved.count !== 1)
          throw new BadRequestException('Class is full');
        const enrollment = await tx.enrollment.create({
          data: { userId, classId, status: 'PENDING', meetingLink: null },
        });
        return tx.payment.create({
          data: {
            userId,
            enrollmentId: enrollment.id,
            amountUsd: totalWithTax(yogaClass.priceUsd),
            paymentType: 'MANUAL',
            status: 'PENDING',
          },
          select: { id: true, status: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createPassPayment(userId: string, passOptionId: string) {
    const option = await this.prisma.passOption.findUnique({
      where: { id: passOptionId },
    });
    if (!option?.isActive) throw new NotFoundException('Pass is not available');
    return this.prisma.$transaction(async (tx) => {
      const userPass = await tx.userPass.create({
        data: {
          userId,
          passOptionId,
          remainingClasses: option.totalClasses,
          isActive: false,
        },
      });
      return tx.payment.create({
        data: {
          userId,
          userPassId: userPass.id,
          amountUsd: totalWithTax(option.priceUsd),
          paymentType: 'MANUAL',
          status: 'PENDING',
        },
        select: { id: true, status: true },
      });
    });
  }

  async listManual(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
    const safePage = Math.max(page || 1, 1);
    const where = { paymentType: 'MANUAL' as const };
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          amountUsd: true,
          referenceText: true,
          screenshotMime: true,
          adminNotes: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          enrollment: {
            select: { id: true, class: { select: { name: true } } },
          },
          userPass: {
            select: { passOption: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      data: data.map((payment) => ({
        ...payment,
        purchaseType: payment.enrollment ? 'CLASS' : 'PASS',
        passOption: payment.userPass?.passOption,
        adminNote: payment.adminNotes,
        screenshotUrl: payment.screenshotMime
          ? `/payments/${payment.id}/screenshot`
          : undefined,
      })),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async reviewManual(
    id: string,
    dto: ReviewManualPaymentDto,
    screenshot?: PaymentScreenshot,
  ) {
    const referenceText = dto.referenceText?.trim();
    const adminNote = dto.adminNote?.trim();
    validatePaymentScreenshot(screenshot);
    validateManualPaymentProof(dto.status, referenceText, Boolean(screenshot));
    if (dto.status === PaymentStatus.FAILED && !adminNote)
      throw new BadRequestException('A rejection reason is required');
    return this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id },
          include: {
            enrollment: { include: { class: true } },
            userPass: { include: { passOption: true } },
          },
        });
        if (!payment || payment.paymentType !== 'MANUAL')
          throw new NotFoundException('Manual payment not found');
        if (payment.status !== PaymentStatus.PENDING)
          throw new ConflictException('Payment has already been reviewed');
        const succeeded = dto.status === PaymentStatus.SUCCEEDED;
        await tx.payment.update({
          where: { id },
          data: {
            status: dto.status,
            referenceText: referenceText || null,
            screenshotData: screenshot
              ? Uint8Array.from(screenshot.buffer)
              : undefined,
            screenshotMime: screenshot?.mimetype,
            adminNotes: adminNote || null,
            paidAt: succeeded ? new Date() : null,
            verifiedAt: succeeded ? new Date() : null,
            receiptUrl: succeeded ? `/payments/${id}/receipt` : null,
          },
        });
        if (payment.enrollment) {
          await tx.enrollment.update({
            where: { id: payment.enrollment.id },
            data: succeeded
              ? {
                  status: 'APPROVED',
                  approvedAt: new Date(),
                  meetingLink: payment.enrollment.class.meetingLink,
                }
              : { status: 'REJECTED', adminNotes: adminNote },
          });
          if (!succeeded)
            await tx.class.update({
              where: { id: payment.enrollment.classId },
              data: { currentEnrollment: { decrement: 1 } },
            });
        } else if (payment.userPass && succeeded) {
          const days = payment.userPass.passOption.validityDays;
          await tx.userPass.update({
            where: { id: payment.userPass.id },
            data: {
              isActive: true,
              expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
            },
          });
        }
        return { id, status: dto.status };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getScreenshot(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: { screenshotData: true, screenshotMime: true },
    });
    if (!payment?.screenshotData || !payment.screenshotMime)
      throw new NotFoundException('Payment screenshot not found');
    return {
      data: Buffer.from(payment.screenshotData),
      mime: payment.screenshotMime,
    };
  }

  async getReceipt(id: string, user: { id: string; role: Role }) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        enrollment: {
          include: {
            class: {
              select: { name: true, scheduleDay: true, scheduleTime: true },
            },
          },
        },
        userPass: { include: { passOption: { select: { name: true } } } },
      },
    });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED)
      throw new NotFoundException('Receipt not found');
    if (
      payment.userId !== user.id &&
      user.role !== Role.ADMIN &&
      user.role !== Role.SUPER_ADMIN
    )
      throw new NotFoundException('Receipt not found');
    const item =
      payment.enrollment?.class.name ||
      payment.userPass?.passOption.name ||
      'Yoga purchase';
    const schedule = payment.enrollment
      ? `${payment.enrollment.class.scheduleDay} at ${payment.enrollment.class.scheduleTime}`
      : undefined;
    return this.createReceiptPdf({
      id: payment.id,
      studentName: payment.user.name,
      studentEmail: payment.user.email,
      item,
      schedule,
      amount: payment.amountUsd.toFixed(2),
      currency: payment.currency,
      reference: payment.referenceText || 'Recorded by administrator',
      verifiedAt: payment.verifiedAt || payment.paidAt || payment.createdAt,
    });
  }

  private createReceiptPdf(receipt: {
    id: string;
    studentName: string;
    studentEmail: string;
    item: string;
    schedule?: string;
    amount: string;
    currency: string;
    reference: string;
    verifiedAt: Date;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 54,
        info: {
          Title: `SHAKTHI YOGA payment receipt ${receipt.id}`,
          Author: 'SHAKTHI YOGA',
          Subject: 'Verified payment receipt',
          Keywords: 'payment receipt yoga',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 108;
      doc.rect(0, 0, pageWidth, 14).fill(studioGreen);
      doc
        .fillColor(studioGreen)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('SHAKTHI YOGA', 54, 48);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text('MINDFUL MOVEMENT  •  AUTHENTIC PRACTICE', 54, 76, {
          characterSpacing: 1.1,
        });
      doc
        .fillColor(ink)
        .font('Helvetica-Bold')
        .fontSize(30)
        .text('Payment Receipt', 54, 119);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(10)
        .text(`Receipt # ${receipt.id.toUpperCase()}`, 54, 159);

      doc.roundedRect(pageWidth - 146, 119, 92, 28, 14).fill(softGreen);
      doc
        .fillColor(studioGreen)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('PAID • VERIFIED', pageWidth - 136, 129, {
          width: 72,
          align: 'center',
        });

      const issued = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: process.env.CLASS_TIME_ZONE || 'America/Los_Angeles',
      }).format(receipt.verifiedAt);
      doc
        .moveTo(54, 190)
        .lineTo(pageWidth - 54, 190)
        .strokeColor(line)
        .lineWidth(1)
        .stroke();

      const detailRow = (label: string, value: string, y: number) => {
        doc
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(10)
          .text(label.toUpperCase(), 54, y, {
            width: 145,
            characterSpacing: 0.5,
          });
        doc
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(value, 205, y - 1, { width: contentWidth - 151 });
      };
      detailRow('Student', receipt.studentName, 221);
      detailRow('Email', receipt.studentEmail, 251);
      detailRow('Purchase', receipt.item, 281);
      if (receipt.schedule) detailRow('Class schedule', receipt.schedule, 311);
      detailRow('Verified on', issued, receipt.schedule ? 341 : 311);
      detailRow(
        'Payment method',
        'Manual bank transfer',
        receipt.schedule ? 371 : 341,
      );

      const summaryY = receipt.schedule ? 420 : 390;
      doc
        .roundedRect(54, summaryY, contentWidth, 100, 12)
        .fill('#F7F9F7')
        .strokeColor(line)
        .stroke();
      doc
        .fillColor(ink)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Payment summary', 74, summaryY + 20);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(11)
        .text(receipt.item, 74, summaryY + 52, { width: contentWidth - 220 });
      doc
        .fillColor(studioGreen)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(
          `${receipt.currency === 'USD' ? '$' : ''}${receipt.amount} ${receipt.currency}`,
          pageWidth - 244,
          summaryY + 42,
          { width: 170, align: 'right' },
        );

      const referenceY = summaryY + 133;
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text('TRANSACTION REFERENCE / PAYMENT NOTE', 54, referenceY, {
          characterSpacing: 0.5,
        });
      doc
        .fillColor(ink)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(receipt.reference, 54, referenceY + 18, {
          width: contentWidth,
          lineGap: 3,
        });

      doc
        .moveTo(54, 744)
        .lineTo(pageWidth - 54, 744)
        .strokeColor(line)
        .stroke();
      doc
        .fillColor(studioGreen)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Thank you for practicing with SHAKTHI YOGA.', 54, 760, {
          width: contentWidth,
          align: 'center',
        });
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
          'This receipt confirms that the payment was reviewed and verified by an administrator. Keep it for your records.',
          54,
          778,
          { width: contentWidth, align: 'center' },
        );
      doc.end();
    });
  }
}
