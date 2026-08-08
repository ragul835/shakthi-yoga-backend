import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstructorDto, UpdateInstructorDto } from './dto/instructor.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type InstructorPhotoUpload = { buffer: Buffer; mimetype: string };

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
      // Admins can also teach. Never demote an administrative account when an
      // instructor profile is attached to it.
      const existingUser = await this.prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { role: true },
      });
      if (!existingUser) throw new NotFoundException('User not found');
      if (existingUser.role !== Role.ADMIN && existingUser.role !== Role.SUPER_ADMIN) {
        await this.prisma.user.update({ where: { id: resolvedUserId }, data: { role: Role.INSTRUCTOR } });
      }
    }

    const existing = await this.prisma.instructorProfile.findUnique({ where: { userId: resolvedUserId } });
    if (existing) throw new ConflictException('User already has an instructor profile');

    return this.prisma.instructorProfile.create({
      data: { userId: resolvedUserId, ...profileData },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findAll() {
    const instructors = await this.prisma.instructorProfile.findMany({
      where: { isActive: true },
      omit: { photoData: true },
      include: {
        user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
        _count: { select: { classes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return instructors.map(({ photoMime, ...instructor }) => ({
      ...instructor,
      photoUrl: photoMime ? `/instructors/${instructor.id}/photo` : instructor.photoUrl,
    }));
  }

  async findOne(id: string) {
    const instructor = await this.prisma.instructorProfile.findUnique({
      where: { id },
      omit: { photoData: true },
      include: {
        user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
        classes: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, type: true, scheduleDay: true, scheduleTime: true },
        },
      },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');
    const { photoMime, ...result } = instructor;
    return { ...result, photoUrl: photoMime ? `/instructors/${result.id}/photo` : result.photoUrl };
  }

  async findPublic() {
    const instructors = await this.prisma.instructorProfile.findMany({
      where: { isActive: true },
      omit: { photoData: true },
      include: {
        user: { select: { name: true, profilePhotoUrl: true } },
      },
    });
    return instructors.map(({ photoMime, ...instructor }) => ({
      ...instructor,
      photoUrl: photoMime ? `/instructors/${instructor.id}/photo` : instructor.photoUrl,
    }));
  }

  async getPhoto(id: string) {
    const instructor = await this.prisma.instructorProfile.findUnique({
      where: { id },
      select: { photoData: true, photoMime: true },
    });
    if (!instructor?.photoData || !instructor.photoMime) throw new NotFoundException('Instructor photo not found');
    return { data: instructor.photoData, mime: instructor.photoMime };
  }

  async setPhoto(id: string, photo: InstructorPhotoUpload) {
    await this.findOne(id);
    const bytes = photo.buffer;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    const valid = (photo.mimetype === 'image/jpeg' && isJpeg) || (photo.mimetype === 'image/png' && isPng) || (photo.mimetype === 'image/webp' && isWebp);
    if (!valid) throw new BadRequestException('Photo content does not match its file type');
    const storedBytes = Uint8Array.from(bytes);

    await this.prisma.instructorProfile.update({
      where: { id },
      data: { photoData: storedBytes, photoMime: photo.mimetype, photoUrl: null },
    });
    return { message: 'Instructor photo uploaded successfully', photoPath: `/instructors/${id}/photo` };
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
    await this.prisma.instructorProfile.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Instructor archived successfully' };
  }
}
