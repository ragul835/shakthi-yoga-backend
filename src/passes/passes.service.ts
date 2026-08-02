import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePassDto } from './dto/create-pass.dto';
import { UpdatePassDto } from './dto/update-pass.dto';

@Injectable()
export class PassesService {
  constructor(private prisma: PrismaService) {}

  // ─── User Facing ───────────────────────────────────────────────────────────

  findAllOptions() {
    return this.prisma.passOption.findMany({
      where: { isActive: true },
      orderBy: { priceUsd: 'asc' },
    });
  }

  async findUserPasses(userId: string) {
    return this.prisma.userPass.findMany({
      where: { userId },
      include: {
        passOption: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async purchasePass(userId: string, passOptionId: string) {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.ALLOW_SIMULATED_PASS_PURCHASES !== 'true'
    ) {
      throw new ServiceUnavailableException(
        'Pass purchasing is unavailable until a payment provider is configured',
      );
    }

    const passOption = await this.prisma.passOption.findUnique({
      where: { id: passOptionId },
    });

    if (!passOption) {
      throw new NotFoundException('Pass option not found');
    }

    if (!passOption.isActive) {
      throw new BadRequestException('This pass option is no longer available');
    }

    let expiresAt = null;
    if (passOption.validityDays !== null) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + passOption.validityDays);
    }

    // Explicitly opt-in for non-production demos. A real payment integration must
    // create the pass only after a verified provider webhook succeeds.
    const userPass = await this.prisma.$transaction(async (tx) => {
      const pass = await tx.userPass.create({
        data: {
          userId,
          passOptionId,
          remainingClasses: passOption.totalClasses,
          expiresAt,
          isActive: true,
        },
      });

      // Create a simulated successful payment
      await tx.payment.create({
        data: {
          userId,
          userPassId: pass.id,
          amountUsd: passOption.priceUsd,
          status: 'SUCCEEDED',
          paidAt: new Date(),
          paymentType: 'ONLINE',
          adminNotes: 'Simulated purchase for Class Pass',
        },
      });

      return pass;
    });

    return userPass;
  }

  // ─── Admin Methods ──────────────────────────────────────────────────────────

  findAllAdminOptions() {
    return this.prisma.passOption.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOption(data: CreatePassDto) {
    return this.prisma.passOption.create({
      data: {
        name: data.name,
        description: data.description,
        priceUsd: data.priceUsd,
        totalClasses: data.totalClasses,
        validityDays: data.validityDays,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateOption(id: string, data: UpdatePassDto) {
    return this.prisma.passOption.update({
      where: { id },
      data,
    });
  }

  async deleteOption(id: string) {
    const option = await this.prisma.passOption.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundException('Pass option not found');
    }

    return this.prisma.passOption.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
