import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { Request, Response } from 'express'; // express ^4.18.2
import { Logger } from 'winston'; // winston ^3.10.0
import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId: string;
    timestamp: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;
  private readonly errorCodeMap: Map<number, string>;
  private readonly environment: string;

  constructor() {
    // Initialize Winston logger with configured transports
    this.logger = createLogger({
      level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.errors({ stack: true }),
        format.metadata()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        })
      ],
      exitOnError: false
    });

    // Initialize error code mapping
    this.errorCodeMap = new Map([
      [400, 'VAL_001'], // Validation Error
      [401, 'AUTH_001'], // Unauthorized
      [403, 'PERM_001'], // Forbidden
      [404, 'RES_001'], // Not Found
      [429, 'RATE_001'], // Rate Limited
      [500, 'SYS_001'], // Internal Server Error
    ]);

    this.environment = process.env.NODE_ENV || 'development';
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Extract or generate correlation ID
    const correlationId = request.headers['x-correlation-id'] as string || uuidv4();

    // Format error response
    const errorResponse = this.formatError(exception, correlationId, request);

    // Log error with correlation tracking
    this.logError(errorResponse, request, exception);

    // Set security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-Correlation-ID', correlationId);

    // Send response
    response.status(status).json(errorResponse);
  }

  private formatError(
    exception: HttpException,
    correlationId: string,
    request: Request
  ): ErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse() as any;

    const errorCode = this.errorCodeMap.get(status) || 'ERR_001';
    const timestamp = new Date().toISOString();

    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message: typeof response === 'string' ? response : response.message,
        correlationId,
        timestamp,
        details: this.environment === 'production' ? undefined : response.details
      },
      meta: {
        requestId: correlationId,
        timestamp
      }
    };

    // Sanitize error details in production
    if (this.environment === 'production') {
      delete errorResponse.error.details;
      if (status === 500) {
        errorResponse.error.message = 'Internal server error';
      }
    }

    return errorResponse;
  }

  private logError(
    errorResponse: ErrorResponse,
    request: Request,
    exception: HttpException
  ): void {
    const logEntry = {
      correlationId: errorResponse.error.correlationId,
      timestamp: errorResponse.error.timestamp,
      level: 'error',
      status: exception.getStatus(),
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      errorCode: errorResponse.error.code,
      errorMessage: errorResponse.error.message,
      stack: this.environment === 'production' ? undefined : exception.stack
    };

    // Rate limit logging for high-volume errors
    const logKey = `${logEntry.errorCode}:${logEntry.path}`;
    const now = Date.now();
    const lastLogged = this.getLastLoggedTimestamp(logKey);

    if (!lastLogged || (now - lastLogged) > 60000) { // Log once per minute
      this.setLastLoggedTimestamp(logKey, now);
      this.logger.error('HTTP Exception', logEntry);
    }
  }

  private getLastLoggedTimestamp(key: string): number {
    return parseInt(process.env[`LAST_LOGGED_${key}`] || '0', 10);
  }

  private setLastLoggedTimestamp(key: string, timestamp: number): void {
    process.env[`LAST_LOGGED_${key}`] = timestamp.toString();
  }
}