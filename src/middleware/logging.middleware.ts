import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const incomingRequestId = request.get('x-request-id') || '';
    const requestId = REQUEST_ID_PATTERN.test(incomingRequestId) ? incomingRequestId : randomUUID();
    const { method } = request;
    // Query strings may contain password-reset or newsletter tokens. Never log them.
    const path = request.originalUrl.split('?')[0];
    const start = Date.now();
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const duration = Date.now() - start;

      const logMessage = JSON.stringify({
        event: 'http_request_completed',
        requestId,
        method,
        path,
        statusCode,
        responseBytes: Number(contentLength || 0),
        durationMs: duration,
      });

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
