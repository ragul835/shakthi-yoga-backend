import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientErrorDto } from './dto/client-error.dto';

@Controller('observability')
export class ObservabilityController {
  private readonly logger = new Logger('ClientError');

  @Post('client-error')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  recordClientError(@Body() error: ClientErrorDto): void {
    this.logger.warn(JSON.stringify({
      event: 'client_error',
      source: error.source,
      name: error.name,
      message: error.message,
      path: error.path.split('?')[0].slice(0, 300),
      digest: error.digest,
    }));
  }
}
