import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { PassesModule } from './passes/passes.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        if (config.NODE_ENV === 'production') {
          const jwtSecret = String(config.JWT_SECRET || '');
          if (jwtSecret.length < 32) {
            throw new Error('JWT_SECRET must contain at least 32 characters');
          }
          const frontendUrl = String(config.FRONTEND_URL || '');
          if (!frontendUrl.startsWith('https://')) {
            throw new Error('FRONTEND_URL must use HTTPS in production');
          }
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
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
    PassesModule,
    NewsletterModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*path');
  }
}
