import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TestimonialSource, TestimonialStatus } from '@prisma/client';

export class CreateTestimonialDto {
  @IsString()
  @IsNotEmpty()
  studentName: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}

export class CreateAdminTestimonialDto extends CreateTestimonialDto {
  @IsOptional()
  @IsEnum(TestimonialSource)
  source?: TestimonialSource;

  @IsOptional()
  @IsEnum(TestimonialStatus)
  status?: TestimonialStatus;

  @IsOptional()
  @IsString()
  googleReviewId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateTestimonialStatusDto {
  @IsEnum(TestimonialStatus)
  status: TestimonialStatus;
}
