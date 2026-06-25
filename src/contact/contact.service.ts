import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateContactDto) {
    return this.prisma.contactMessage.create({ data: dto });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count(),
    ]);
    return { data: messages, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async markAsRead(id: string, readById: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readById },
    });
  }
}
