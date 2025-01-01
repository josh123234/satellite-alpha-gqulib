import { Test, TestingModule } from '@nestjs/testing'; // @nestjs/testing ^10.0.0
import { createMock } from '@golevelup/ts-jest'; // @golevelup/ts-jest ^0.4.0
import { HttpStatus } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { Request, Response } from 'express';

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  // Test data
  const mockUser = {
    email: 'test@example.com',
    password: 'Password123!'
  };

  const mockJwtPayload: JwtPayload = {
    sub: 'user_123',
    email: 'test@example.com',
    organizationId: 'org_123',
    roles: ['user'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: 'token_123',
    iss: 'saas_platform'
  };

  const mockTokens = {
    token: 'mock.jwt.token',
    refreshToken: 'mock.refresh.token',
    expiresIn: 3600
  };

  beforeEach(async () => {
    // Create mock AuthService
    mockAuthService = createMock<AuthService>({
      generateToken: jest.fn().mockResolvedValue(mockTokens.token),
      validateToken: jest.fn().mockResolvedValue(mockJwtPayload),
      handleOAuthLogin: jest.fn().mockResolvedValue({ 
        token: mockTokens.token, 
        refreshToken: mockTokens.refreshToken 
      }),
      logout: jest.fn().mockResolvedValue(undefined),
      refreshToken: jest.fn().mockResolvedValue({
        token: 'new.jwt.token',
        refreshToken: 'new.refresh.token'
      })
    });

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should successfully authenticate user and return tokens', async () => {
      // Mock response object
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(mockUser, response);

      expect(result).toEqual({
        token: mockTokens.token,
        expiresIn: mockTokens.expiresIn
      });
      expect(response.cookie).toHaveBeenCalledWith(
        'auth_token',
        mockTokens.token,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        })
      );
      expect(mockAuthService.generateToken).toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      mockAuthService.generateToken.mockRejectedValueOnce(new Error('Rate limit exceeded'));
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.login(mockUser, response))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should validate required fields', async () => {
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.login({ 
        email: 'invalid-email', 
        password: '123' 
      }, response))
        .rejects
        .toThrow();
    });
  });

  describe('oauthCallback', () => {
    const mockCallbackData = {
      code: 'oauth_code',
      state: 'csrf_state'
    };

    it('should handle successful OAuth callback', async () => {
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.oauthCallback(mockCallbackData, response);

      expect(result).toEqual({
        token: mockTokens.token,
        refreshToken: mockTokens.refreshToken
      });
      expect(response.cookie).toHaveBeenCalledTimes(2);
      expect(mockAuthService.handleOAuthLogin).toHaveBeenCalled();
    });

    it('should handle invalid OAuth state', async () => {
      mockAuthService.handleOAuthLogin.mockRejectedValueOnce(
        new Error('Invalid state parameter')
      );
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.oauthCallback({
        ...mockCallbackData,
        state: 'invalid_state'
      }, response))
        .rejects
        .toThrow('OAuth authentication failed');
    });

    it('should handle expired OAuth session', async () => {
      mockAuthService.handleOAuthLogin.mockRejectedValueOnce(
        new Error('OAuth session expired')
      );
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.oauthCallback(mockCallbackData, response))
        .rejects
        .toThrow('OAuth authentication failed');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const request = {
        headers: {
          authorization: `Bearer ${mockTokens.token}`
        }
      } as Request;

      const result = await controller.validateToken(request);

      expect(result).toEqual(mockJwtPayload);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(mockTokens.token);
    });

    it('should handle expired tokens', async () => {
      mockAuthService.validateToken.mockRejectedValueOnce(
        new Error('Token expired')
      );
      const request = {
        headers: {
          authorization: `Bearer ${mockTokens.token}`
        }
      } as Request;

      await expect(controller.validateToken(request))
        .rejects
        .toThrow('Invalid token');
    });

    it('should handle malformed tokens', async () => {
      const request = {
        headers: {
          authorization: 'Bearer invalid.token'
        }
      } as Request;

      await expect(controller.validateToken(request))
        .rejects
        .toThrow('Invalid token');
    });

    it('should handle missing token', async () => {
      const request = {
        headers: {}
      } as Request;

      await expect(controller.validateToken(request))
        .rejects
        .toThrow('No valid token found');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const request = {
        headers: {
          authorization: `Bearer ${mockTokens.token}`
        }
      } as Request;
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(request, response);

      expect(result).toEqual({ message: 'Logout successful' });
      expect(response.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(response.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockTokens.token);
    });

    it('should handle logout with invalid token', async () => {
      mockAuthService.logout.mockRejectedValueOnce(
        new Error('Invalid token')
      );
      const request = {
        headers: {
          authorization: 'Bearer invalid.token'
        }
      } as Request;
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.logout(request, response))
        .rejects
        .toThrow('Logout failed');
    });

    it('should handle missing token during logout', async () => {
      const request = {
        headers: {}
      } as Request;
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.logout(request, response))
        .rejects
        .toThrow('No valid token found');
    });
  });

  describe('security headers', () => {
    it('should set secure headers on successful login', async () => {
      const response = {
        cookie: jest.fn(),
        header: jest.fn()
      } as unknown as Response;

      await controller.login(mockUser, response);

      expect(response.cookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          secure: true,
          httpOnly: true,
          sameSite: 'strict'
        })
      );
    });

    it('should handle token extraction from cookies', async () => {
      const request = {
        headers: {},
        cookies: {
          auth_token: mockTokens.token
        }
      } as unknown as Request;

      const result = await controller.validateToken(request);

      expect(result).toEqual(mockJwtPayload);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(mockTokens.token);
    });
  });

  describe('error handling', () => {
    it('should handle service unavailability', async () => {
      mockAuthService.generateToken.mockRejectedValueOnce(
        new Error('Service unavailable')
      );
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.login(mockUser, response))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should handle database connection errors', async () => {
      mockAuthService.validateToken.mockRejectedValueOnce(
        new Error('Database connection failed')
      );
      const request = {
        headers: {
          authorization: `Bearer ${mockTokens.token}`
        }
      } as Request;

      await expect(controller.validateToken(request))
        .rejects
        .toThrow('Invalid token');
    });
  });
});