import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PassesService } from './passes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('passes')
export class PassesController {
  constructor(private readonly passesService: PassesService) {}

  // ─── Public / User Endpoints ────────────────────────────────────────────────

  @Get('options')
  findAllOptions() {
    return this.passesService.findAllOptions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMyPasses(@Request() req: any) {
    return this.passesService.findUserPasses(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase/:optionId')
  purchasePass(@Request() req: any, @Param('optionId') optionId: string) {
    return this.passesService.purchasePass(req.user.id, optionId);
  }

  // ─── Admin Endpoints ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('admin/options')
  findAllAdminOptions() {
    return this.passesService.findAllAdminOptions();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post('admin/options')
  createOption(@Body() data: any) {
    return this.passesService.createOption(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Patch('admin/options/:id')
  updateOption(@Param('id') id: string, @Body() data: any) {
    return this.passesService.updateOption(id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Delete('admin/options/:id')
  deleteOption(@Param('id') id: string) {
    return this.passesService.deleteOption(id);
  }
}
