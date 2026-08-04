import { ArrayMinSize, IsNotEmpty, IsString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceItemDto)
  records: MarkAttendanceItemDto[];
}
