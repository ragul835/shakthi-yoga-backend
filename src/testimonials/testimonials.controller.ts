import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateTestimonialDto, CreateAdminTestimonialDto, UpdateTestimonialStatusDto } from './dto/testimonial.dto';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get('public')
  findPublic() {
    return this.testimonialsService.findPublic();
  }

  // Student submits a testimonial
  @Post()
  @UseGuards(JwtAuthGuard)
  submitTestimonial(@Req() req: any, @Body() body: CreateTestimonialDto) {
    return this.testimonialsService.submitTestimonial(req.user.userId, req.user.name, body);
  }

  // Admin endpoints
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    return this.testimonialsService.findAll();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createAdmin(@Body() body: CreateAdminTestimonialDto) {
    return this.testimonialsService.createAdminTestimonial(body);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() body: UpdateTestimonialStatusDto) {
    return this.testimonialsService.updateStatus(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.testimonialsService.remove(id);
  }
}
