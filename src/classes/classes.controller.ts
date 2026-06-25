import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, ClassType, ExperienceLevel } from '@prisma/client';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  // Public endpoints
  @Get('public')
  findPublic(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: ClassType,
    @Query('scheduleDay') scheduleDay?: string,
    @Query('experienceLevel') experienceLevel?: ExperienceLevel,
    @Query('search') search?: string,
  ) {
    return this.classesService.findPublic(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      { type, scheduleDay, experienceLevel, search },
    );
  }

  @Get('featured')
  getFeatured(@Query('limit') limit?: string) {
    return this.classesService.getFeatured(limit ? parseInt(limit) : 4);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  // Admin endpoints
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: ClassType,
    @Query('instructorId') instructorId?: string,
    @Query('scheduleDay') scheduleDay?: string,
    @Query('experienceLevel') experienceLevel?: ExperienceLevel,
    @Query('search') search?: string,
  ) {
    return this.classesService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      { type, instructorId, scheduleDay, experienceLevel, search },
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }
}
