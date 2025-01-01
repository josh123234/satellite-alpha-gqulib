/**
 * @fileoverview Test suite for the Discovery Controller
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing'; // @nestjs/testing ^10.x
import { HttpStatus } from '@nestjs/common'; // @nestjs/common ^10.x
import { of, throwError } from 'rxjs'; // rxjs ^7.x
import { UUID } from 'crypto';

import { DiscoveryController } from '../discovery.controller';
import { DiscoveryService } from '../discovery.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { ISubscription, SubscriptionStatus, BillingCycle } from '../interfaces/subscription.interface';

// Mock the auth guard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(() => true)
}));

describe('DiscoveryController', () => {
  let controller: DiscoveryController;
  let service: DiscoveryService;

  const testOrganizationId: UUID = 'org-123' as UUID;
  
  const testSubscription: ISubscription = {
    id: 'test-uuid' as UUID,
    organizationId: testOrganizationId,
    name: 'Test Subscription',
    description: 'Test Description',
    provider: 'Test Provider',
    cost: 100,
    billingCycle: BillingCycle.MONTHLY,
    renewalDate: new Date('2024-12-31'),
    status: SubscriptionStatus.ACTIVE,
    totalLicenses: 10,
    usedLicenses: 5,
    metadata: {},
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockDiscoveryService = {
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    discoverSubscriptions: jest.fn(),
    getUpcomingRenewals: jest.fn(),
    getUnderUtilizedSubscriptions: jest.fn(),
    analyzeUsagePatterns: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
      providers: [
        {
          provide: DiscoveryService,
          useValue: mockDiscoveryService
        }
      ]
    }).compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const createDto: CreateSubscriptionDto = {
      name: 'Test Subscription',
      description: 'Test Description',
      provider: 'Test Provider',
      cost: 100,
      billingCycle: BillingCycle.MONTHLY,
      totalLicenses: 10,
      metadata: {}
    };

    it('should successfully create a subscription', async () => {
      mockDiscoveryService.createSubscription.mockResolvedValue(testSubscription);

      const result = await controller.createSubscription(createDto, testOrganizationId);

      expect(result).toEqual(testSubscription);
      expect(mockDiscoveryService.createSubscription).toHaveBeenCalledWith(createDto, testOrganizationId);
    });

    it('should handle validation errors', async () => {
      const invalidDto = { ...createDto, cost: -100 };
      mockDiscoveryService.createSubscription.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.createSubscription(invalidDto, testOrganizationId))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('discoverSubscriptions', () => {
    it('should successfully discover subscriptions', async () => {
      mockDiscoveryService.discoverSubscriptions.mockReturnValue(of([testSubscription]));

      const result = await controller.discoverSubscriptions(testOrganizationId);

      expect(result).toEqual([testSubscription]);
      expect(mockDiscoveryService.discoverSubscriptions).toHaveBeenCalledWith(testOrganizationId);
    });

    it('should handle discovery errors', async () => {
      mockDiscoveryService.discoverSubscriptions.mockReturnValue(throwError(() => new Error('Discovery failed')));

      await expect(controller.discoverSubscriptions(testOrganizationId))
        .rejects.toThrow('Discovery failed');
    });
  });

  describe('getUpcomingRenewals', () => {
    it('should return upcoming renewals with default days', async () => {
      mockDiscoveryService.getUpcomingRenewals.mockResolvedValue([testSubscription]);

      const result = await controller.getUpcomingRenewals(testOrganizationId);

      expect(result).toEqual([testSubscription]);
      expect(mockDiscoveryService.getUpcomingRenewals).toHaveBeenCalledWith(testOrganizationId, 30);
    });

    it('should return upcoming renewals with custom days', async () => {
      mockDiscoveryService.getUpcomingRenewals.mockResolvedValue([testSubscription]);

      const result = await controller.getUpcomingRenewals(testOrganizationId, 60);

      expect(result).toEqual([testSubscription]);
      expect(mockDiscoveryService.getUpcomingRenewals).toHaveBeenCalledWith(testOrganizationId, 60);
    });
  });

  describe('getUnderUtilizedSubscriptions', () => {
    it('should return under-utilized subscriptions with default threshold', async () => {
      mockDiscoveryService.getUnderUtilizedSubscriptions.mockResolvedValue([testSubscription]);

      const result = await controller.getUnderUtilizedSubscriptions(testOrganizationId);

      expect(result).toEqual([testSubscription]);
      expect(mockDiscoveryService.getUnderUtilizedSubscriptions).toHaveBeenCalledWith(testOrganizationId, 30);
    });

    it('should return under-utilized subscriptions with custom threshold', async () => {
      mockDiscoveryService.getUnderUtilizedSubscriptions.mockResolvedValue([testSubscription]);

      const result = await controller.getUnderUtilizedSubscriptions(testOrganizationId, 50);

      expect(result).toEqual([testSubscription]);
      expect(mockDiscoveryService.getUnderUtilizedSubscriptions).toHaveBeenCalledWith(testOrganizationId, 50);
    });
  });

  describe('updateSubscription', () => {
    const updateDto = {
      name: 'Updated Subscription',
      cost: 200
    };

    it('should successfully update a subscription', async () => {
      const updatedSubscription = { ...testSubscription, ...updateDto };
      mockDiscoveryService.updateSubscription.mockResolvedValue(updatedSubscription);

      const result = await controller.updateSubscription(testSubscription.id, updateDto, testOrganizationId);

      expect(result).toEqual(updatedSubscription);
      expect(mockDiscoveryService.updateSubscription).toHaveBeenCalledWith(
        testSubscription.id,
        updateDto,
        testOrganizationId
      );
    });

    it('should handle update errors', async () => {
      mockDiscoveryService.updateSubscription.mockRejectedValue(new Error('Update failed'));

      await expect(controller.updateSubscription(testSubscription.id, updateDto, testOrganizationId))
        .rejects.toThrow('Update failed');
    });
  });

  describe('getSubscriptionAnalytics', () => {
    const analyticsOptions = {
      timeframe: 30,
      threshold: 50,
      includeInactive: false
    };

    it('should return subscription analytics', async () => {
      const mockAnalytics = {
        subscriptionId: testSubscription.id,
        utilizationRate: 50,
        costPerUser: 20,
        recommendations: ['Optimize license count'],
        trends: { utilizationTrend: 5 },
        lastUpdated: new Date()
      };

      mockDiscoveryService.analyzeUsagePatterns.mockResolvedValue(mockAnalytics);

      const result = await controller.getSubscriptionAnalytics(
        testSubscription.id,
        testOrganizationId,
        analyticsOptions
      );

      expect(result).toEqual(mockAnalytics);
      expect(mockDiscoveryService.analyzeUsagePatterns).toHaveBeenCalledWith(
        testSubscription.id,
        analyticsOptions
      );
    });

    it('should handle analytics errors', async () => {
      mockDiscoveryService.analyzeUsagePatterns.mockRejectedValue(new Error('Analytics failed'));

      await expect(controller.getSubscriptionAnalytics(
        testSubscription.id,
        testOrganizationId,
        analyticsOptions
      )).rejects.toThrow('Analytics failed');
    });
  });
});