import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstructorDto, UpdateInstructorDto } from './dto/instructor.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInstructorDto) {
    const { name, email, password, userId, ...profileData } = dto;

    let resolvedUserId = userId;

    if (email && password && name) {
      // Create a new User account for this instructor
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) throw new ConflictException(`A user with email ${email} already exists`);

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await this.prisma.user.create({
        data: { name, email, passwordHash, role: Role.INSTRUCTOR, emailVerified: true },
      });
      resolvedUserId = newUser.id;
    } else if (!resolvedUserId) {
      throw new BadRequestException('Provide either a userId or name+email+password to create an instructor');
    } else {
      // Make sure the existing user is promoted to INSTRUCTOR role
      await this.prisma.user.update({ where: { id: resolvedUserId }, data: { role: Role.INSTRUCTOR } });
    }

    const existing = await this.prisma.instructorProfile.findUnique({ where: { userId: resolvedUserId } });
    if (existing) throw new ConflictException('User already has an instructor profile');

    return this.prisma.instructorProfile.create({
      data: { userId: resolvedUserId, ...profileData },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findAll() {
    return this.prisma.instructorProfile.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
        _count: { select: { classes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const instructor = await this.prisma.instructorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
        classes: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, type: true, scheduleDay: true, scheduleTime: true },
        },
      },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');
    return instructor;
  }

  async findPublic() {
    return this.prisma.instructorProfile.findMany({
      where: { isActive: true },
      include: {
        user: { select: { name: true, profilePhotoUrl: true } },
      },
    });
  }

  async update(id: string, dto: UpdateInstructorDto) {
    const { name, ...profileData } = dto;
    const instructor = await this.prisma.instructorProfile.findUnique({ where: { id } });
    if (!instructor) throw new NotFoundException('Instructor not found');

    if (name) {
      await this.prisma.user.update({
        where: { id: instructor.userId },
        data: { name },
      });
    }

    return this.prisma.instructorProfile.update({
      where: { id },
      data: profileData,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.instructorProfile.delete({ where: { id } });
    return { message: 'Instructor profile deleted' };
  }
}
