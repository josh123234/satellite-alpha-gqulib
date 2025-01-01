/**
 * @fileoverview Enhanced analytics service implementing core analytics functionality
 * with advanced caching, multi-tenant support, and comprehensive error handling.
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^10.0.0
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'; // ^2.0.0
import { Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { CreateUsageMetricDto } from './dto/usage-metric.dto';
import { MetricType } from './interfaces/metric.interface';
import { UsageMetricEntity } from './entities/usage-metric.entity';

@Injectable()
export class AnalyticsService implements OnApplicationShutdown {
    private readonly logger = new Logger(AnalyticsService.name);
    private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes
    private readonly MAX_RETRY_ATTEMPTS = 3;

    constructor(
        private readonly analyticsRepository: AnalyticsRepository,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
    ) {}

    /**
     * Creates a new usage metric with enhanced validation and caching
     * @param metricData The metric data to create
     * @param organizationId Organization context for multi-tenant support
     * @returns Created usage metric entity
     */
    async createMetric(
        metricData: CreateUsageMetricDto,
        organizationId: string
    ): Promise<UsageMetricEntity> {
        try {
            // Validate organization context
            if (!organizationId) {
                throw new Error('Organization context is required');
            }

            // Create metric entity with organization context
            const metricEntity = new UsageMetricEntity({
                ...metricData,
                organizationId,
                source: 'analytics_service',
                metadata: {}
            });

            // Implement retry mechanism for resilience
            let attempts = 0;
            let lastError: Error;

            while (attempts < this.MAX_RETRY_ATTEMPTS) {
                try {
                    const savedMetric = await this.analyticsRepository.createMetric(metricEntity);
                    
                    // Invalidate related caches
                    await this.invalidateMetricCaches(metricData.subscriptionId);
                    
                    this.logger.log(`Created metric for subscription ${metricData.subscriptionId}`);
                    return savedMetric;
                } catch (error) {
                    lastError = error;
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }

            throw lastError;
        } catch (error) {
            this.logger.error(`Failed to create metric: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Retrieves aggregated metrics with trend analysis and caching
     * @param subscriptionId Subscription identifier
     * @param organizationId Organization context
     * @param type Metric type filter
     * @param startDate Start of date range
     * @param endDate End of date range
     * @returns Aggregated metrics with trend analysis
     */
    async getAggregatedMetrics(
        subscriptionId: string,
        organizationId: string,
        type: MetricType,
        startDate: Date,
        endDate: Date
    ): Promise<{
        total: number;
        average: number;
        peak: number;
        trend: number;
    }> {
        try {
            // Generate secure cache key incorporating tenant context
            const cacheKey = `metrics_${organizationId}_${subscriptionId}_${type}_${startDate.getTime()}_${endDate.getTime()}`;

            // Check cache first
            const cachedResult = await this.cacheManager.get(cacheKey);
            if (cachedResult) {
                this.logger.debug(`Cache hit for ${cacheKey}`);
                return cachedResult as any;
            }

            // Fetch and aggregate metrics
            const metrics = await this.analyticsRepository.aggregateMetrics(
                subscriptionId,
                type,
                startDate,
                endDate
            );

            // Cache the results
            await this.cacheManager.set(
                cacheKey,
                metrics,
                this.DEFAULT_CACHE_TTL
            );

            return metrics;
        } catch (error) {
            this.logger.error(`Failed to get aggregated metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Retrieves usage metrics for a subscription with pagination
     * @param subscriptionId Subscription identifier
     * @param organizationId Organization context
     * @param page Page number
     * @param limit Items per page
     * @returns Paginated usage metrics
     */
    async getUsageMetrics(
        subscriptionId: string,
        organizationId: string,
        page: number = 1,
        limit: number = 50
    ): Promise<[UsageMetricEntity[], number]> {
        try {
            const cacheKey = `usage_metrics_${organizationId}_${subscriptionId}_${page}_${limit}`;
            
            // Check cache
            const cachedResult = await this.cacheManager.get(cacheKey);
            if (cachedResult) {
                return cachedResult as [UsageMetricEntity[], number];
            }

            // Calculate date range for last 30 days
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            const metrics = await this.analyticsRepository.findByDateRange(
                startDate,
                endDate,
                page,
                limit
            );

            // Cache results
            await this.cacheManager.set(cacheKey, metrics, this.DEFAULT_CACHE_TTL);

            return metrics;
        } catch (error) {
            this.logger.error(`Failed to get usage metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Invalidates metric-related caches for a subscription
     * @param subscriptionId Subscription identifier
     */
    private async invalidateMetricCaches(subscriptionId: string): Promise<void> {
        try {
            const cachePattern = `metrics_*_${subscriptionId}_*`;
            await this.cacheManager.del(cachePattern);
            this.logger.debug(`Invalidated caches for subscription ${subscriptionId}`);
        } catch (error) {
            this.logger.warn(`Failed to invalidate caches: ${error.message}`);
        }
    }

    /**
     * Cleanup resources on application shutdown
     */
    async onApplicationShutdown(): Promise<void> {
        try {
            await this.analyticsRepository.onApplicationShutdown();
            this.logger.log('Analytics service shutdown completed');
        } catch (error) {
            this.logger.error('Error during analytics service shutdown', error.stack);
        }
    }
}