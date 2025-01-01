import { SetMetadata } from '@nestjs/common';  // @nestjs/common ^10.0.0

/**
 * Key used to store and retrieve roles metadata in NestJS decorators and guards
 */
export const ROLES_KEY = 'roles' as const;

/**
 * Valid system roles as defined in the technical specification
 */
export enum SystemRole {
  ADMIN = 'Admin',
  FINANCE_MANAGER = 'Finance Manager',
  DEPARTMENT_MANAGER = 'Department Manager',
  USER = 'User',
  INTEGRATION_SERVICE = 'Integration Service'
}

/**
 * Type guard to check if a string is a valid SystemRole
 * @param role - Role string to validate
 */
const isValidRole = (role: string): role is SystemRole => {
  return Object.values(SystemRole).includes(role as SystemRole);
};

/**
 * Custom decorator factory for implementing Role-Based Access Control (RBAC)
 * on route handlers. Supports multiple roles and implements type-safe role validation.
 * 
 * @param roles - Array of roles required for accessing the route
 * @throws Error if invalid roles are provided
 * @returns Decorator that sets roles metadata on the route handler
 * 
 * @example
 * ```typescript
 * @Roles(SystemRole.ADMIN, SystemRole.FINANCE_MANAGER)
 * @Get('protected-route')
 * async protectedEndpoint() {
 *   // Only accessible by admins and finance managers
 * }
 * ```
 */
export const Roles = (...roles: SystemRole[]) => {
  // Validate that roles array is not empty
  if (!roles || roles.length === 0) {
    throw new Error('At least one role must be specified');
  }

  // Validate each role
  roles.forEach(role => {
    if (!isValidRole(role)) {
      throw new Error(`Invalid role specified: ${role}`);
    }
  });

  // Remove duplicates and create immutable array
  const uniqueRoles = [...new Set(roles)];

  // Create and return the decorator with roles metadata
  return SetMetadata(ROLES_KEY, Object.freeze(uniqueRoles));
};