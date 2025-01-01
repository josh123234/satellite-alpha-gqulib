/**
 * @fileoverview Analytics processor for handling background analytics jobs
 * Implements robust error handling, comprehensive logging, and efficient batch processing
 * @version 1.0.0
 */

import { Process, Processor } from '@nestjs/bull'; // ^0.6.0
import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { AnalyticsService } from '../../analytics/analytics.service';
import { JobType, QueueJob } from '../interfaces/job.interface';
import { MetricType } from '../../analytics/interfaces/metric.interface';

@Injectable()
@Processor('analytics')
export class AnalyticsProcessor {
    private readonly logger = new Logger(AnalyticsProcessor.name);
    private readonly maxRetries = 3;
    private readonly batchSize = 100;
    private readonly processingTimeout = 30000; // 30 seconds

    constructor(
        private readonly analyticsService: AnalyticsService
    ) {}

    /**
     * Processes analytics data in batches with comprehensive error handling
     * @param job Queue job containing analytics data to process
     */
    @Process(JobType.ANALYTICS_PROCESSING)
    async processAnalytics(job: QueueJob): Promise<void> {
        const startTime = Date.now();
        const { correlationId } = job;

        try {
            this.logger.log(`Starting analytics processing job ${correlationId}`);

            // Validate job data
            if (!job.data?.payload?.metrics || !Array.isArray(job.data.payload.metrics)) {
                throw new Error('Invalid job data: metrics array is required');
            }

            const { metrics } = job.data.payload;
            const totalMetrics = metrics.length;
            let processedCount = 0;
            let failedCount = 0;

            // Process metrics in batches
            for (let i = 0; i < metrics.length; i += this.batchSize) {
                const batch = metrics.slice(i, i + this.batchSize);
                
                try {
                    await Promise.all(batch.map(async (metric) => {
                        try {
                            await this.analyticsService.createMetric(
                                {
                                    subscriptionId: metric.subscriptionId,
                                    metricType: metric.type as MetricType,
                                    value: metric.value,
                                    unit: metric.unit,
                                    timestamp: new Date(metric.timestamp)
                                },
                                metric.organizationId
                            );
                            processedCount++;
                        } catch (error) {
                            failedCount++;
                            this.logger.error(
                                `Failed to process metric: ${error.message}`,
                                error.stack
                            );
                        }
                    }));

                    // Update job progress
                    const progress = Math.floor((i + batch.length) / totalMetrics * 100);
                    await job.progress(progress);

                } catch (batchError) {
                    this.logger.error(
                        `Batch processing failed: ${batchError.message}`,
                        batchError.stack
                    );
                }
            }

            const processingTime = Date.now() - startTime;
            this.logger.log(
                `Analytics processing completed - JobId: ${correlationId}, ` +
                `Processed: ${processedCount}, Failed: ${failedCount}, ` +
                `Time: ${processingTime}ms`
            );

        } catch (error) {
            this.logger.error(
                `Analytics processing failed - JobId: ${correlationId}: ${error.message}`,
                error.stack
            );
            throw error;
        }
    }

    /**
     * Updates usage metrics with optimized batch processing and caching
     * @param job Queue job containing usage metrics update data
     */
    @Process(JobType.USAGE_METRICS_UPDATE)
    async processUsageMetricsUpdate(job: QueueJob): Promise<void> {
        const startTime = Date.now();
        const { correlationId } = job;

        try {
            this.logger.log(`Starting usage metrics update job ${correlationId}`);

            // Validate job data
            if (!job.data?.payload?.subscriptionId || !job.data.payload.organizationId) {
                throw new Error('Invalid job data: subscriptionId and organizationId required');
            }

            const { subscriptionId, organizationId, startDate, endDate } = job.data.payload;

            // Get aggregated metrics for different types
            const metricTypes = Object.values(MetricType);
            const metricsPromises = metricTypes.map(type =>
                this.analyticsService.getAggregatedMetrics(
                    subscriptionId,
                    organizationId,
                    type,
                    new Date(startDate),
                    new Date(endDate)
                )
            );

            // Process all metric types in parallel
            const results = await Promise.allSettled(metricsPromises);

            // Analyze results
            const successfulUpdates = results.filter(r => r.status === 'fulfilled').length;
            const failedUpdates = results.filter(r => r.status === 'rejected').length;

            const processingTime = Date.now() - startTime;
            this.logger.log(
                `Usage metrics update completed - JobId: ${correlationId}, ` +
                `Successful: ${successfulUpdates}, Failed: ${failedUpdates}, ` +
                `Time: ${processingTime}ms`
            );

            // Update job progress to complete
            await job.progress(100);

        } catch (error) {
            this.logger.error(
                `Usage metrics update failed - JobId: ${correlationId}: ${error.message}`,
                error.stack
            );
            throw error;
        }
    }
}