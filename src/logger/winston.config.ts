import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.colorize(),
        winston.format.printf((info) => {
          const context = typeof info.context === 'string' ? info.context : '';
          return `${String(info.timestamp)} [${String(info.level)}] ${context ? `[${context}] ` : ''}${String(info.message)} ${String(info.ms)}`;
        }),
      ),
    }),
  ],
});
