import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PassesService } from './passes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { CreatePassDto } from './dto/create-pass.dto';
import { UpdatePassDto } from './dto/update-pass.dto';

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
  findMyPasses(@CurrentUser('id') userId: string) {
    return this.passesService.findUserPasses(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase/:optionId')
  purchasePass(
    @CurrentUser('id') userId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.passesService.purchasePass(userId, optionId);
  }

  // ─── Admin Endpoints ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/options')
  findAllAdminOptions() {
    return this.passesService.findAllAdminOptions();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('admin/options')
  createOption(@Body() data: CreatePassDto) {
    return this.passesService.createOption(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('admin/options/:id')
  updateOption(@Param('id') id: string, @Body() data: UpdatePassDto) {
    return this.passesService.updateOption(id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('admin/options/:id')
  deleteOption(@Param('id') id: string) {
    return this.passesService.deleteOption(id);
  }
}
