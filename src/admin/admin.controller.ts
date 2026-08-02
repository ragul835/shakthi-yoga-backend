import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateSiteContentDto } from './dto/site-content.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('content/:pageKey')
  getSiteContent(@Param('pageKey') pageKey: string) {
    return this.adminService.getSiteContent(pageKey);
  }

  @Put('content/:pageKey')
  updateSiteContent(
    @Param('pageKey') pageKey: string,
    @Body() dto: UpdateSiteContentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateSiteContent(pageKey, dto, userId);
  }
}
