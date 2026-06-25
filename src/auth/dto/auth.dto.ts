import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Matches, IsArray, IsBoolean } from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  password: string;

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
  practiceFrequency?: string;

  @IsString()
  @IsNotEmpty()
  emergencyContactName: string;

  @IsString()
  @IsNotEmpty()
  emergencyContactPhone: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purposeOfJoining?: string[];

  @IsString()
  @IsNotEmpty()
  physicalHealth: string;

  @IsOptional()
  @IsString()
  mentalHealth?: string;

  @IsBoolean()
  digitalMediaWaiver: boolean;

  @IsBoolean()
  liabilityWaiver: boolean;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  newPassword: string;
}
