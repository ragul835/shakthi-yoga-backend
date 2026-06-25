import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestimonialDto, CreateAdminTestimonialDto, UpdateTestimonialStatusDto } from './dto/testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(private prisma: PrismaService) {}

  async submitTestimonial(userId: string, studentName: string, data: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        studentName, // Use authenticated user's name
        content: data.content,
        rating: data.rating,
        userId,
        status: 'PENDING',
        source: 'SITE',
      },
    });
  }

  async findPublic() {
    return this.prisma.testimonial.findMany({
      where: {
        status: 'APPROVED',
        isActive: true,
      },
      orderBy: [
        { displayOrder: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findAll() {
    return this.prisma.testimonial.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }

  async updateStatus(id: string, data: UpdateTestimonialStatusDto) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    return this.prisma.testimonial.update({
      where: { id },
      data: { status: data.status },
    });
  }

  async remove(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    return this.prisma.testimonial.delete({ where: { id } });
  }

  async createAdminTestimonial(data: CreateAdminTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        studentName: data.studentName,
        content: data.content,
        rating: data.rating,
        status: data.status ?? 'APPROVED',
        source: data.source ?? 'GOOGLE',
        googleReviewId: data.googleReviewId,
      },
    });
  }
}
