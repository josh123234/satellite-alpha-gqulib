// @nestjs/testing version ^10.0.0
import { Test, TestingModule } from '@nestjs/testing';
// @nestjs/common version ^10.0.0
import { HttpStatus } from '@nestjs/common';
// @jest/globals version ^29.0.0
import { describe, beforeAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

import { IntegrationController } from '../integration.controller';
import { IntegrationService } from '../integration.service';
import { ProviderType, ConnectionStatus } from '../interfaces/provider.interface';
import { of, throwError } from 'rxjs';

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let service: IntegrationService;
  const TEST_TIMEOUT = 5000;

  // Mock credentials for different providers
  const mockCredentials = {
    GOOGLE_WORKSPACE: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback'
    },
    QUICKBOOKS: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    },
    STRIPE: {
      secretKey: 'test-secret-key'
    }
  };

  // Mock successful connection response
  const mockConnectionResponse = {
    success: true,
    provider: ProviderType.GOOGLE_WORKSPACE,
    status: ConnectionStatus.CONNECTED,
    metrics: {
      connectionTime: 150,
      retryCount: 0
    }
  };

  beforeAll(() => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationController],
      providers: [
        {
          provide: IntegrationService,
          useValue: {
            connectProvider: jest.fn(),
            disconnectProvider: jest.fn(),
            getProviderStatus: jest.fn(),
            monitorProviderHealth: jest.fn(),
            getProviderMetrics: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<IntegrationController>(IntegrationController);
    service = module.get<IntegrationService>(IntegrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connectProvider', () => {
    it('should successfully connect to Google Workspace', async () => {
      const dto = {
        providerType: ProviderType.GOOGLE_WORKSPACE,
        credentials: mockCredentials.GOOGLE_WORKSPACE,
        options: {
          timeout: 5000,
          retryAttempts: 3
        }
      };

      jest.spyOn(service, 'connectProvider').mockReturnValue(of(mockConnectionResponse));

      const result = await controller.connectProvider(dto);

      expect(result).toEqual(mockConnectionResponse);
      expect(service.connectProvider).toHaveBeenCalledWith(
        dto.providerType,
        dto.credentials,
        dto.options
      );
    });

    it('should handle invalid credentials', async () => {
      const dto = {
        providerType: ProviderType.GOOGLE_WORKSPACE,
        credentials: { invalidKey: 'invalid-value' },
        options: {}
      };

      jest.spyOn(service, 'connectProvider').mockReturnValue(
        throwError(() => ({
          message: 'Invalid credentials provided',
          status: HttpStatus.BAD_REQUEST
        }))
      );

      await expect(controller.connectProvider(dto)).rejects.toThrow('Invalid credentials provided');
    });

    it('should handle rate limiting', async () => {
      const dto = {
        providerType: ProviderType.STRIPE,
        credentials: mockCredentials.STRIPE,
        options: {}
      };

      jest.spyOn(service, 'connectProvider').mockReturnValue(
        throwError(() => ({
          message: 'Rate limit exceeded',
          status: HttpStatus.TOO_MANY_REQUESTS
        }))
      );

      await expect(controller.connectProvider(dto)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle connection timeout', async () => {
      const dto = {
        providerType: ProviderType.QUICKBOOKS,
        credentials: mockCredentials.QUICKBOOKS,
        options: { timeout: 1000 }
      };

      jest.spyOn(service, 'connectProvider').mockReturnValue(
        throwError(() => ({
          message: 'Connection timeout',
          status: HttpStatus.REQUEST_TIMEOUT
        }))
      );

      await expect(controller.connectProvider(dto)).rejects.toThrow('Connection timeout');
    });
  });

  describe('disconnectProvider', () => {
    it('should successfully disconnect from provider', async () => {
      jest.spyOn(service, 'disconnectProvider').mockReturnValue(of(true));

      await controller.disconnectProvider(ProviderType.GOOGLE_WORKSPACE);

      expect(service.disconnectProvider).toHaveBeenCalledWith(
        ProviderType.GOOGLE_WORKSPACE,
        true
      );
    });

    it('should handle disconnection failure', async () => {
      jest.spyOn(service, 'disconnectProvider').mockReturnValue(
        throwError(() => ({
          message: 'Failed to disconnect',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }))
      );

      await expect(
        controller.disconnectProvider(ProviderType.GOOGLE_WORKSPACE)
      ).rejects.toThrow('Failed to disconnect');
    });
  });

  describe('getProviderStatus', () => {
    it('should return provider status successfully', async () => {
      const mockStatus = {
        success: true,
        provider: ProviderType.GOOGLE_WORKSPACE,
        status: ConnectionStatus.CONNECTED,
        metrics: {
          connectionTime: 100,
          retryCount: 0
        }
      };

      jest.spyOn(service, 'getProviderStatus').mockReturnValue(of(mockStatus));

      const result = await controller.getProviderStatus(ProviderType.GOOGLE_WORKSPACE);

      expect(result).toEqual(mockStatus);
      expect(service.getProviderStatus).toHaveBeenCalledWith(ProviderType.GOOGLE_WORKSPACE);
    });

    it('should handle provider not found', async () => {
      jest.spyOn(service, 'getProviderStatus').mockReturnValue(
        throwError(() => ({
          message: 'Provider not found',
          status: HttpStatus.NOT_FOUND
        }))
      );

      await expect(
        controller.getProviderStatus(ProviderType.GOOGLE_WORKSPACE)
      ).rejects.toThrow('Provider not found');
    });
  });

  describe('checkProviderHealth', () => {
    it('should return provider health status', async () => {
      const mockHealthStatus = {
        provider: ProviderType.GOOGLE_WORKSPACE,
        status: ConnectionStatus.CONNECTED,
        lastCheck: new Date(),
        metrics: {
          latency: 50,
          errorRate: 0,
          availability: 100
        }
      };

      jest.spyOn(service, 'monitorProviderHealth').mockReturnValue(of(mockHealthStatus));

      const result = await controller.checkProviderHealth(ProviderType.GOOGLE_WORKSPACE);

      expect(result).toEqual(mockHealthStatus);
      expect(service.monitorProviderHealth).toHaveBeenCalledWith(ProviderType.GOOGLE_WORKSPACE);
    });

    it('should handle health check failure', async () => {
      jest.spyOn(service, 'monitorProviderHealth').mockReturnValue(
        throwError(() => ({
          message: 'Health check failed',
          status: HttpStatus.SERVICE_UNAVAILABLE
        }))
      );

      await expect(
        controller.checkProviderHealth(ProviderType.GOOGLE_WORKSPACE)
      ).rejects.toThrow('Health check failed');
    });
  });

  describe('getProviderMetrics', () => {
    it('should return provider metrics successfully', async () => {
      const mockMetrics = {
        requestCount: 100,
        errorRate: 0.5,
        latency: 150,
        lastSync: new Date()
      };

      jest.spyOn(service, 'getProviderMetrics').mockReturnValue(of(mockMetrics));

      const result = await controller.getProviderMetrics(ProviderType.GOOGLE_WORKSPACE);

      expect(result).toEqual(mockMetrics);
      expect(service.getProviderMetrics).toHaveBeenCalledWith(ProviderType.GOOGLE_WORKSPACE);
    });

    it('should handle metrics retrieval failure', async () => {
      jest.spyOn(service, 'getProviderMetrics').mockReturnValue(
        throwError(() => ({
          message: 'Failed to get metrics',
          status: HttpStatus.INTERNAL_SERVER_ERROR
        }))
      );

      await expect(
        controller.getProviderMetrics(ProviderType.GOOGLE_WORKSPACE)
      ).rejects.toThrow('Failed to get metrics');
    });
  });
});