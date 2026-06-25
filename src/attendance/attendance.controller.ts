import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.INSTRUCTOR)
  markAttendance(
    @CurrentUser('id') userId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(userId, dto);
  }

  @Post('self')
  selfMarkAttendance(
    @CurrentUser('id') userId: string,
    @Body() body: { enrollmentId: string; classId: string },
  ) {
    return this.attendanceService.selfMarkAttendance(userId, body.enrollmentId, body.classId);
  }

  @Get('class/:classId')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.INSTRUCTOR)
  getClassAttendance(
    @Param('classId') classId: string,
    @Query('sessionDate') sessionDate?: string,
  ) {
    return this.attendanceService.getClassAttendance(classId, sessionDate);
  }

  @Get('my')
  getUserAttendance(@CurrentUser('id') userId: string) {
    return this.attendanceService.getUserAttendance(userId);
  }

  @Get('my/stats')
  getMyStats(@CurrentUser('id') userId: string) {
    return this.attendanceService.getAttendanceStats(userId);
  }

  @Get('makeup-credits')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  getMakeupCredits(@CurrentUser('id') userId: string) {
    return this.attendanceService.getMakeupCredits(userId);
  }
}
