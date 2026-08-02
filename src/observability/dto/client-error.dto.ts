import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientErrorDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(500)
  message: string;

  @IsString()
  @MaxLength(300)
  path: string;

  @IsIn(['window_error', 'unhandled_rejection', 'react_error_boundary', 'api_error'])
  source: 'window_error' | 'unhandled_rejection' | 'react_error_boundary' | 'api_error';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  digest?: string;
}
