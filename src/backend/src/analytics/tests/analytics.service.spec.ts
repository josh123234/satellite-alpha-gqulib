import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { AnalyticsService } from '../analytics.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { MetricType } from '../interfaces/metric.interface';
import { CreateUsageMetricDto } from '../dto/usage-metric.dto';
import { UsageMetricEntity } from '../entities/usage-metric.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repository: jest.Mocked<AnalyticsRepository>;
  let cacheManager: jest.Mocked<Cache>;

  const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockSubscriptionId = '987fcdeb-51a2-43d7-9876-543210987654';

  const mockMetricData: CreateUsageMetricDto = {
    subscriptionId: mockSubscriptionId,
    metricType: MetricType.LICENSE_USAGE,
    value: 42,
    unit: 'users',
    timestamp: new Date()
  };

  const mockUsageMetric = new UsageMetricEntity({
    id: '456e7890-12d3-a456-426614174000',
    ...mockMetricData,
    organizationId: mockOrganizationId,
    source: 'analytics_service',
    metadata: {}
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepository,
          useFactory: () => ({
            createMetric: jest.fn(),
            findBySubscription: jest.fn(),
            findByDateRange: jest.fn(),
            aggregateMetrics: jest.fn(),
            onApplicationShutdown: jest.fn()
          })
        },
        {
          provide: CACHE_MANAGER,
          useFactory: () => ({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn()
          })
        }
      ]
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    repository = module.get(AnalyticsRepository);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMetric', () => {
    it('should create a new metric with organization context', async () => {
      repository.createMetric.mockResolvedValue(mockUsageMetric);

      const result = await service.createMetric(mockMetricData, mockOrganizationId);

      expect(repository.createMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockMetricData,
          organizationId: mockOrganizationId,
          source: 'analytics_service'
        })
      );
      expect(result).toEqual(mockUsageMetric);
    });

    it('should throw error when organization context is missing', async () => {
      await expect(service.createMetric(mockMetricData, '')).rejects
        .toThrow('Organization context is required');
    });

    it('should retry on failure up to max attempts', async () => {
      const error = new Error('Database error');
      repository.createMetric
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockUsageMetric);

      const result = await service.createMetric(mockMetricData, mockOrganizationId);

      expect(repository.createMetric).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockUsageMetric);
    });

    it('should invalidate related caches after creation', async () => {
      repository.createMetric.mockResolvedValue(mockUsageMetric);

      await service.createMetric(mockMetricData, mockOrganizationId);

      expect(cacheManager.del).toHaveBeenCalledWith(
        expect.stringContaining(mockSubscriptionId)
      );
    });
  });

  describe('getAggregatedMetrics', () => {
    const mockAggregation = {
      total: 100,
      average: 50,
      peak: 75,
      trend: 25
    };

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should return cached aggregated metrics when available', async () => {
      cacheManager.get.mockResolvedValue(mockAggregation);

      const result = await service.getAggregatedMetrics(
        mockSubscriptionId,
        mockOrganizationId,
        MetricType.LICENSE_USAGE,
        startDate,
        endDate
      );

      expect(cacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining(`metrics_${mockOrganizationId}_${mockSubscriptionId}`)
      );
      expect(result).toEqual(mockAggregation);
      expect(repository.aggregateMetrics).not.toHaveBeenCalled();
    });

    it('should fetch and cache aggregated metrics when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.aggregateMetrics.mockResolvedValue(mockAggregation);

      const result = await service.getAggregatedMetrics(
        mockSubscriptionId,
        mockOrganizationId,
        MetricType.LICENSE_USAGE,
        startDate,
        endDate
      );

      expect(repository.aggregateMetrics).toHaveBeenCalledWith(
        mockSubscriptionId,
        MetricType.LICENSE_USAGE,
        startDate,
        endDate
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        mockAggregation,
        300
      );
      expect(result).toEqual(mockAggregation);
    });
  });

  describe('getUsageMetrics', () => {
    const mockMetrics: [UsageMetricEntity[], number] = [[mockUsageMetric], 1];

    it('should return paginated usage metrics with cache hit', async () => {
      cacheManager.get.mockResolvedValue(mockMetrics);

      const result = await service.getUsageMetrics(
        mockSubscriptionId,
        mockOrganizationId,
        1,
        50
      );

      expect(cacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining(`usage_metrics_${mockOrganizationId}_${mockSubscriptionId}`)
      );
      expect(result).toEqual(mockMetrics);
      expect(repository.findByDateRange).not.toHaveBeenCalled();
    });

    it('should fetch and cache metrics on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findByDateRange.mockResolvedValue(mockMetrics);

      const result = await service.getUsageMetrics(
        mockSubscriptionId,
        mockOrganizationId,
        1,
        50
      );

      expect(repository.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        1,
        50
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        mockMetrics,
        300
      );
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should cleanup resources on shutdown', async () => {
      await service.onApplicationShutdown();

      expect(repository.onApplicationShutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      repository.onApplicationShutdown.mockRejectedValue(new Error('Shutdown error'));

      await expect(service.onApplicationShutdown()).resolves.not.toThrow();
    });
  });
});