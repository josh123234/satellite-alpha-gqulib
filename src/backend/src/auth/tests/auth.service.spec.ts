import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { configuration } from '../../config/configuration';

// Mock external dependencies
jest.mock('@nestjs/jwt');
jest.mock('ioredis');
jest.mock('../../config/configuration', () => ({
  configuration: {
    security: {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '24h',
      redis: {
        tls: false,
        password: 'test-password'
      },
      rateLimitMax: 100,
      rateLimitWindow: 15
    },
    app: {
      name: 'test-app'
    }
  }
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let redisClient: jest.Mocked<Redis>;
  let mockTokenBlacklist: jest.Mocked<Redis>;
  let mockSessionStore: jest.Mocked<Redis>;

  const mockJwtPayload: JwtPayload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    organizationId: 'test-org-id',
    roles: ['user'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 3600,
    jti: 'test-jwt-id',
    iss: 'test-app'
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup JWT mock
    const mockJwtService = {
      sign: jest.fn(),
      verifyAsync: jest.fn()
    };

    // Setup Redis mocks
    const mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService
        },
        {
          provide: Redis,
          useValue: mockRedis
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    redisClient = module.get(Redis);
    mockTokenBlacklist = new Redis() as jest.Mocked<Redis>;
    mockSessionStore = new Redis() as jest.Mocked<Redis>;
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token with enhanced security', async () => {
      const mockToken = 'mock.jwt.token';
      jwtService.sign.mockReturnValue(mockToken);
      mockSessionStore.setex.mockResolvedValue('OK');

      const token = await service.generateToken(mockJwtPayload);

      expect(token).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockJwtPayload.sub,
          email: mockJwtPayload.email,
          organizationId: mockJwtPayload.organizationId
        }),
        expect.any(Object)
      );
      expect(mockSessionStore.setex).toHaveBeenCalled();
    });

    it('should enforce rate limiting', async () => {
      const mockError = new Error('Rate limit exceeded');
      mockSessionStore.setex.mockRejectedValue(mockError);

      await expect(service.generateToken(mockJwtPayload)).rejects.toThrow('Token generation failed');
    });
  });

  describe('validateToken', () => {
    it('should validate a legitimate token', async () => {
      const mockToken = 'valid.jwt.token';
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      mockTokenBlacklist.exists.mockResolvedValue(0);
      mockSessionStore.get.mockResolvedValue(JSON.stringify({ userId: mockJwtPayload.sub }));

      const result = await service.validateToken(mockToken);

      expect(result).toEqual(mockJwtPayload);
      expect(mockTokenBlacklist.exists).toHaveBeenCalledWith(mockToken);
      expect(mockSessionStore.get).toHaveBeenCalled();
    });

    it('should reject blacklisted tokens', async () => {
      const mockToken = 'blacklisted.jwt.token';
      mockTokenBlacklist.exists.mockResolvedValue(1);

      await expect(service.validateToken(mockToken)).rejects.toThrow('Token has been revoked');
    });

    it('should reject tokens with invalid sessions', async () => {
      const mockToken = 'invalid.session.token';
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      mockTokenBlacklist.exists.mockResolvedValue(0);
      mockSessionStore.get.mockResolvedValue(null);

      await expect(service.validateToken(mockToken)).rejects.toThrow('Invalid session');
    });
  });

  describe('handleOAuthLogin', () => {
    const mockOAuthProfile = {
      id: 'oauth-user-id',
      email: 'oauth@example.com',
      organizationId: 'oauth-org-id',
      roles: ['user']
    };

    it('should process OAuth login and return tokens', async () => {
      const mockTokens = {
        token: 'access.token',
        refreshToken: 'refresh.token'
      };
      
      jwtService.sign.mockReturnValueOnce(mockTokens.token)
                     .mockReturnValueOnce(mockTokens.refreshToken);
      mockSessionStore.setex.mockResolvedValue('OK');

      const result = await service.handleOAuthLogin(mockOAuthProfile);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockSessionStore.setex).toHaveBeenCalled();
    });

    it('should enforce session limits during OAuth login', async () => {
      const mockSessions = ['session1', 'session2', 'session3', 'session4', 'session5'];
      mockSessionStore.keys.mockResolvedValue(mockSessions);
      mockSessionStore.get.mockResolvedValue(JSON.stringify({ userId: mockOAuthProfile.id }));

      await service.handleOAuthLogin(mockOAuthProfile);

      expect(mockSessionStore.del).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should generate new token pair for valid refresh token', async () => {
      const mockRefreshToken = 'valid.refresh.token';
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      mockSessionStore.exists.mockResolvedValue(1);
      
      const result = await service.refreshToken(mockRefreshToken);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockSessionStore.del).toHaveBeenCalled();
    });

    it('should reject invalid refresh tokens', async () => {
      const mockRefreshToken = 'invalid.refresh.token';
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      mockSessionStore.exists.mockResolvedValue(0);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should successfully terminate user session', async () => {
      const mockToken = 'valid.jwt.token';
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      mockSessionStore.get.mockResolvedValue(JSON.stringify({ userId: mockJwtPayload.sub }));
      mockTokenBlacklist.setex.mockResolvedValue('OK');

      await service.logout(mockToken);

      expect(mockTokenBlacklist.setex).toHaveBeenCalled();
      expect(mockSessionStore.del).toHaveBeenCalledTimes(2);
    });

    it('should handle logout failures gracefully', async () => {
      const mockToken = 'invalid.jwt.token';
      jwtService.verifyAsync.mockRejectedValue(new Error('Token validation failed'));

      await expect(service.logout(mockToken)).rejects.toThrow('Logout failed');
    });
  });
});