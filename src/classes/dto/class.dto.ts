import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ClassType, ClassStatus, ExperienceLevel, AgeGroup } from '@prisma/client';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsEnum(ClassType)
  type: ClassType;

  @IsString()
  @IsNotEmpty()
  instructorId: string;

  @IsNumber()
  @Min(0)
  priceUsd: number;

  @IsNumber()
  @Min(1)
  maxCapacity: number;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @IsString()
  @IsNotEmpty()
  scheduleDay: string;

  @IsString()
  @IsNotEmpty()
  scheduleTime: string;

  @IsNumber()
  @Min(15)
  durationMinutes: number;

  @IsOptional()
  @IsString()
  prerequisites?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsEnum(ClassType)
  type?: ClassType;

  @IsOptional()
  @IsString()
  instructorId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @IsOptional()
  @IsString()
  scheduleDay?: string;

  @IsOptional()
  @IsString()
  scheduleTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  prerequisites?: string;

  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;
}

export class ClassFilterDto {
  @IsOptional()
  @IsEnum(ClassType)
  type?: ClassType;

  @IsOptional()
  @IsString()
  instructorId?: string;

  @IsOptional()
  @IsString()
  scheduleDay?: string;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: ClassStatus;
}
