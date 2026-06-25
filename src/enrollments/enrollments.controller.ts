import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/enrollment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, EnrollmentStatus } from '@prisma/client';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // Student endpoints
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.create(userId, dto);
  }

  @Get('my')
  getMyEnrollments(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.enrollmentsService.findUserEnrollments(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('my/upcoming')
  getMyUpcoming(@CurrentUser('id') userId: string) {
    return this.enrollmentsService.getUpcoming(userId);
  }

  @Delete('my/:id')
  cancelMy(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.enrollmentsService.cancel(id, userId);
  }

  // Admin endpoints
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('classId') classId?: string,
  ) {
    return this.enrollmentsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      classId,
    );
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateEnrollmentDto) {
    return this.enrollmentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.enrollmentsService.cancel(id);
  }
}
