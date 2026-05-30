import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('Pipeline');

  log(message: string, context?: Record<string, unknown>) {
    this.logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }

  error(message: string, trace?: string, context?: Record<string, unknown>) {
    this.logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        trace,
        ...context,
      }),
    );
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.logger.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.logger.debug(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }
}
