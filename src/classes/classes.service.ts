import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { ClassStatus, ClassType, ExperienceLevel } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassDto) {
    return this.prisma.class.create({
      data: {
        ...dto,
        experienceLevel: dto.experienceLevel || ExperienceLevel.ALL,
      },
      include: {
        instructor: {
          include: { user: { select: { name: true } } },
        },
      },
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      type?: ClassType;
      instructorId?: string;
      scheduleDay?: string;
      experienceLevel?: ExperienceLevel;
      search?: string;
      status?: ClassStatus;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.instructorId) where.instructorId = filters.instructorId;
    if (filters?.scheduleDay) where.scheduleDay = filters.scheduleDay;
    if (filters?.experienceLevel) where.experienceLevel = filters.experienceLevel;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          instructor: {
            include: { user: { select: { name: true, profilePhotoUrl: true } } },
          },
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data: classes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findPublic(
    page = 1,
    limit = 20,
    filters?: {
      type?: ClassType;
      scheduleDay?: string;
      experienceLevel?: ExperienceLevel;
      search?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { status: { in: ['ACTIVE', 'FULL', 'UPCOMING'] } };

    if (filters?.type) where.type = filters.type;
    if (filters?.scheduleDay) where.scheduleDay = filters.scheduleDay;
    if (filters?.experienceLevel) where.experienceLevel = filters.experienceLevel;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          instructor: {
            include: { user: { select: { name: true, profilePhotoUrl: true } } },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data: classes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const yogaClass = await this.prisma.class.findUnique({
      where: { id },
      include: {
        instructor: {
          include: { user: { select: { name: true, profilePhotoUrl: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found');
    }

    return yogaClass;
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.findOne(id);
    return this.prisma.class.update({
      where: { id },
      data: dto,
      include: {
        instructor: {
          include: { user: { select: { name: true } } },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.class.delete({ where: { id } });
    return { message: 'Class deleted successfully' };
  }

  async getFeatured(limit = 4) {
    return this.prisma.class.findMany({
      where: { status: 'ACTIVE' },
      take: limit,
      orderBy: { currentEnrollment: 'desc' },
      include: {
        instructor: {
          include: { user: { select: { name: true, profilePhotoUrl: true } } },
        },
      },
    });
  }
}
