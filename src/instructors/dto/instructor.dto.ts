import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, Min, IsEmail, MinLength, IsUrl } from 'class-validator';

export class CreateInstructorDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  photoUrl?: string;
}

export class UpdateInstructorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
