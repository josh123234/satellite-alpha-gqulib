import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { createMock } from '@golevelup/ts-jest'; // v0.4.0
import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // v29.0.0

import { AIController } from '../ai.controller';
import { AIService } from '../ai.service';
import { AIInsightDTO, InsightType, InsightPriority } from '../dto/ai-insight.dto';
import { PaginatedDto } from '../../common/decorators/api-paginated-response.decorator';
import { IMetric, MetricType, MetricUnit } from '../../analytics/interfaces/metric.interface';
import { Observable, of } from 'rxjs';

describe('AIController', () => {
  let controller: AIController;
  let aiService: jest.Mocked<AIService>;

  const mockInsightDTO = new AIInsightDTO();
  mockInsightDTO.id = '123e4567-e89b-12d3-a456-426614174000';
  mockInsightDTO.type = InsightType.COST_OPTIMIZATION;
  mockInsightDTO.title = 'Test Insight';
  mockInsightDTO.description = 'Test Description';
  mockInsightDTO.priority = InsightPriority.HIGH;
  mockInsightDTO.recommendations = ['Test Recommendation'];
  mockInsightDTO.potentialSavings = 1000;
  mockInsightDTO.validUntil = new Date(Date.now() + 86400000);
  mockInsightDTO.tags = ['test'];
  mockInsightDTO.category = 'Test Category';
  mockInsightDTO.source = {
    modelId: 'test_model',
    confidence: 0.95,
    timestamp: new Date(),
    modelVersion: '1.0.0',
    metrics: {
      accuracy: 0.9,
      loss: 0.1,
      timestamp: new Date()
    }
  };

  const mockMetric: IMetric = {
    metricType: MetricType.LICENSE_USAGE,
    value: 100,
    unit: MetricUnit.COUNT,
    metadata: {}
  };

  beforeEach(async () => {
    aiService = createMock<AIService>({
      generateInsights: jest.fn().mockReturnValue(of([mockInsightDTO])),
      processQuery: jest.fn().mockResolvedValue('Test response'),
      detectAnomalies: jest.fn().mockResolvedValue([mockInsightDTO])
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        {
          provide: AIService,
          useValue: aiService
        }
      ]
    }).compile();

    controller = module.get<AIController>(AIController);
  });

  describe('generateInsights', () => {
    const mockData = { subscriptionId: '123', metrics: [mockMetric] };

    it('should successfully generate insights', async () => {
      const result = await controller.generateInsights(mockData);
      
      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toMatchObject(mockInsightDTO.toResponse());
      expect(aiService.generateInsights).toHaveBeenCalledWith(mockData);
    });

    it('should handle invalid input data', async () => {
      aiService.generateInsights.mockImplementation(() => {
        throw new Error('Invalid input');
      });

      await expect(controller.generateInsights({}))
        .rejects
        .toThrow('Insight generation failed: Invalid input');
    });

    it('should retry on temporary failures', async () => {
      let attempts = 0;
      aiService.generateInsights.mockImplementation(() => {
        if (attempts++ < 2) {
          throw new Error('Temporary failure');
        }
        return of([mockInsightDTO]);
      });

      const result = await controller.generateInsights(mockData);
      expect(result[0]).toMatchObject(mockInsightDTO.toResponse());
      expect(aiService.generateInsights).toHaveBeenCalledTimes(3);
    });
  });

  describe('processQuery', () => {
    const mockQuery = {
      query: 'Test query',
      conversationId: '123'
    };

    it('should successfully process query', async () => {
      const result = await controller.processQuery(mockQuery);
      
      expect(result).toEqual({
        response: 'Test response',
        confidence: 0.95
      });
      expect(aiService.processQuery).toHaveBeenCalledWith(
        mockQuery.query,
        mockQuery.conversationId
      );
    });

    it('should handle invalid query format', async () => {
      aiService.processQuery.mockRejectedValue(new Error('Invalid query format'));

      await expect(controller.processQuery({ query: '', conversationId: '' }))
        .rejects
        .toThrow('Query processing failed: Invalid query format');
    });

    it('should validate required query parameters', async () => {
      await expect(controller.processQuery({ query: '', conversationId: null }))
        .rejects
        .toThrow();
    });
  });

  describe('getAnomalies', () => {
    const mockQueryOptions = {
      page: 1,
      pageSize: 10
    };

    it('should successfully retrieve anomalies', async () => {
      const result = await controller.getAnomalies(mockQueryOptions);
      
      expect(result).toBeInstanceOf(PaginatedDto);
      expect(result.data[0]).toMatchObject(mockInsightDTO.toResponse());
      expect(result.page).toBe(mockQueryOptions.page);
      expect(result.pageSize).toBe(mockQueryOptions.pageSize);
    });

    it('should handle pagination parameters', async () => {
      const customOptions = {
        page: 2,
        pageSize: 20
      };

      const result = await controller.getAnomalies(customOptions);
      
      expect(result.page).toBe(customOptions.page);
      expect(result.pageSize).toBe(customOptions.pageSize);
    });

    it('should handle empty results', async () => {
      aiService.detectAnomalies.mockResolvedValue([]);

      const result = await controller.getAnomalies(mockQueryOptions);
      
      expect(result.data).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('should handle detection errors', async () => {
      aiService.detectAnomalies.mockRejectedValue(new Error('Detection failed'));

      await expect(controller.getAnomalies(mockQueryOptions))
        .rejects
        .toThrow('Anomaly detection failed: Detection failed');
    });

    it('should validate pagination parameters', async () => {
      await expect(controller.getAnomalies({ page: 0, pageSize: -1 }))
        .rejects
        .toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle service unavailability', async () => {
      aiService.generateInsights.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(controller.generateInsights({}))
        .rejects
        .toThrow('Insight generation failed: Service unavailable');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.name = 'ThrottlerException';
      aiService.processQuery.mockRejectedValue(rateLimitError);

      await expect(controller.processQuery({ query: 'test', conversationId: '123' }))
        .rejects
        .toThrow('Too many requests');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      aiService.detectAnomalies.mockRejectedValue(validationError);

      await expect(controller.getAnomalies({ page: 1, pageSize: 10 }))
        .rejects
        .toThrow('Validation failed');
    });
  });
});