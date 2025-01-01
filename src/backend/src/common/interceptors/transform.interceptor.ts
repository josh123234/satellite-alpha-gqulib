import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
// @nestjs/common ^10.0.0
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs';
// rxjs ^7.8.1

// Interface defining the standardized response format
export interface TransformedResponse<T> {
  data: T | null;
  meta: {
    requestId: string;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly requestCounter: number;

  constructor() {
    this.requestCounter = 0;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<TransformedResponse<any>> {
    const metadata = {
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString()
    };

    return next.handle().pipe(
      map(data => this.transformResponse(data, metadata)),
      catchError(error => {
        throw this.handleError(error, metadata);
      })
    );
  }

  private transformResponse(data: any, metadata: { requestId: string; timestamp: string }): TransformedResponse<any> {
    // Check if response is already transformed
    if (data && data.meta && data.meta.requestId) {
      return data;
    }

    // Create standardized response format
    return {
      data: data || null,
      meta: metadata
    };
  }

  private handleError(error: Error, metadata: { requestId: string; timestamp: string }): TransformedResponse<null> {
    let errorResponse: TransformedResponse<null>;

    if (error instanceof HttpException) {
      // Handle NestJS HTTP exceptions
      const status = error.getStatus();
      const response: any = error.getResponse();

      errorResponse = {
        data: null,
        meta: metadata,
        error: {
          code: `HTTP_${status}`,
          message: typeof response === 'string' ? response : response.message,
          details: typeof response === 'object' ? response : undefined
        }
      };
    } else {
      // Handle generic errors
      errorResponse = {
        data: null,
        meta: metadata,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      };
    }

    return errorResponse;
  }

  private generateRequestId(): string {
    this.requestCounter++;
    const timestamp = Date.now();
    const counter = this.requestCounter.toString().padStart(6, '0');
    return `req_${timestamp}_${counter}`;
  }
}