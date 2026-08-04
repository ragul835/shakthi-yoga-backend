import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitTestimonialDto } from './dto/testimonial.dto';
import { TestimonialsService } from './testimonials.service';

describe('TestimonialsService student submission', () => {
  const prisma = { testimonial: { create: jest.fn() } };
  const service = new TestimonialsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.testimonial.create.mockResolvedValue({ id: 'testimonial' });
  });

  it('accepts content and rating without requiring client-supplied identity', async () => {
    const dto = plainToInstance(SubmitTestimonialDto, { content: 'A thoughtful class.', rating: 5 });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('stores the authenticated user id and name', async () => {
    await service.submitTestimonial('user-1', 'Test Student', {
      content: 'A thoughtful class.',
      rating: 5,
    });

    expect(prisma.testimonial.create).toHaveBeenCalledWith({
      data: {
        studentName: 'Test Student',
        content: 'A thoughtful class.',
        rating: 5,
        userId: 'user-1',
        status: 'PENDING',
        source: 'SITE',
      },
    });
  });
});
