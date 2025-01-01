import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { BadRequestException } from '@nestjs/common';
import { faker } from '@faker-js/faker'; // ^8.0.0

import { AnalyticsController } from '../analytics.controller';
import { AnalyticsService } from '../analytics.service';
import { CreateUsageMetricDto } from '../dto/usage-metric.dto';
import { MetricType } from '../interfaces/metric.interface';
import { UsageMetricEntity } from '../entities/usage-metric.entity';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  // Mock implementation of AnalyticsService
  const mockAnalyticsService = {
    createMetric: jest.fn(),
    getUsageMetrics: jest.fn(),
    getAggregatedMetrics: jest.fn()
  };

  // Test data factory functions
  const createTestMetric = (): CreateUsageMetricDto => ({
    subscriptionId: faker.string.uuid(),
    metricType: MetricType.ACTIVE_USERS,
    value: faker.number.int({ min: 1, max: 1000 }),
    unit: 'users',
    timestamp: faker.date.recent()
  });

  const createTestMetricEntity = (): UsageMetricEntity => ({
    id: faker.string.uuid(),
    subscriptionId: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    metricType: MetricType.ACTIVE_USERS,
    value: faker.number.int({ min: 1, max: 1000 }),
    unit: 'users',
    timestamp: faker.date.recent(),
    source: 'test',
    metadata: {},
    subscription: null,
    createdAt: faker.date.recent()
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService
        }
      ]
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createMetric', () => {
    it('should create a new metric successfully with valid data', async () => {
      const testMetric = createTestMetric();
      const expectedResult = createTestMetricEntity();
      
      mockAnalyticsService.createMetric.mockResolvedValue(expectedResult);

      const result = await controller.createMetric(testMetric);

      expect(result).toBe(expectedResult);
      expect(service.createMetric).toHaveBeenCalledWith(testMetric, 'system');
    });

    it('should validate required metric fields', async () => {
      const invalidMetric = { ...createTestMetric(), value: null };
      
      await expect(controller.createMetric(invalidMetric as CreateUsageMetricDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should handle service errors gracefully', async () => {
      const testMetric = createTestMetric();
      mockAnalyticsService.createMetric.mockRejectedValue(new Error('Service error'));

      await expect(controller.createMetric(testMetric))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should validate metric value ranges', async () => {
      const invalidMetric = { ...createTestMetric(), value: -1 };
      
      await expect(controller.createMetric(invalidMetric))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('getMetricsBySubscription', () => {
    const subscriptionId = faker.string.uuid();
    const testMetrics = Array(3).fill(null).map(() => createTestMetricEntity());

    it('should return paginated metrics for valid subscription', async () => {
      mockAnalyticsService.getUsageMetrics.mockResolvedValue([testMetrics, testMetrics.length]);

      const result = await controller.getMetricsBySubscription(subscriptionId);

      expect(result.data).toEqual(testMetrics);
      expect(result.totalItems).toBe(testMetrics.length);
      expect(service.getUsageMetrics).toHaveBeenCalledWith(
        subscriptionId,
        'system',
        1,
        50
      );
    });

    it('should handle invalid subscription IDs', async () => {
      mockAnalyticsService.getUsageMetrics.mockRejectedValue(new Error('Invalid subscription'));

      await expect(controller.getMetricsBySubscription('invalid-id'))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should validate pagination parameters', async () => {
      await expect(controller.getMetricsBySubscription(
        subscriptionId,
        undefined,
        -1,
        0
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle empty result sets', async () => {
      mockAnalyticsService.getUsageMetrics.mockResolvedValue([[], 0]);

      const result = await controller.getMetricsBySubscription(subscriptionId);

      expect(result.data).toEqual([]);
      expect(result.totalItems).toBe(0);
    });
  });

  describe('getMetricsByDateRange', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const testMetrics = Array(3).fill(null).map(() => createTestMetricEntity());

    it('should return metrics within valid date range', async () => {
      mockAnalyticsService.getUsageMetrics.mockResolvedValue([testMetrics, testMetrics.length]);

      const result = await controller.getMetricsByDateRange(startDate, endDate);

      expect(result.data).toEqual(testMetrics);
      expect(service.getUsageMetrics).toHaveBeenCalledWith(
        undefined,
        'system',
        1,
        50
      );
    });

    it('should validate date range format', async () => {
      await expect(controller.getMetricsByDateRange(
        new Date('invalid'),
        endDate
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid date ranges', async () => {
      await expect(controller.getMetricsByDateRange(
        endDate,
        startDate
      )).rejects.toThrow(BadRequestException);
    });

    it('should implement proper pagination', async () => {
      const page = 2;
      const limit = 10;
      
      await controller.getMetricsByDateRange(
        startDate,
        endDate,
        undefined,
        page,
        limit
      );

      expect(service.getUsageMetrics).toHaveBeenCalledWith(
        undefined,
        'system',
        page,
        limit
      );
    });
  });

  describe('getAggregatedMetrics', () => {
    const subscriptionId = faker.string.uuid();
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const type = MetricType.ACTIVE_USERS;

    const mockAggregation = {
      total: 1000,
      average: 100,
      peak: 150,
      trend: 5.5
    };

    it('should return correct aggregations by type', async () => {
      mockAnalyticsService.getAggregatedMetrics.mockResolvedValue(mockAggregation);

      const result = await controller.getAggregatedMetrics(
        subscriptionId,
        type,
        startDate,
        endDate
      );

      expect(result).toEqual(mockAggregation);
      expect(service.getAggregatedMetrics).toHaveBeenCalledWith(
        subscriptionId,
        'system',
        type,
        startDate,
        endDate
      );
    });

    it('should validate aggregation parameters', async () => {
      await expect(controller.getAggregatedMetrics(
        'invalid-id',
        type,
        startDate,
        endDate
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid time periods', async () => {
      await expect(controller.getAggregatedMetrics(
        subscriptionId,
        type,
        endDate,
        startDate
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.getAggregatedMetrics.mockRejectedValue(
        new Error('Aggregation failed')
      );

      await expect(controller.getAggregatedMetrics(
        subscriptionId,
        type,
        startDate,
        endDate
      )).rejects.toThrow(BadRequestException);
    });
  });
});