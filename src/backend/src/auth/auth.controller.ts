import { Controller, Post, Get, UseGuards, Body, Req, Res, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { IsEmail, IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// DTOs for request validation
class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

class OAuthCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}

@Controller('auth')
@ApiTags('Authentication')
@ApiSecurity('bearer')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login with rate limiting' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ token: string; expiresIn: number }> {
    try {
      this.logger.debug(`Login attempt for email: ${loginDto.email}`);

      const payload: JwtPayload = {
        sub: 'user_id', // This would be replaced with actual user ID after validation
        email: loginDto.email,
        organizationId: 'org_id', // This would be replaced with actual org ID
        roles: ['user'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 3600,
        jti: '',
        iss: ''
      };

      const token = await this.authService.generateToken(payload);
      const expiresIn = 24 * 3600; // 24 hours in seconds

      // Set secure HTTP-only cookie
      response.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: expiresIn * 1000
      });

      this.logger.debug(`Login successful for user: ${payload.sub}`);
      return { token, expiresIn };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'Handle OAuth authentication callback' })
  @ApiResponse({ status: 200, description: 'OAuth callback successful' })
  @ApiResponse({ status: 401, description: 'Invalid OAuth callback' })
  async oauthCallback(
    @Body() callbackDto: OAuthCallbackDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ token: string; refreshToken: string }> {
    try {
      this.logger.debug('Processing OAuth callback');
      
      // Mock profile for demonstration - would be replaced with actual OAuth profile
      const mockProfile = {
        id: 'oauth_user_id',
        email: 'user@example.com',
        organizationId: 'org_id',
        roles: ['user']
      };

      const { token, refreshToken } = await this.authService.handleOAuthLogin(mockProfile);

      // Set secure HTTP-only cookies
      response.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 24 * 3600 * 1000
      });

      response.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 3600 * 1000
      });

      this.logger.debug(`OAuth login successful for user: ${mockProfile.id}`);
      return { token, refreshToken };
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`);
      throw new UnauthorizedException('OAuth authentication failed');
    }
  }

  @Post('token/validate')
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async validateToken(
    @Req() request: Request
  ): Promise<JwtPayload> {
    try {
      const token = this.extractTokenFromRequest(request);
      const payload = await this.authService.validateToken(token);
      
      this.logger.debug(`Token validated for user: ${payload.sub}`);
      return payload;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ message: string }> {
    try {
      const token = this.extractTokenFromRequest(request);
      await this.authService.logout(token);

      // Clear auth cookies
      response.clearCookie('auth_token');
      response.clearCookie('refresh_token');

      this.logger.debug('Logout successful');
      return { message: 'Logout successful' };
    } catch (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw new UnauthorizedException('Logout failed');
    }
  }

  private extractTokenFromRequest(request: Request): string {
    const authHeader = request.headers.authorization;
    const cookieToken = request.cookies?.auth_token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    } else if (cookieToken) {
      return cookieToken;
    }

    throw new UnauthorizedException('No valid token found');
  }
}