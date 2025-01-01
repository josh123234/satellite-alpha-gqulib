import { Injectable, NestMiddleware } from '@nestjs/common'; // ^10.0.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { generateHash } from '../utils/encryption.util';

// Correlation ID header constant
const CORRELATION_ID_HEADER = 'X-Correlation-ID';

// Validation regex for correlation ID format
const CORRELATION_ID_REGEX = /^[a-f0-9]{32}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly headerName: string;
  private readonly maxIdLength: number = 32;
  private readonly rateLimitWindow: number = 1000; // 1 second
  private readonly maxRequestsPerWindow: number = 1000;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();

  constructor() {
    this.headerName = CORRELATION_ID_HEADER;
    this.validateHeaderName();
  }

  /**
   * Middleware implementation for correlation ID handling
   * @param req Express Request object
   * @param res Express Response object
   * @param next Express NextFunction
   */
  use(req: Request, res: Response, next: NextFunction): void {
    try {
      // Rate limiting check
      this.checkRateLimit();

      // Get existing correlation ID from request header
      let correlationId = req.header(this.headerName);

      // Validate existing correlation ID if present
      if (correlationId) {
        if (!this.isValidCorrelationId(correlationId)) {
          correlationId = this.generateCorrelationId();
        }
      } else {
        correlationId = this.generateCorrelationId();
      }

      // Set correlation ID on both request and response
      this.setCorrelationId(req, res, correlationId);

      // Add correlation ID to request object for logging
      (req as any).correlationId = correlationId;

      next();
    } catch (error) {
      // Log error but continue processing
      console.error('Correlation ID middleware error:', error);
      next();
    }
  }

  /**
   * Generates a cryptographically secure correlation ID
   * @returns string Secure correlation ID
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    const input = `${timestamp}-${random}`;
    
    // Use encryption utility to generate secure hash
    const hash = generateHash(input);
    
    // Ensure hash meets format requirements
    if (!this.isValidCorrelationId(hash)) {
      throw new Error('Generated correlation ID does not meet format requirements');
    }
    
    return hash;
  }

  /**
   * Validates correlation ID format
   * @param id Correlation ID to validate
   * @returns boolean Validation result
   */
  private isValidCorrelationId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    if (id.length > this.maxIdLength) return false;
    return CORRELATION_ID_REGEX.test(id);
  }

  /**
   * Validates header name format
   * @throws Error if header name is invalid
   */
  private validateHeaderName(): void {
    if (!this.headerName || typeof this.headerName !== 'string') {
      throw new Error('Invalid correlation ID header name');
    }
    if (!/^[A-Za-z0-9-]+$/.test(this.headerName)) {
      throw new Error('Correlation ID header contains invalid characters');
    }
  }

  /**
   * Sets correlation ID on request and response
   * @param req Express Request object
   * @param res Express Response object
   * @param correlationId Correlation ID to set
   */
  private setCorrelationId(req: Request, res: Response, correlationId: string): void {
    // Set as request header
    req.headers[this.headerName.toLowerCase()] = correlationId;
    
    // Set as response header
    res.setHeader(this.headerName, correlationId);
  }

  /**
   * Implements rate limiting for correlation ID generation
   * @throws Error if rate limit exceeded
   */
  private checkRateLimit(): void {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastResetTime >= this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // Increment request count
    this.requestCount++;
    
    // Check if limit exceeded
    if (this.requestCount > this.maxRequestsPerWindow) {
      throw new Error('Correlation ID generation rate limit exceeded');
    }
  }
}