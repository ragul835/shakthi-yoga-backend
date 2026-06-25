import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { InstructorsModule } from './instructors/instructors.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ContactModule } from './contact/contact.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    InstructorsModule,
    EnrollmentsModule,
    AttendanceModule,
    ContactModule,
    TestimonialsModule,
    AdminModule,
  ],
})
export class AppModule {}
