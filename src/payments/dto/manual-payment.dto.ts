import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
export enum ManualPurchaseType { CLASS = 'CLASS', PASS = 'PASS' }
export class CreateManualPaymentDto {
  @IsEnum(ManualPurchaseType) purchaseType: ManualPurchaseType;
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsUUID() passOptionId?: string;
  @IsOptional() @IsString() amountUsd?: string;
}
export class ReviewManualPaymentDto {
  @IsEnum([PaymentStatus.SUCCEEDED, PaymentStatus.FAILED]) status: PaymentStatus;
  @IsOptional() @IsString() @MaxLength(500) referenceText?: string;
  @IsOptional() @IsString() @MaxLength(500) adminNote?: string;
}
