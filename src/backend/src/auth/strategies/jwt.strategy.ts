import { Injectable, UnauthorizedException } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { PassportStrategy } from '@nestjs/passport'; // @nestjs/passport ^10.0.0
import { Strategy, ExtractJwt } from 'passport-jwt'; // passport-jwt ^4.0.0
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { configuration } from '../../config/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Configure secure JWT extraction from Authorization header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // Ensure JWT secret is provided
      secretOrKey: configuration.security.jwtSecret,
      
      // Enhanced security options
      ignoreExpiration: false, // Enforce token expiration check
      algorithms: ['HS256'], // Restrict to secure algorithm
      
      // Additional security validations
      passReqToCallback: true, // Enable request access in validation
      jsonWebTokenOptions: {
        complete: true, // Validate complete token structure
        maxAge: configuration.security.jwtExpiresIn, // Enforce max token age
        clockTolerance: 30, // 30 seconds clock skew tolerance
        audience: 'saas-platform', // Validate token audience
        issuer: 'saas-platform-auth', // Validate token issuer
      }
    });
  }

  /**
   * Validates JWT payload with comprehensive security checks
   * @param {any} request - Express request object
   * @param {JwtPayload} payload - Decoded JWT payload
   * @returns {Promise<JwtPayload>} Validated payload or throws UnauthorizedException
   */
  async validate(request: any, payload: JwtPayload): Promise<JwtPayload> {
    try {
      // Validate required payload fields
      if (!payload.sub || !payload.email || !payload.organizationId || !payload.roles) {
        throw new UnauthorizedException('Invalid token payload structure');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        throw new UnauthorizedException('Invalid email format in token');
      }

      // Validate organization context
      if (!payload.organizationId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/)) {
        throw new UnauthorizedException('Invalid organization ID format');
      }

      // Validate roles array
      if (!Array.isArray(payload.roles) || payload.roles.length === 0) {
        throw new UnauthorizedException('Invalid roles specification');
      }

      // Validate token timestamps
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp <= currentTime) {
        throw new UnauthorizedException('Token has expired');
      }
      if (payload.iat > currentTime) {
        throw new UnauthorizedException('Token issued in the future');
      }

      // Validate token issuer
      if (payload.iss !== 'saas-platform-auth') {
        throw new UnauthorizedException('Invalid token issuer');
      }

      // Validate token ID format
      if (!payload.jti?.match(/^[0-9a-fA-F]{32}$/)) {
        throw new UnauthorizedException('Invalid token ID format');
      }

      // Sanitize payload before returning
      const sanitizedPayload: JwtPayload = {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        organizationId: payload.organizationId,
        roles: payload.roles.map(role => role.trim()),
        iat: payload.iat,
        exp: payload.exp,
        jti: payload.jti,
        iss: payload.iss
      };

      return sanitizedPayload;
    } catch (error) {
      // Log validation failure for security monitoring
      console.error('JWT validation failed:', {
        error: error.message,
        tokenId: payload?.jti,
        timestamp: new Date().toISOString()
      });

      // Throw standardized authentication error
      throw new UnauthorizedException(
        error instanceof UnauthorizedException ? error.message : 'Invalid token'
      );
    }
  }
}