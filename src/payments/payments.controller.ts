import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateManualPaymentDto, ReviewManualPaymentDto } from './dto/manual-payment.dto';
import { PaymentsService } from './payments.service';
const allowedImages = new Set(['image/jpeg', 'image/png', 'image/webp']);
type PaymentScreenshot = { buffer: Buffer; mimetype: string; originalname: string; size: number };
@Controller('payments') @UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('manual') @UseGuards(RolesGuard) @Roles(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN)
  createManual(@CurrentUser('id') userId: string, @Body() dto: CreateManualPaymentDto) { return this.payments.createManual(userId, dto); }
  @Get('manual') @UseGuards(RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listManual(@Query('page') page?: string, @Query('limit') limit?: string) { return this.payments.listManual(page ? Number(page) : 1, limit ? Number(limit) : 20); }
  @Patch('manual/:id') @UseGuards(RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => { const valid = allowedImages.has(file.mimetype); callback(valid ? null : new BadRequestException('Screenshot must be JPG, PNG, or WebP'), valid); } }))
  reviewManual(@Param('id') id: string, @Body() dto: ReviewManualPaymentDto, @UploadedFile() screenshot?: PaymentScreenshot) { return this.payments.reviewManual(id, dto, screenshot); }
  @Get(':id/screenshot') @UseGuards(RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async screenshot(@Param('id') id: string, @Res({ passthrough: true }) response: Response) { const image = await this.payments.getScreenshot(id); response.set({ 'Content-Type': image.mime, 'Content-Disposition': `inline; filename="payment-${id}"`, 'Cache-Control': 'private, no-store' }); return new StreamableFile(image.data); }
  @Get(':id/receipt')
  async receipt(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string, @Res({ passthrough: true }) response: Response) { const receipt = await this.payments.getReceipt(id, user); response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="shakthi-yoga-receipt-${id}.pdf"`, 'Content-Length': receipt.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); return new StreamableFile(receipt); }
}
