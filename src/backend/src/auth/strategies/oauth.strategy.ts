import { Injectable } from '@nestjs/common'; // ^10.0.0
import { PassportStrategy } from '@nestjs/passport'; // ^10.0.0
import { Strategy } from 'passport-oauth2'; // ^1.7.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^3.0.0
import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';

import { AuthService } from '../auth.service';
import { configuration } from '../../config/configuration';

@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, 'oauth2') {
  private readonly logger = new Logger(OAuthStrategy.name);
  private readonly rateLimiter: RateLimiterMemory;
  private readonly providerConfig: any;

  constructor(
    private readonly authService: AuthService
  ) {
    // Initialize base OAuth2 strategy with secure configuration
    super({
      authorizationURL: configuration.oauth.authorizationUrl,
      tokenURL: configuration.oauth.tokenUrl,
      clientID: configuration.oauth.clientId,
      clientSecret: configuration.oauth.clientSecret,
      callbackURL: configuration.oauth.callbackUrl,
      scope: configuration.oauth.scopes,
      state: true, // Enable CSRF protection
      pkce: true, // Enable PKCE
      passReqToCallback: true,
      proxy: configuration.security.trustProxy,
    });

    // Initialize rate limiter with security settings
    this.rateLimiter = new RateLimiterMemory({
      points: configuration.security.rateLimitMax,
      duration: configuration.security.rateLimitWindow,
    });

    // Configure provider-specific settings
    this.providerConfig = {
      userProfileURL: configuration.oauth.userProfileUrl,
      tokenValidation: {
        issuer: configuration.oauth.issuer,
        audience: configuration.oauth.clientId,
        algorithms: ['RS256'],
      },
      headers: {
        'User-Agent': `${configuration.app.name}/${configuration.app.configVersion}`,
      },
    };
  }

  /**
   * Validates OAuth tokens and user profile with enhanced security measures
   * @param accessToken OAuth access token
   * @param refreshToken OAuth refresh token
   * @param profile User profile data
   * @returns Validated and processed user data
   */
  async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    try {
      // Check rate limiting
      await this.rateLimiter.consume(profile.id || 'anonymous');

      // Validate request integrity
      const tokenHash = createHash('sha256').update(accessToken).digest('hex');
      
      // Validate token claims
      await this.validateTokenClaims(accessToken);

      // Process and sanitize profile data
      const sanitizedProfile = this.sanitizeProfile(profile);

      // Log authentication event
      this.logger.debug(`OAuth authentication successful for user: ${sanitizedProfile.id}`);
      await this.authService.logAuthEvent({
        userId: sanitizedProfile.id,
        event: 'oauth_login',
        provider: this.name,
        timestamp: new Date(),
      });

      // Process authentication with auth service
      const authResult = await this.authService.handleOAuthLogin({
        ...sanitizedProfile,
        accessToken: tokenHash,
        refreshToken,
      });

      return authResult;
    } catch (error) {
      await this.handleAuthFailure(error);
    }
  }

  /**
   * Handles authentication failures with proper security measures
   * @param error Error object
   */
  private async handleAuthFailure(error: Error): Promise<void> {
    this.logger.error(`OAuth authentication failed: ${error.message}`);
    
    // Log security event
    await this.authService.logAuthEvent({
      event: 'oauth_failure',
      error: error.message,
      provider: this.name,
      timestamp: new Date(),
    });

    // Clean up sensitive data
    this.clearSensitiveData();

    throw error;
  }

  /**
   * Validates OAuth token claims
   * @param token OAuth token
   */
  private async validateTokenClaims(token: string): Promise<void> {
    const claims = await this.authService.validateToken(token);
    
    if (!claims.iss || claims.iss !== this.providerConfig.tokenValidation.issuer) {
      throw new Error('Invalid token issuer');
    }

    if (!claims.aud || claims.aud !== this.providerConfig.tokenValidation.audience) {
      throw new Error('Invalid token audience');
    }

    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }
  }

  /**
   * Sanitizes user profile data
   * @param profile Raw profile data
   * @returns Sanitized profile object
   */
  private sanitizeProfile(profile: any): any {
    return {
      id: profile.id,
      email: profile.email,
      name: profile.displayName,
      organizationId: profile._json?.organization_id,
      roles: profile._json?.roles || ['user'],
      metadata: {
        provider: this.name,
        providerId: profile.id,
        createdAt: new Date(),
      },
    };
  }

  /**
   * Clears sensitive data from memory
   */
  private clearSensitiveData(): void {
    process.nextTick(() => {
      this.providerConfig.clientSecret = undefined;
    });
  }
}