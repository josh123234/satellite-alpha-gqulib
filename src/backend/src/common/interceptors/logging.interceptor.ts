import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, HttpException } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');
  private readonly LOG_CONTEXT = 'HTTP_REQUEST';
  private readonly SENSITIVE_FIELDS_PATTERN = /password|token|secret|key|auth|credit|card/i;

  constructor() {
    this.logger.log('Initializing LoggingInterceptor with CloudWatch integration');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;
    
    // Get or generate correlation ID
    const correlationId = headers['x-correlation-id'] || this.generateCorrelationId();
    request.headers['x-correlation-id'] = correlationId;

    // Record start time using high-resolution timer
    const startTime = performance.now();

    // Log incoming request
    const requestLog = this.formatLog({
      type: 'REQUEST',
      correlationId,
      method,
      url,
      headers: this.redactSensitiveData(headers),
      body: this.redactSensitiveData(body)
    });
    this.logger.log(requestLog);

    return next.handle().pipe(
      tap((response) => {
        // Calculate request duration
        const duration = Math.round(performance.now() - startTime);

        // Log successful response
        const responseLog = this.formatLog({
          type: 'RESPONSE',
          correlationId,
          method,
          url,
          statusCode: context.switchToHttp().getResponse().statusCode,
          duration,
          response: this.redactSensitiveData(response)
        });
        this.logger.log(responseLog);
      }),
      catchError((error) => {
        // Calculate duration even for errors
        const duration = Math.round(performance.now() - startTime);

        // Log error response
        const errorLog = this.formatLog({
          type: 'ERROR',
          correlationId,
          method,
          url,
          statusCode: error instanceof HttpException ? error.getStatus() : 500,
          duration,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        });
        this.logger.error(errorLog);

        throw error;
      })
    );
  }

  private formatLog(logData: any): string {
    const baseLog = {
      timestamp: new Date().toISOString(),
      context: this.LOG_CONTEXT,
      correlationId: logData.correlationId,
      type: logData.type,
      method: logData.method,
      url: logData.url,
      duration: logData.duration,
      statusCode: logData.statusCode
    };

    // Add additional data based on log type
    if (logData.type === 'REQUEST') {
      baseLog['headers'] = logData.headers;
      baseLog['body'] = logData.body;
    } else if (logData.type === 'RESPONSE') {
      baseLog['response'] = logData.response;
    } else if (logData.type === 'ERROR') {
      baseLog['error'] = logData.error;
    }

    // Format for CloudWatch structured logging
    return JSON.stringify(baseLog);
  }

  private redactSensitiveData(data: any): any {
    if (!data) return data;
    
    const clonedData = JSON.parse(JSON.stringify(data));

    const redact = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          redact(obj[key]);
        } else if (this.SENSITIVE_FIELDS_PATTERN.test(key)) {
          obj[key] = '[REDACTED]';
        }
      }
    };

    redact(clonedData);
    return clonedData;
  }

  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const uuid = uuidv4().split('-')[0];
    return `${timestamp}-${uuid}`;
  }
}
```

This implementation provides a comprehensive logging interceptor that:

1. Captures detailed request/response information with timing
2. Implements correlation ID tracking for distributed tracing
3. Redacts sensitive information automatically
4. Formats logs for CloudWatch structured logging
5. Provides high-resolution timing using performance hooks
6. Handles both successful responses and errors
7. Maintains consistent correlation IDs throughout the request lifecycle

The code follows NestJS best practices and includes extensive error handling and security considerations. It's designed to integrate seamlessly with AWS CloudWatch and support distributed tracing requirements.

Note: Make sure to add the `uuid` package to your dependencies:
```json
{
  "dependencies": {
    "uuid": "^9.0.0"
  }
}