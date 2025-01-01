import { Injectable } from '@nestjs/common'; // v10.0.0
import { Observable, BehaviorSubject, interval, combineLatest } from 'rxjs'; // v7.8.0
import { map, catchError, tap, filter } from 'rxjs/operators';

import { AIModel } from './interfaces/model.interface';
import { LangChainService } from './services/langchain.service';
import { TensorFlowService } from './services/tensorflow.service';
import { PyTorchService } from './services/pytorch.service';
import { aiConfig } from '../config/ai.config';
import { IMetric } from '../analytics/interfaces/metric.interface';

/**
 * Interface for resource monitoring metrics
 */
interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  gpuUtilization?: number;
  timestamp: Date;
}

/**
 * Interface for AI-generated insights
 */
interface AIInsightDTO {
  type: string;
  content: string;
  confidence: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

/**
 * Core AI service that orchestrates various AI capabilities with enhanced
 * real-time processing and resilience features
 */
@Injectable()
export class AIService {
  private readonly modelHealthCheck: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private readonly resourceMonitor: BehaviorSubject<ResourceMetrics> = new BehaviorSubject<ResourceMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    timestamp: new Date()
  });

  constructor(
    private readonly langchainService: LangChainService,
    private readonly tensorflowService: TensorFlowService,
    private readonly pytorchService: PyTorchService
  ) {
    this.setupMonitoring();
  }

  /**
   * Initializes all AI models with enhanced parallel processing and health checks
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize models in parallel with enhanced error handling
      await Promise.all([
        this.initializeModel(this.langchainService, aiConfig.langchain),
        this.initializeModel(this.tensorflowService, aiConfig.tensorflow),
        this.initializeModel(this.pytorchService, aiConfig.pytorch)
      ]);

      this.modelHealthCheck.next(true);
    } catch (error) {
      this.modelHealthCheck.next(false);
      throw new Error(`AI service initialization failed: ${error.message}`);
    }
  }

  /**
   * Generates AI insights with enhanced real-time processing
   * @param data Input data for insight generation
   * @returns Observable stream of AI-generated insights
   */
  public generateInsights(data: Record<string, any>): Observable<AIInsightDTO[]> {
    return new Observable(observer => {
      if (!this.modelHealthCheck.getValue()) {
        observer.error(new Error('AI models not properly initialized'));
        return;
      }

      // Combine multiple insight sources
      combineLatest([
        this.generateUsageInsights(data),
        this.generateCostInsights(data),
        this.generateOptimizationInsights(data)
      ]).pipe(
        map(([usageInsights, costInsights, optimizationInsights]) => 
          [...usageInsights, ...costInsights, ...optimizationInsights]
        ),
        catchError(error => {
          this.handleError('Insight generation failed', error);
          return [];
        })
      ).subscribe(observer);
    });
  }

  /**
   * Processes natural language queries with context awareness
   * @param query User query string
   * @param conversationId Unique conversation identifier
   * @returns Promise with processed response
   */
  public async processQuery(query: string, conversationId: string): Promise<string> {
    try {
      return await this.langchainService.processUserQuery(query, conversationId);
    } catch (error) {
      this.handleError('Query processing failed', error);
      throw error;
    }
  }

  /**
   * Detects usage pattern anomalies with enhanced accuracy
   * @param metrics Array of usage metrics
   * @returns Promise with anomaly detection results
   */
  public async detectAnomalies(metrics: IMetric[]): Promise<any> {
    try {
      return await this.pytorchService.detectAnomalies(metrics);
    } catch (error) {
      this.handleError('Anomaly detection failed', error);
      throw error;
    }
  }

  /**
   * Provides current health status of AI services
   * @returns Observable of health status
   */
  public healthCheck(): Observable<boolean> {
    return this.modelHealthCheck.asObservable();
  }

  private async initializeModel(model: AIModel, config: any): Promise<void> {
    try {
      await model.initialize(config);
    } catch (error) {
      this.handleError(`Model initialization failed: ${config.modelName}`, error);
      throw error;
    }
  }

  private setupMonitoring(): void {
    // Monitor system resources every 30 seconds
    interval(30000).pipe(
      tap(() => this.updateResourceMetrics()),
      catchError(error => {
        this.handleError('Resource monitoring failed', error);
        return interval(30000);
      })
    ).subscribe();
  }

  private async updateResourceMetrics(): Promise<void> {
    const metrics: ResourceMetrics = {
      cpuUsage: process.cpuUsage().user / 1000000,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      timestamp: new Date()
    };

    // Add GPU metrics if available
    try {
      const gpuMetrics = await this.tensorflowService.getGPUMetrics();
      if (gpuMetrics) {
        metrics.gpuUtilization = gpuMetrics.utilization;
      }
    } catch {
      // GPU metrics unavailable
    }

    this.resourceMonitor.next(metrics);
  }

  private async generateUsageInsights(data: Record<string, any>): Promise<AIInsightDTO[]> {
    try {
      const predictions = await this.pytorchService.detectAnomalies(data.usageMetrics);
      return this.formatInsights('usage', predictions);
    } catch (error) {
      this.handleError('Usage insight generation failed', error);
      return [];
    }
  }

  private async generateCostInsights(data: Record<string, any>): Promise<AIInsightDTO[]> {
    try {
      const analysis = await this.tensorflowService.predict(data.costMetrics);
      return this.formatInsights('cost', analysis);
    } catch (error) {
      this.handleError('Cost insight generation failed', error);
      return [];
    }
  }

  private async generateOptimizationInsights(data: Record<string, any>): Promise<AIInsightDTO[]> {
    try {
      const insight = await this.langchainService.generateInsight(data);
      return this.formatInsights('optimization', insight);
    } catch (error) {
      this.handleError('Optimization insight generation failed', error);
      return [];
    }
  }

  private formatInsights(type: string, data: any): AIInsightDTO[] {
    return [{
      type,
      content: typeof data === 'string' ? data : JSON.stringify(data),
      confidence: data.confidence || 0.8,
      metadata: {
        source: type,
        timestamp: new Date(),
        modelVersion: this.getModelVersion(type)
      },
      timestamp: new Date()
    }];
  }

  private getModelVersion(type: string): string {
    const versions = {
      usage: '1.0.0',
      cost: '1.0.0',
      optimization: '1.0.0'
    };
    return versions[type] || '1.0.0';
  }

  private handleError(message: string, error: Error): void {
    console.error(`${message}: ${error.message}`);
    // Could add additional error handling logic here
  }
}