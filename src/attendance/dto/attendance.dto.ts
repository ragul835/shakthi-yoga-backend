import { IsNotEmpty, IsString, IsBoolean, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkAttendanceItemDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsBoolean()
  attended: boolean;
}

export class MarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  sessionDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceItemDto)
  records: MarkAttendanceItemDto[];
}
