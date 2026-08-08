import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ReplyToContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  message: string;
}
