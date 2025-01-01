/**
 * Interface defining the structure of JWT (JSON Web Token) payload used across the SaaS Management Platform.
 * Implements security best practices and OWASP standards for secure authentication and authorization.
 * 
 * @interface JwtPayload
 * @property {string} sub - Unique subject identifier (user ID) following JWT standards (RFC 7519)
 * @property {string} email - User's email address for identification and communication
 * @property {string} organizationId - Organization identifier for multi-tenant context isolation
 * @property {string[]} roles - Array of user roles for role-based access control (RBAC)
 * @property {number} iat - Token issuance timestamp in Unix seconds (RFC 7519)
 * @property {number} exp - Token expiration timestamp in Unix seconds (RFC 7519)
 * @property {string} jti - Unique JWT ID for token tracking and revocation
 * @property {string} iss - Token issuer identifier for validation
 */
export interface JwtPayload {
  /** Unique subject identifier (user ID) */
  sub: string;

  /** User's email address */
  email: string;

  /** Organization identifier for multi-tenant support */
  organizationId: string;

  /** Array of user roles for authorization */
  roles: string[];

  /** Token issuance timestamp in Unix seconds */
  iat: number;

  /** Token expiration timestamp in Unix seconds */
  exp: number;

  /** Unique JWT ID for token tracking */
  jti: string;

  /** Token issuer identifier */
  iss: string;
}