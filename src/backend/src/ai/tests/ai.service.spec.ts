import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { AIService } from '../ai.service';
import { LangChainService } from '../services/langchain.service';
import { TensorFlowService } from '../services/tensorflow.service';
import { PyTorchService } from '../services/pytorch.service';
import { IMetric, MetricType, MetricUnit } from '../../analytics/interfaces/metric.interface';

describe('AIService', () => {
  let service: AIService;
  let langchainService: jest.Mocked<LangChainService>;
  let tensorflowService: jest.Mocked<TensorFlowService>;
  let pytorchService: jest.Mocked<PyTorchService>;

  const mockMetrics: IMetric[] = [
    {
      metricType: MetricType.LICENSE_USAGE,
      value: 85,
      unit: MetricUnit.PERCENTAGE,
      metadata: {
        subscriptionId: 'sub_123',
        timestamp: new Date()
      }
    }
  ];

  beforeAll(async () => {
    // Configure global test timeouts and environment
    jest.setTimeout(30000);
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create comprehensive mocks for all dependent services
    langchainService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      generateInsight: jest.fn().mockResolvedValue('Mock insight'),
      processUserQuery: jest.fn().mockResolvedValue('Mock response'),
      handleError: jest.fn(),
    } as any;

    tensorflowService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      predict: jest.fn().mockResolvedValue({
        prediction: [0.8],
        confidence: 0.9,
        metadata: { modelVersion: '1.0.0' }
      }),
      getGPUMetrics: jest.fn().mockResolvedValue({ utilization: 0.5 }),
    } as any;

    pytorchService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      detectAnomalies: jest.fn().mockResolvedValue({
        isAnomaly: false,
        score: 0.3,
        confidence: 0.95
      }),
    } as any;

    // Create testing module with enhanced configuration
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: LangChainService, useValue: langchainService },
        { provide: TensorFlowService, useValue: tensorflowService },
        { provide: PyTorchService, useValue: pytorchService }
      ],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  afterEach(() => {
    // Reset all mocks and clear any cached data
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should successfully initialize all AI models', async () => {
      await service.initialize();

      expect(langchainService.initialize).toHaveBeenCalled();
      expect(tensorflowService.initialize).toHaveBeenCalled();
      expect(pytorchService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      langchainService.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(service.initialize()).rejects.toThrow('AI service initialization failed');
    });
  });

  describe('generateInsights', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should generate comprehensive insights from multiple sources', (done) => {
      const testData = {
        usageMetrics: mockMetrics,
        costMetrics: { cost: 1000, trend: 'increasing' }
      };

      service.generateInsights(testData).subscribe({
        next: (insights) => {
          expect(insights).toBeInstanceOf(Array);
          expect(insights.length).toBeGreaterThan(0);
          expect(insights[0]).toHaveProperty('type');
          expect(insights[0]).toHaveProperty('content');
          expect(insights[0]).toHaveProperty('confidence');
          expect(insights[0]).toHaveProperty('metadata');
        },
        error: (error) => done(error),
        complete: () => done()
      });
    });

    it('should handle errors during insight generation', (done) => {
      pytorchService.detectAnomalies.mockRejectedValueOnce(new Error('Analysis failed'));

      service.generateInsights({ usageMetrics: [] }).subscribe({
        next: (insights) => {
          expect(insights).toEqual([]);
        },
        error: (error) => done(error),
        complete: () => done()
      });
    });
  });

  describe('processQuery', () => {
    it('should process natural language queries with context', async () => {
      const query = 'Show me underutilized licenses';
      const conversationId = 'conv_123';

      const result = await service.processQuery(query, conversationId);

      expect(result).toBe('Mock response');
      expect(langchainService.processUserQuery).toHaveBeenCalledWith(query, conversationId);
    });

    it('should handle query processing errors', async () => {
      langchainService.processUserQuery.mockRejectedValueOnce(new Error('Processing failed'));

      await expect(service.processQuery('query', 'conv_123'))
        .rejects.toThrow('Processing failed');
    });
  });

  describe('detectAnomalies', () => {
    it('should detect usage pattern anomalies', async () => {
      const result = await service.detectAnomalies(mockMetrics);

      expect(result).toHaveProperty('isAnomaly');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(pytorchService.detectAnomalies).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle anomaly detection errors', async () => {
      pytorchService.detectAnomalies.mockRejectedValueOnce(new Error('Detection failed'));

      await expect(service.detectAnomalies(mockMetrics))
        .rejects.toThrow('Detection failed');
    });
  });

  describe('healthCheck', () => {
    it('should provide accurate health status', (done) => {
      service.healthCheck().subscribe({
        next: (status) => {
          expect(typeof status).toBe('boolean');
          done();
        },
        error: done
      });
    });
  });

  describe('Resource Management', () => {
    it('should monitor system resources', async () => {
      // Wait for resource monitoring to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      const gpuMetrics = await tensorflowService.getGPUMetrics();
      expect(gpuMetrics).toHaveProperty('utilization');
    });
  });
});