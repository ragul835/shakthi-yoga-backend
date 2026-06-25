import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class CreateEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsString()
  useMakeupCreditId?: string;
}

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
