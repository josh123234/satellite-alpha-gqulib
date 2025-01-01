/**
 * @fileoverview Analytics controller implementing comprehensive analytics endpoints
 * for the SaaS Management Platform with robust validation and error handling.
 * @version 1.0.0
 */

import { 
    Controller, 
    Post, 
    Get, 
    Body, 
    Query, 
    UseGuards, 
    ValidationPipe, 
    ParseIntPipe, 
    ParseUUIDPipe,
    BadRequestException,
    Logger
} from '@nestjs/common'; // ^10.0.0
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiQuery, 
    ApiBearerAuth 
} from '@nestjs/swagger'; // ^7.0.0

import { AnalyticsService } from './analytics.service';
import { CreateUsageMetricDto } from './dto/usage-metric.dto';
import { ApiPaginatedResponse, PaginatedDto } from '../common/decorators/api-paginated-response.decorator';
import { UsageMetricEntity } from './entities/usage-metric.entity';
import { MetricType } from './interfaces/metric.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controller handling analytics-related HTTP endpoints with comprehensive validation
 * and error handling for the SaaS Management Platform.
 */
@Controller('analytics')
@ApiTags('Analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
    private readonly logger = new Logger(AnalyticsController.name);

    constructor(private readonly analyticsService: AnalyticsService) {}

    /**
     * Creates a new usage metric with comprehensive validation
     */
    @Post('metrics')
    @ApiOperation({ 
        summary: 'Create usage metric',
        description: 'Creates a new usage metric with validation and error handling'
    })
    @ApiResponse({ 
        status: 201, 
        description: 'Metric created successfully',
        type: UsageMetricEntity 
    })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createMetric(
        @Body(new ValidationPipe({ transform: true })) metricData: CreateUsageMetricDto
    ): Promise<UsageMetricEntity> {
        try {
            this.logger.debug(`Creating metric for subscription: ${metricData.subscriptionId}`);
            return await this.analyticsService.createMetric(metricData, 'system');
        } catch (error) {
            this.logger.error(`Failed to create metric: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Retrieves metrics for a specific subscription with pagination
     */
    @Get('subscription/:subscriptionId')
    @ApiOperation({ 
        summary: 'Get subscription metrics',
        description: 'Retrieves paginated metrics for a specific subscription'
    })
    @ApiPaginatedResponse(UsageMetricEntity)
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'type', required: false, enum: MetricType })
    async getMetricsBySubscription(
        @Query('subscriptionId', ParseUUIDPipe) subscriptionId: string,
        @Query('type') type?: MetricType,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50
    ): Promise<PaginatedDto<UsageMetricEntity>> {
        try {
            const [metrics, total] = await this.analyticsService.getUsageMetrics(
                subscriptionId,
                'system',
                page,
                limit
            );

            return new PaginatedDto<UsageMetricEntity>({
                data: metrics,
                page,
                pageSize: limit,
                totalItems: total
            });
        } catch (error) {
            this.logger.error(`Failed to get subscription metrics: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Retrieves metrics within a specified date range with filtering
     */
    @Get('date-range')
    @ApiOperation({ 
        summary: 'Get metrics by date range',
        description: 'Retrieves metrics within a date range with filtering options'
    })
    @ApiPaginatedResponse(UsageMetricEntity)
    @ApiQuery({ name: 'startDate', required: true, type: Date })
    @ApiQuery({ name: 'endDate', required: true, type: Date })
    @ApiQuery({ name: 'type', required: false, enum: MetricType })
    async getMetricsByDateRange(
        @Query('startDate') startDate: Date,
        @Query('endDate') endDate: Date,
        @Query('type') type?: MetricType,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50
    ): Promise<PaginatedDto<UsageMetricEntity>> {
        try {
            if (startDate >= endDate) {
                throw new BadRequestException('Start date must be before end date');
            }

            const [metrics, total] = await this.analyticsService.getUsageMetrics(
                undefined,
                'system',
                page,
                limit
            );

            return new PaginatedDto<UsageMetricEntity>({
                data: metrics,
                page,
                pageSize: limit,
                totalItems: total
            });
        } catch (error) {
            this.logger.error(`Failed to get metrics by date range: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Retrieves aggregated metrics with statistical analysis
     */
    @Get('aggregated')
    @ApiOperation({ 
        summary: 'Get aggregated metrics',
        description: 'Retrieves aggregated metrics with statistical analysis'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Aggregated metrics retrieved successfully'
    })
    @ApiQuery({ name: 'subscriptionId', required: true })
    @ApiQuery({ name: 'type', required: true, enum: MetricType })
    @ApiQuery({ name: 'startDate', required: true })
    @ApiQuery({ name: 'endDate', required: true })
    async getAggregatedMetrics(
        @Query('subscriptionId', ParseUUIDPipe) subscriptionId: string,
        @Query('type', new ValidationPipe({ transform: true })) type: MetricType,
        @Query('startDate') startDate: Date,
        @Query('endDate') endDate: Date
    ): Promise<{
        total: number;
        average: number;
        peak: number;
        trend: number;
    }> {
        try {
            if (startDate >= endDate) {
                throw new BadRequestException('Start date must be before end date');
            }

            return await this.analyticsService.getAggregatedMetrics(
                subscriptionId,
                'system',
                type,
                startDate,
                endDate
            );
        } catch (error) {
            this.logger.error(`Failed to get aggregated metrics: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }
}