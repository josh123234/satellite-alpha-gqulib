/**
 * @fileoverview Analytics repository for managing usage metrics with optimized querying and caching
 * Implements TypeORM repository pattern with advanced performance features
 * @version 1.0.0
 */

import { Injectable, UseInterceptors, CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/common'; // ^10.0.0
import { 
    Repository, 
    EntityRepository, 
    Between, 
    LessThan, 
    MoreThan,
    QueryBuilder,
    QueryRunner,
    Transaction,
    QueryCache
} from 'typeorm'; // ^0.3.0

import { UsageMetricEntity } from '../entities/usage-metric.entity';
import { MetricType } from '../interfaces/metric.interface';
import { UUID } from 'crypto';

/**
 * Enhanced repository class for analytics metrics with optimized querying and caching
 */
@Injectable()
@EntityRepository(UsageMetricEntity)
@UseInterceptors(CacheInterceptor)
export class AnalyticsRepository extends Repository<UsageMetricEntity> {
    private queryRunner: QueryRunner;

    constructor() {
        super();
        this.setupQueryRunner();
    }

    /**
     * Initializes the query runner with optimized settings
     * @private
     */
    private async setupQueryRunner(): Promise<void> {
        this.queryRunner = this.manager.connection.createQueryRunner();
        await this.queryRunner.connect();
        await this.queryRunner.startTransaction();
    }

    /**
     * Creates a new usage metric with validation and error handling
     * @param metricData The metric data to create
     * @returns Newly created usage metric
     */
    @Transaction()
    public async createMetric(metricData: Partial<UsageMetricEntity>): Promise<UsageMetricEntity> {
        try {
            const metric = new UsageMetricEntity(metricData);
            const savedMetric = await this.save(metric);
            
            // Invalidate related caches
            await this.manager.connection.queryResultCache?.remove([
                `subscription_metrics_${metric.subscriptionId}`,
                `metrics_aggregate_${metric.subscriptionId}`
            ]);

            return savedMetric;
        } catch (error) {
            await this.queryRunner.rollbackTransaction();
            throw new Error(`Failed to create metric: ${error.message}`);
        }
    }

    /**
     * Finds metrics for a subscription with caching
     * @param subscriptionId The subscription ID to query
     * @param type Optional metric type filter
     * @returns Array of cached metrics
     */
    @CacheKey('subscription_metrics')
    @CacheTTL(300)
    public async findBySubscription(
        subscriptionId: UUID,
        type?: MetricType
    ): Promise<UsageMetricEntity[]> {
        const queryBuilder = this.createQueryBuilder('metric')
            .where('metric.subscriptionId = :subscriptionId', { subscriptionId })
            .orderBy('metric.timestamp', 'DESC')
            .cache(`subscription_metrics_${subscriptionId}`, 300);

        if (type) {
            queryBuilder.andWhere('metric.metricType = :type', { type });
        }

        return queryBuilder.getMany();
    }

    /**
     * Finds metrics within a date range with pagination
     * @param startDate Range start date
     * @param endDate Range end date
     * @param page Page number
     * @param limit Items per page
     * @returns Paginated metrics within range
     */
    public async findByDateRange(
        startDate: Date,
        endDate: Date,
        page: number = 1,
        limit: number = 50
    ): Promise<[UsageMetricEntity[], number]> {
        const skip = (page - 1) * limit;

        return this.findAndCount({
            where: {
                timestamp: Between(startDate, endDate)
            },
            order: { timestamp: 'DESC' },
            skip,
            take: limit,
            cache: {
                id: `metrics_range_${startDate}_${endDate}_${page}`,
                milliseconds: 60000
            }
        });
    }

    /**
     * Performs optimized metric aggregation with parallel processing
     * @param subscriptionId The subscription ID to aggregate
     * @param type Metric type to aggregate
     * @param startDate Start of aggregation period
     * @param endDate End of aggregation period
     * @returns Comprehensive aggregated metrics
     */
    @QueryCache(60)
    public async aggregateMetrics(
        subscriptionId: UUID,
        type: MetricType,
        startDate: Date,
        endDate: Date
    ): Promise<{
        total: number;
        average: number;
        peak: number;
        trend: number;
    }> {
        const queryBuilder = this.createQueryBuilder('metric')
            .where('metric.subscriptionId = :subscriptionId', { subscriptionId })
            .andWhere('metric.metricType = :type', { type })
            .andWhere('metric.timestamp BETWEEN :startDate AND :endDate', {
                startDate,
                endDate
            });

        const [
            totalResult,
            peakResult,
            avgResult,
            trendResult
        ] = await Promise.all([
            queryBuilder.clone()
                .select('SUM(metric.value)', 'total')
                .getRawOne(),
            
            queryBuilder.clone()
                .select('MAX(metric.value)', 'peak')
                .getRawOne(),
            
            queryBuilder.clone()
                .select('AVG(metric.value)', 'average')
                .getRawOne(),
            
            // Calculate trend as percentage change
            queryBuilder.clone()
                .select('(MAX(CASE WHEN metric.timestamp > :midPoint THEN metric.value END) - ' +
                        'MAX(CASE WHEN metric.timestamp <= :midPoint THEN metric.value END)) / ' +
                        'MAX(CASE WHEN metric.timestamp <= :midPoint THEN metric.value END) * 100', 'trend')
                .setParameter('midPoint', new Date((startDate.getTime() + endDate.getTime()) / 2))
                .getRawOne()
        ]);

        return {
            total: Number(totalResult?.total || 0),
            average: Number(avgResult?.average || 0),
            peak: Number(peakResult?.peak || 0),
            trend: Number(trendResult?.trend || 0)
        };
    }

    /**
     * Cleanup resources on application shutdown
     */
    async onApplicationShutdown(): Promise<void> {
        await this.queryRunner.release();
    }
}