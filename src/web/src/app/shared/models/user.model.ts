import { UUID } from 'crypto'; // latest
import { IsString, IsEmail } from 'class-validator'; // ^0.14.0
import { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Enumeration of possible user roles in the system.
 * Defines role-based access control hierarchy.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER',
  USER = 'USER'
}

/**
 * Enumeration of possible user status values.
 * Controls user access and account lifecycle.
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Interface defining notification preferences for users.
 * Controls user-specific notification settings.
 */
export interface NotificationPreferences {
  subscriptionAlerts: boolean;
  costAlerts: boolean;
  securityAlerts: boolean;
}

/**
 * Interface defining user-specific preferences and settings.
 * Manages user customization options.
 */
export interface UserPreferences {
  theme: string;
  language: string;
  emailNotifications: boolean;
  notifications: NotificationPreferences;
}

/**
 * Interface defining the structure of a user in the system.
 * Implements comprehensive user data model with validation.
 */
export interface User {
  readonly id: UUID;
  
  @IsEmail()
  email: string;
  
  @IsString()
  firstName: string;
  
  @IsString()
  lastName: string;
  
  readonly organizationId: UUID;
  
  @IsString()
  department: string;
  
  roles: UserRole[];
  status: UserStatus;
  preferences?: UserPreferences;
  
  readonly lastLoginAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Utility type for user updates, excluding readonly fields.
 * Ensures type safety when updating user data.
 */
export type UserUpdate = Partial<Omit<User, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

/**
 * Role hierarchy levels for permission checking.
 * Higher number indicates higher privileges.
 */
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN]: 4,
  [UserRole.FINANCE_MANAGER]: 3,
  [UserRole.DEPARTMENT_MANAGER]: 2,
  [UserRole.USER]: 1
};

/**
 * Type guard for validating user roles.
 * Ensures type safety when working with role strings.
 * 
 * @param role - Role string to validate
 * @returns Boolean indicating if role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Checks if user has required role or higher in the hierarchy.
 * Implements role-based access control logic.
 * 
 * @param requiredRole - Minimum role required for access
 * @returns Boolean indicating if user has sufficient permissions
 */
export function hasPermission(requiredRole: UserRole): boolean {
  const userRoles = (this as unknown as User).roles;
  const requiredLevel = roleHierarchy[requiredRole];
  
  return userRoles.some(role => roleHierarchy[role] >= requiredLevel);
}

/**
 * Maps JWT payload to User interface.
 * Facilitates user data transformation from JWT.
 * 
 * @param payload - JWT payload containing user data
 * @returns Partial user object with JWT data
 */
export function mapJwtToUser(payload: JwtPayload): Partial<User> {
  return {
    id: payload.sub as UUID,
    email: payload.email,
    organizationId: payload.organizationId as UUID,
    roles: payload.roles.map(role => role as UserRole)
  };
}