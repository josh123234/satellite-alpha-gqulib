import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@nestjs-modules/ioredis';

// Internal imports
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OAuthStrategy } from './strategies/oauth.strategy';
import { configuration } from '../config/configuration';

/**
 * AuthModule configures comprehensive authentication functionality with enhanced security features
 * Implements secure multi-strategy authentication with monitoring and compliance features
 * Follows OWASP security standards and SOC 2 compliance requirements
 */
@Module({
  imports: [
    // Configure Passport with secure defaults
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: true,
      property: 'user',
      // Rate limiting configuration
      rateLimit: {
        windowMs: configuration.security.rateLimitWindow * 60 * 1000, // Convert to milliseconds
        max: configuration.security.rateLimitMax,
        message: 'Too many authentication attempts, please try again later',
      },
    }),

    // Configure JWT with secure settings
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      signOptions: {
        expiresIn: configuration.security.jwtExpiresIn,
        algorithm: 'HS256',
        issuer: 'saas-platform-auth',
        audience: 'saas-platform',
        notBefore: '0', // Token valid immediately
      },
      verifyOptions: {
        ignoreExpiration: false,
        algorithms: ['HS256'],
        issuer: 'saas-platform-auth',
        audience: 'saas-platform',
        clockTolerance: 30, // 30 seconds clock skew tolerance
      },
    }),

    // Configure Redis for session and token management
    RedisModule.forRoot({
      config: {
        host: configuration.cache.host,
        port: configuration.cache.port,
        password: configuration.cache.password,
        tls: configuration.cache.tls,
        // Redis security and reliability settings
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 1000);
        },
      },
    }),
  ],
  providers: [
    // Core authentication providers
    AuthService,
    JwtStrategy,
    OAuthStrategy,

    // Additional security providers
    {
      provide: 'SECURITY_CONFIG',
      useValue: {
        passwordPolicy: {
          minLength: 12,
          requireNumbers: true,
          requireSpecialChars: true,
          requireUppercase: true,
          requireLowercase: true,
        },
        sessionPolicy: {
          maxConcurrentSessions: 5,
          absoluteTimeout: 24 * 60 * 60, // 24 hours
          inactivityTimeout: 30 * 60, // 30 minutes
        },
        tokenPolicy: {
          accessTokenTTL: configuration.security.jwtExpiresIn,
          refreshTokenTTL: '7d',
          rotateRefreshToken: true,
        },
      },
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    // Export security configuration for other modules
    'SECURITY_CONFIG',
  ],
})
export class AuthModule {}