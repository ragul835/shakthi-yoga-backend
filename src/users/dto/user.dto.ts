import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ExperienceLevel, Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsString()
  healthNotes?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}

export class AdminUpdateUserDto extends UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
