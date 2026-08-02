import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SubscribeDto { @IsEmail() email: string; }
export class TokenDto { @IsString() @MinLength(32) @MaxLength(128) token: string; }
export class SendCampaignDto {
  @IsString() @MinLength(1) @MaxLength(150) subject: string;
  @IsString() @MinLength(1) @MaxLength(20_000) message: string;
}
