import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { Reflector } from '@nestjs/core'; // @nestjs/core ^10.0.0
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Guard implementing Role-Based Access Control (RBAC) for the SaaS Management Platform.
 * Enforces authorization rules based on user roles while maintaining OWASP security standards
 * and SOC 2 compliance requirements.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Validates if the current user has the required roles to access a protected route.
   * Implements comprehensive security checks and audit logging.
   * 
   * @param context - Execution context containing request details
   * @returns Promise resolving to true if access is granted, false otherwise
   * @throws UnauthorizedException if validation fails or unauthorized access is attempted
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Extract required roles from route metadata
      const requiredRoles = this.reflector.getAllAndOverge<string[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()]
      );

      // If no roles are required, allow access
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      // Get request object from context
      const request = context.switchToHttp().getRequest();

      // Ensure request and user object exist
      if (!request || !request.user) {
        throw new UnauthorizedException('Invalid request context');
      }

      // Extract and validate JWT payload
      const user = request.user as JwtPayload;
      
      // Validate JWT payload structure
      if (!this.isValidJwtPayload(user)) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Perform role validation
      return this.validateRoles(requiredRoles, user.roles);

    } catch (error) {
      // Log security event with relevant details (excluding sensitive data)
      console.error('Authorization failed:', {
        timestamp: new Date().toISOString(),
        path: context.switchToHttp().getRequest().url,
        error: error.message
      });

      throw new UnauthorizedException('Access denied');
    }
  }

  /**
   * Validates JWT payload structure and required fields
   * @param payload - JWT payload to validate
   * @returns boolean indicating if payload is valid
   */
  private isValidJwtPayload(payload: any): payload is JwtPayload {
    return Boolean(
      payload &&
      typeof payload.sub === 'string' &&
      Array.isArray(payload.roles) &&
      payload.roles.every(role => typeof role === 'string') &&
      typeof payload.organizationId === 'string'
    );
  }

  /**
   * Performs secure role validation with comprehensive checks
   * @param requiredRoles - Roles required for access
   * @param userRoles - User's assigned roles
   * @returns boolean indicating if user has required roles
   */
  private validateRoles(requiredRoles: string[], userRoles: string[]): boolean {
    // Validate input arrays
    if (!Array.isArray(requiredRoles) || !Array.isArray(userRoles)) {
      return false;
    }

    // Sanitize and normalize role arrays
    const sanitizedRequiredRoles = requiredRoles
      .filter(role => typeof role === 'string')
      .map(role => role.trim().toLowerCase());

    const sanitizedUserRoles = userRoles
      .filter(role => typeof role === 'string')
      .map(role => role.trim().toLowerCase());

    // Check for admin role which has full access
    if (sanitizedUserRoles.includes('admin')) {
      return true;
    }

    // Check if user has any of the required roles
    return sanitizedRequiredRoles.some(required =>
      sanitizedUserRoles.includes(required)
    );
  }
}