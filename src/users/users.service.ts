import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, AdminUpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          experienceLevel: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dob: true,
        experienceLevel: true,
        role: true,
        profilePhotoUrl: true,
        healthNotes: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        instructorProfile: true,
        enrollments: {
          include: { class: { select: { name: true, type: true } } },
          orderBy: { enrolledAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { enrollments: true, payments: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        dob: dto.dob ? new Date(dto.dob) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dob: true,
        experienceLevel: true,
        role: true,
        profilePhotoUrl: true,
        healthNotes: true,
      },
    });
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        dob: dto.dob ? new Date(dto.dob) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async getDashboardStats(userId: string) {
    const [totalRegistered, totalAttended, upcoming] = await Promise.all([
      this.prisma.enrollment.count({ where: { userId } }),
      this.prisma.attendance.count({
        where: { enrollment: { userId }, attended: true },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: { in: ['APPROVED', 'ACTIVE'] },
        },
      }),
    ]);

    return {
      totalRegistered,
      totalAttended,
      upcoming,
      completionRate: totalRegistered > 0
        ? Math.round((totalAttended / totalRegistered) * 100)
        : 0,
    };
  }
}
