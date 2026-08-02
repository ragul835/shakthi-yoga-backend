import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { winstonConfig } from './logger/winston.config';
import helmet from 'helmet';

async function bootstrap() {
  const startupLogger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: winstonConfig,
  });

  // Global prefix
  app.setGlobalPrefix('api');
  app.use(helmet());

  // CORS — supports comma-separated FRONTEND_URL values
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 8000;
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  startupLogger.log(JSON.stringify({ event: 'application_started', port: Number(port), environment: process.env.NODE_ENV || 'development' }));
}

const fatalLogger = new Logger('Process');
const terminateAfterLogging = () => {
  setTimeout(() => process.exit(1), 100);
};
process.on('unhandledRejection', (reason) => {
  fatalLogger.error(JSON.stringify({
    event: 'unhandled_rejection',
    error: reason instanceof Error ? reason.message : 'Non-error rejection',
  }), reason instanceof Error ? reason.stack : undefined);
  terminateAfterLogging();
});
process.on('uncaughtException', (error) => {
  fatalLogger.fatal(JSON.stringify({ event: 'uncaught_exception', error: error.message }), error.stack);
  terminateAfterLogging();
});

void bootstrap().catch((error: unknown) => {
  const failure = error instanceof Error ? error : new Error('Unknown bootstrap failure');
  fatalLogger.fatal(JSON.stringify({ event: 'application_start_failed', error: failure.message }), failure.stack);
  terminateAfterLogging();
});
