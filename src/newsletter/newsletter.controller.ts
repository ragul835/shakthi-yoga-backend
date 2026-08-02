import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NewsletterService } from './newsletter.service';
import { SendCampaignDto, SubscribeDto, TokenDto } from './dto/newsletter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('newsletter')
export class NewsletterController {
  constructor(private service: NewsletterService) {}
  @Post('subscribe') subscribe(@Body() dto: SubscribeDto) { return this.service.subscribe(dto.email); }
  @Post('confirm') confirm(@Body() dto: TokenDto) { return this.service.confirm(dto.token); }
  @Post('unsubscribe') unsubscribe(@Body() dto: TokenDto) { return this.service.unsubscribe(dto.token); }
  @Get('admin/subscribers') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN) findAll() { return this.service.findAll(); }
  @Post('admin/campaigns') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN) send(@Body() dto: SendCampaignDto) { return this.service.sendCampaign(dto); }
}
