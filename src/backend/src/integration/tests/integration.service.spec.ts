// @nestjs/testing version ^10.0.0
import { Test, TestingModule } from '@nestjs/testing';
// rxjs version ^7.8.1
import { of, throwError, firstValueFrom } from 'rxjs';
// @angular/core/testing version ^17.0.0
import { fakeAsync, tick } from '@angular/core/testing';

import { IntegrationService } from '../integration.service';
import { IntegrationProvider, ProviderType, ConnectionStatus } from '../interfaces/provider.interface';

describe('IntegrationService', () => {
  let module: TestingModule;
  let service: IntegrationService;
  let googleWorkspaceMock: jest.Mocked<IntegrationProvider>;
  let quickBooksMock: jest.Mocked<IntegrationProvider>;
  let stripeMock: jest.Mocked<IntegrationProvider>;
  let configServiceMock: any;

  const mockConnectionMetrics = {
    latency: 100,
    requestCount: 50,
    errorRate: 0.5,
    lastSync: new Date()
  };

  beforeEach(async () => {
    // Initialize provider mocks
    googleWorkspaceMock = {
      providerType: ProviderType.GOOGLE_WORKSPACE,
      connectionStatus: ConnectionStatus.DISCONNECTED,
      connect: jest.fn(),
      disconnect: jest.fn(),
      validateCredentials: jest.fn(),
      fetchData: jest.fn(),
      syncData: jest.fn(),
      getConnectionMetrics: jest.fn()
    };

    quickBooksMock = {
      ...googleWorkspaceMock,
      providerType: ProviderType.QUICKBOOKS
    };

    stripeMock = {
      ...googleWorkspaceMock,
      providerType: ProviderType.STRIPE
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret'
        };
        return config[key];
      })
    };

    module = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: 'googleWorkspaceService', useValue: googleWorkspaceMock },
        { provide: 'quickBooksService', useValue: quickBooksMock },
        { provide: 'stripeService', useValue: stripeMock },
        { provide: 'configService', useValue: configServiceMock }
      ]
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Authentication', () => {
    const validCredentials = {
      clientId: 'test-client',
      clientSecret: 'test-secret'
    };

    it('should successfully authenticate with valid credentials', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(of(true));
      googleWorkspaceMock.getConnectionMetrics.mockReturnValue(of(mockConnectionMetrics));

      const result = await firstValueFrom(service.connectProvider(
        ProviderType.GOOGLE_WORKSPACE,
        validCredentials
      ));

      expect(result.success).toBe(true);
      expect(result.status).toBe(ConnectionStatus.CONNECTED);
      expect(googleWorkspaceMock.validateCredentials).toHaveBeenCalledWith(validCredentials);
    });

    it('should handle invalid credentials appropriately', async () => {
      const invalidCredentials = { clientId: 'invalid' };
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({
        valid: false,
        issues: ['Invalid client secret']
      }));

      await expect(
        firstValueFrom(service.connectProvider(ProviderType.GOOGLE_WORKSPACE, invalidCredentials))
      ).rejects.toThrow('Invalid credentials: Invalid client secret');
    });

    it('should handle connection timeouts', fakeAsync(() => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(new Promise(() => {})); // Never resolves

      const connectionPromise = firstValueFrom(service.connectProvider(
        ProviderType.GOOGLE_WORKSPACE,
        validCredentials,
        { timeout: 5000 }
      ));

      tick(6000);
      expect(connectionPromise).rejects.toThrow('Timeout');
    }));
  });

  describe('Connection Management', () => {
    it('should manage connection pool correctly', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(of(true));

      // Test multiple concurrent connections
      const connections = await Promise.all([
        firstValueFrom(service.connectProvider(ProviderType.GOOGLE_WORKSPACE, {})),
        firstValueFrom(service.connectProvider(ProviderType.GOOGLE_WORKSPACE, {})),
        firstValueFrom(service.connectProvider(ProviderType.GOOGLE_WORKSPACE, {}))
      ]);

      expect(connections.every(conn => conn.success)).toBe(true);
    });

    it('should implement retry logic for failed connections', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      let attempts = 0;
      googleWorkspaceMock.connect.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return throwError(() => new Error('Connection failed'));
        }
        return of(true);
      });

      const result = await firstValueFrom(service.connectProvider(
        ProviderType.GOOGLE_WORKSPACE,
        {},
        { retryAttempts: 3 }
      ));

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should handle rate limiting scenarios', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(throwError(() => ({
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      })));

      const result = await firstValueFrom(service.connectProvider(
        ProviderType.GOOGLE_WORKSPACE,
        {}
      ));

      expect(result.success).toBe(false);
      expect(result.status).toBe(ConnectionStatus.ERROR);
    });
  });

  describe('Monitoring', () => {
    it('should track connection metrics', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(of(true));
      googleWorkspaceMock.getConnectionMetrics.mockReturnValue(of(mockConnectionMetrics));

      const result = await firstValueFrom(service.monitorProviderHealth(
        ProviderType.GOOGLE_WORKSPACE
      ));

      expect(result.metrics.latency).toBe(mockConnectionMetrics.latency);
      expect(result.metrics.errorRate).toBe(mockConnectionMetrics.errorRate);
      expect(result.status).toBeDefined();
    });

    it('should handle monitoring failures gracefully', async () => {
      googleWorkspaceMock.getConnectionMetrics.mockReturnValue(
        throwError(() => new Error('Monitoring failed'))
      );

      await expect(
        firstValueFrom(service.monitorProviderHealth(ProviderType.GOOGLE_WORKSPACE))
      ).rejects.toThrow('Monitoring failed');
    });

    it('should calculate availability correctly', async () => {
      googleWorkspaceMock.validateCredentials.mockReturnValue(of({ valid: true }));
      googleWorkspaceMock.connect.mockReturnValue(of(true));
      googleWorkspaceMock.getConnectionMetrics.mockReturnValue(of({
        ...mockConnectionMetrics,
        errorRate: 5 // 5% error rate
      }));

      const result = await firstValueFrom(service.monitorProviderHealth(
        ProviderType.GOOGLE_WORKSPACE
      ));

      expect(result.metrics.availability).toBe(95); // 100 - 5 = 95% availability
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup resources on module destroy', async () => {
      const providers = [googleWorkspaceMock, quickBooksMock, stripeMock];
      providers.forEach(provider => {
        provider.disconnect.mockReturnValue(of(true));
      });

      await service.onModuleDestroy();

      providers.forEach(provider => {
        expect(provider.disconnect).toHaveBeenCalledWith(false);
      });
    });
  });
});