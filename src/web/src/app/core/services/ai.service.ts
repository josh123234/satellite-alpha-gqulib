import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, catchError, tap, retry, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IAnalyticsMetric, MetricType } from '../../shared/models/analytics.model';

/**
 * Interface for AI insight request parameters
 */
export interface IAIInsightRequest {
  type: string;
  subscriptionId: string;
  filters?: Record<string, unknown>;
  timeframe: number;
  forceRefresh?: boolean;
  options?: {
    confidence?: number;
    maxRecommendations?: number;
    includeMetadata?: boolean;
  };
}

/**
 * Interface for AI insight response
 */
export interface IAIInsightResponse {
  id: string;
  type: string;
  title: string;
  description: string;
  recommendations: string[];
  potentialSavings: number;
  validUntil: Date;
  metadata: {
    modelVersion: string;
    dataPoints: number;
    analysisTimestamp: string;
  };
  confidence: number;
  modelVersion: string;
}

/**
 * Custom error types for AI service
 */
export enum AIErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  API = 'API_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR'
}

/**
 * Enhanced service for handling AI-related functionality
 * @version 1.0.0
 */
@Injectable({
  providedIn: 'root'
})
export class AIService {
  private readonly insightsSubject = new BehaviorSubject<IAIInsightResponse[]>([]);
  public readonly insights$ = this.insightsSubject.asObservable().pipe(
    distinctUntilChanged()
  );

  private readonly apiEndpoint: string;
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly maxRetries = 3;
  private readonly requestDebounceTime = 300; // 300ms

  constructor(private http: HttpClient) {
    this.apiEndpoint = environment.ai.modelEndpoint;
    this.validateConfiguration();
  }

  /**
   * Validates the service configuration
   * @private
   * @throws Error if configuration is invalid
   */
  private validateConfiguration(): void {
    if (!this.apiEndpoint) {
      throw new Error('AI service endpoint not configured');
    }
  }

  /**
   * Retrieves AI-generated insights with caching
   * @param request The insight request parameters
   * @returns Observable of AI insights
   */
  public getInsights(request: IAIInsightRequest): Observable<IAIInsightResponse[]> {
    const cacheKey = this.generateCacheKey(request);

    // Return cached data if valid and refresh not forced
    if (!request.forceRefresh) {
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return of(cachedData);
      }
    }

    return this.http.get<IAIInsightResponse[]>(`${this.apiEndpoint}/insights`, {
      params: this.buildRequestParams(request)
    }).pipe(
      debounceTime(this.requestDebounceTime),
      retry({
        count: this.maxRetries,
        delay: this.getRetryDelay
      }),
      map(response => this.validateAndTransformResponse(response)),
      tap(insights => {
        this.updateCache(cacheKey, insights);
        this.insightsSubject.next(insights);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Generates cost and usage optimization recommendations
   * @param subscriptionId The subscription ID
   * @param options Additional options for recommendation generation
   * @returns Observable of recommendations
   */
  public generateRecommendations(
    subscriptionId: string,
    options: { confidence?: number; timeframe?: number } = {}
  ): Observable<IAIInsightResponse> {
    if (!subscriptionId) {
      return throwError(() => this.createError(AIErrorType.VALIDATION, 'Subscription ID is required'));
    }

    const request = {
      subscriptionId,
      type: 'OPTIMIZATION',
      timeframe: options.timeframe || 30,
      options: {
        confidence: options.confidence || 0.8,
        maxRecommendations: 5,
        includeMetadata: true
      }
    };

    return this.http.post<IAIInsightResponse>(
      `${this.apiEndpoint}/recommendations`,
      request
    ).pipe(
      retry({
        count: this.maxRetries,
        delay: this.getRetryDelay
      }),
      map(response => this.validateAndTransformResponse([response])[0]),
      catchError(this.handleError)
    );
  }

  /**
   * Generates a cache key for the request
   * @private
   */
  private generateCacheKey(request: IAIInsightRequest): string {
    return `${request.type}-${request.subscriptionId}-${request.timeframe}`;
  }

  /**
   * Retrieves cached data if valid
   * @private
   */
  private getCachedData(key: string): IAIInsightResponse[] | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Updates the cache with new data
   * @private
   */
  private updateCache(key: string, data: IAIInsightResponse[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Builds request parameters
   * @private
   */
  private buildRequestParams(request: IAIInsightRequest): Record<string, string> {
    return {
      type: request.type,
      subscriptionId: request.subscriptionId,
      timeframe: request.timeframe.toString(),
      ...(request.filters && { filters: JSON.stringify(request.filters) }),
      ...(request.options && { options: JSON.stringify(request.options) })
    };
  }

  /**
   * Validates and transforms API response
   * @private
   */
  private validateAndTransformResponse(response: IAIInsightResponse[]): IAIInsightResponse[] {
    return response.map(insight => ({
      ...insight,
      validUntil: new Date(insight.validUntil),
      metadata: {
        ...insight.metadata,
        analysisTimestamp: new Date(insight.metadata.analysisTimestamp).toISOString()
      }
    }));
  }

  /**
   * Calculates retry delay using exponential backoff
   * @private
   */
  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  /**
   * Creates a standardized error object
   * @private
   */
  private createError(type: AIErrorType, message: string): Error {
    return new Error(JSON.stringify({ type, message }));
  }

  /**
   * Handles HTTP errors
   * @private
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorType: AIErrorType;
    let message: string;

    if (error.status === 429) {
      errorType = AIErrorType.RATE_LIMIT;
      message = 'AI service rate limit exceeded';
    } else if (error.status === 408) {
      errorType = AIErrorType.TIMEOUT;
      message = 'AI service request timeout';
    } else if (error.status === 400) {
      errorType = AIErrorType.VALIDATION;
      message = 'Invalid request parameters';
    } else {
      errorType = AIErrorType.API;
      message = 'AI service error occurred';
    }

    return throwError(() => this.createError(errorType, message));
  }
}