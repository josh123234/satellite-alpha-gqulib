import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { configuration } from '../config/configuration';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenBlacklist: Redis;
  private readonly sessionStore: Redis;
  private readonly rateLimiter: RateLimiterRedis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisClient: Redis,
  ) {
    // Initialize Redis clients with secure configuration
    this.tokenBlacklist = new Redis({
      ...configuration.redis,
      keyPrefix: 'blacklist:',
      tls: configuration.security.redis.tls,
      password: configuration.security.redis.password,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

    this.sessionStore = new Redis({
      ...configuration.redis,
      keyPrefix: 'session:',
      tls: configuration.security.redis.tls,
      password: configuration.security.redis.password,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

    // Configure rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redisClient,
      keyPrefix: 'ratelimit:auth',
      points: configuration.security.rateLimitMax,
      duration: configuration.security.rateLimitWindow,
    });
  }

  /**
   * Generates a secure JWT token with enhanced payload encryption
   */
  async generateToken(payload: JwtPayload): Promise<string> {
    try {
      await this.rateLimiter.consume(payload.sub);

      const tokenId = uuidv4();
      const enhancedPayload = {
        ...payload,
        jti: tokenId,
        iss: configuration.app.name,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = this.jwtService.sign(enhancedPayload, {
        secret: configuration.security.jwtSecret,
        expiresIn: configuration.security.jwtExpiresIn,
      });

      // Store token metadata in Redis
      await this.sessionStore.setex(
        `token:${tokenId}`,
        parseInt(configuration.security.jwtExpiresIn) * 3600,
        JSON.stringify({
          userId: payload.sub,
          issuedAt: enhancedPayload.iat,
          organizationId: payload.organizationId,
        })
      );

      return token;
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`);
      throw new UnauthorizedException('Token generation failed');
    }
  }

  /**
   * Validates JWT token with comprehensive security checks
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // Check token blacklist
      const isBlacklisted = await this.tokenBlacklist.exists(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: configuration.security.jwtSecret,
      });

      // Validate session
      const session = await this.sessionStore.get(`token:${payload.jti}`);
      if (!session) {
        throw new UnauthorizedException('Invalid session');
      }

      return payload;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Processes OAuth authentication with enhanced security
   */
  async handleOAuthLogin(profile: any): Promise<{ token: string; refreshToken: string }> {
    try {
      await this.rateLimiter.consume(`oauth:${profile.id}`);

      const payload: JwtPayload = {
        sub: profile.id,
        email: profile.email,
        organizationId: profile.organizationId,
        roles: profile.roles || ['user'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 3600,
        jti: uuidv4(),
        iss: configuration.app.name,
      };

      const token = await this.generateToken(payload);
      const refreshToken = await this.generateRefreshToken(payload);

      // Enforce session limits
      await this.enforceSessionLimits(payload.sub);

      return { token, refreshToken };
    } catch (error) {
      this.logger.error(`OAuth login failed: ${error.message}`);
      throw new UnauthorizedException('OAuth authentication failed');
    }
  }

  /**
   * Handles secure token refresh process
   */
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: configuration.security.jwtSecret,
      });

      // Verify refresh token family
      const isValidRefresh = await this.sessionStore.exists(`refresh:${payload.jti}`);
      if (!isValidRefresh) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new token pair
      const newPayload: JwtPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 3600,
        jti: uuidv4(),
      };

      const newToken = await this.generateToken(newPayload);
      const newRefreshToken = await this.generateRefreshToken(newPayload);

      // Invalidate old refresh token
      await this.sessionStore.del(`refresh:${payload.jti}`);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  /**
   * Securely terminates user session
   */
  async logout(token: string): Promise<void> {
    try {
      const payload = await this.validateToken(token);

      // Add token to blacklist
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await this.tokenBlacklist.setex(
        tokenHash,
        parseInt(configuration.security.jwtExpiresIn) * 3600,
        '1'
      );

      // Clear session data
      await this.sessionStore.del(`token:${payload.jti}`);
      await this.sessionStore.del(`refresh:${payload.jti}`);

      this.logger.debug(`Successfully logged out user: ${payload.sub}`);
    } catch (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw new UnauthorizedException('Logout failed');
    }
  }

  /**
   * Private helper methods
   */
  private async generateRefreshToken(payload: JwtPayload): Promise<string> {
    const refreshPayload = {
      ...payload,
      jti: uuidv4(),
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: configuration.security.jwtSecret,
      expiresIn: '7d',
    });

    // Store refresh token metadata
    await this.sessionStore.setex(
      `refresh:${refreshPayload.jti}`,
      7 * 24 * 3600,
      JSON.stringify({
        userId: payload.sub,
        tokenFamily: payload.jti,
      })
    );

    return refreshToken;
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    const maxSessions = 5;
    const sessions = await this.sessionStore.keys(`token:*`);
    const userSessions = sessions.filter(async (key) => {
      const session = await this.sessionStore.get(key);
      return JSON.parse(session).userId === userId;
    });

    if (userSessions.length >= maxSessions) {
      // Remove oldest session
      const oldestSession = userSessions[0];
      await this.sessionStore.del(oldestSession);
    }
  }
}