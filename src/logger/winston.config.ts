import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.ms(),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const context = typeof info.context === 'string' ? info.context : '';
    return `${String(info.timestamp)} [${String(info.level)}] ${context ? `[${context}] ` : ''}${String(info.message)} ${String(info.ms)}`;
  }),
);

export const winstonConfig = WinstonModule.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  exitOnError: false,
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    }),
  ],
});
