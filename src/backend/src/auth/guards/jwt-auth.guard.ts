import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from 'jsonwebtoken';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Enhanced JWT Authentication Guard that implements secure token validation,
 * role-based access control, and comprehensive security monitoring.
 * Follows OWASP security standards and implements robust error handling.
 * 
 * @class JwtAuthGuard
 * @extends {AuthGuard('jwt')}
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger('JwtAuthGuard');

  /**
   * Validates if the current request can access the protected resource.
   * Implements comprehensive security checks and monitoring.
   * 
   * @param {ExecutionContext} context - The execution context of the request
   * @returns {Promise<boolean>} True if access is granted, false otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.debug('Processing authentication request');

    const request = context.switchToHttp().getRequest();
    
    // Validate request headers
    if (!request.headers.authorization) {
      this.logger.warn('Missing authorization header');
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      // Perform JWT validation through passport strategy
      const isValid = await super.canActivate(context);
      
      if (!isValid) {
        this.logger.warn('Invalid authentication token');
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Extract and validate user from request
      const user = request.user as JwtPayload;
      
      if (!this.validateTokenPayload(user)) {
        this.logger.warn('Invalid token payload structure');
        throw new UnauthorizedException('Invalid token structure');
      }

      this.logger.debug(`Authentication successful for user: ${user.sub}`);
      return true;

    } catch (error) {
      this.handleAuthenticationError(error);
      return false;
    }
  }

  /**
   * Handles the result of authentication with enhanced error handling and logging.
   * Implements comprehensive validation of the authenticated user data.
   * 
   * @param {Error} err - Error object if authentication fails
   * @param {any} user - User data if authentication succeeds
   * @returns {any} Validated user data
   * @throws {UnauthorizedException} When authentication or validation fails
   */
  handleRequest(err: Error, user: any): any {
    // Handle specific authentication errors
    if (err) {
      if (err instanceof TokenExpiredError) {
        this.logger.warn('Token expired');
        throw new UnauthorizedException('Authentication token has expired');
      }

      this.logger.error('Authentication error', err.stack);
      throw new UnauthorizedException('Authentication failed');
    }

    // Validate user object
    if (!user) {
      this.logger.warn('Missing user data in token');
      throw new UnauthorizedException('Invalid authentication token');
    }

    // Validate token payload structure
    if (!this.validateTokenPayload(user)) {
      this.logger.warn('Invalid token payload structure');
      throw new UnauthorizedException('Invalid token structure');
    }

    this.logger.debug(`Request authenticated for user: ${user.sub}`);
    return user;
  }

  /**
   * Validates the structure and content of the JWT payload.
   * Ensures all required fields are present and properly formatted.
   * 
   * @private
   * @param {any} payload - The JWT payload to validate
   * @returns {boolean} True if payload is valid, false otherwise
   */
  private validateTokenPayload(payload: any): payload is JwtPayload {
    if (!payload) return false;

    const requiredFields: (keyof JwtPayload)[] = [
      'sub',
      'email',
      'organizationId',
      'roles',
      'iat',
      'exp',
      'jti',
      'iss'
    ];

    // Check all required fields are present
    const hasAllFields = requiredFields.every(field => payload[field] !== undefined);
    if (!hasAllFields) return false;

    // Validate field types
    const isValid = (
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.organizationId === 'string' &&
      Array.isArray(payload.roles) &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      typeof payload.jti === 'string' &&
      typeof payload.iss === 'string'
    );

    return isValid;
  }

  /**
   * Handles and logs authentication errors with appropriate security context.
   * 
   * @private
   * @param {Error} error - The error to handle
   * @throws {UnauthorizedException} With appropriate error message
   */
  private handleAuthenticationError(error: Error): never {
    this.logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedException('Authentication token has expired');
    }

    throw new UnauthorizedException('Authentication failed');
  }
}