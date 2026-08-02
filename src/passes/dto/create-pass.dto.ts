import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePassDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceUsd: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalClasses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
