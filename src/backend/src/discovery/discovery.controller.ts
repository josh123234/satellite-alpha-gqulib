/**
 * @fileoverview REST API controller for SaaS subscription discovery and management
 * @version 1.0.0
 */

import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    UseInterceptors,
    Logger,
    HttpStatus,
    ParseUUIDPipe,
    ValidationPipe
} from '@nestjs/common'; // @nestjs/common ^10.x

import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiSecurity,
    ApiHeader
} from '@nestjs/swagger'; // @nestjs/swagger ^7.x

import { RateLimit } from '@nestjs/throttler'; // @nestjs/throttler ^5.x
import { CacheInterceptor } from '@nestjs/cache-manager'; // @nestjs/cache-manager ^2.x
import { UUID } from 'crypto';

import { DiscoveryService } from './discovery.service';
import { ISubscription, SubscriptionStatus } from './interfaces/subscription.interface';

/**
 * Controller handling subscription discovery and management operations
 * Implements rate limiting, caching, and comprehensive API documentation
 */
@Controller('api/v1/subscriptions')
@ApiTags('Subscriptions')
@UseGuards(JwtAuthGuard)
@ApiSecurity('bearer')
@ApiHeader({
    name: 'Authorization',
    description: 'JWT Bearer token'
})
export class DiscoveryController {
    private readonly logger = new Logger(DiscoveryController.name);

    constructor(private readonly discoveryService: DiscoveryService) {}

    /**
     * Create a new subscription
     */
    @Post()
    @RateLimit({ ttl: 60, limit: 10 })
    @ApiOperation({ summary: 'Create new subscription' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Subscription created successfully' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
    @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
    async createSubscription(
        @Body(new ValidationPipe()) createDto: CreateSubscriptionDto,
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID
    ): Promise<ISubscription> {
        this.logger.log(`Creating subscription for organization ${organizationId}`);
        return await this.discoveryService.createSubscription(createDto, organizationId);
    }

    /**
     * Discover subscriptions for an organization
     */
    @Get('discover')
    @UseInterceptors(CacheInterceptor)
    @RateLimit({ ttl: 300, limit: 20 })
    @ApiOperation({ summary: 'Discover organization subscriptions' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Subscriptions discovered successfully' })
    @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
    async discoverSubscriptions(
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID
    ): Promise<ISubscription[]> {
        this.logger.log(`Discovering subscriptions for organization ${organizationId}`);
        return await this.discoveryService.discoverSubscriptions(organizationId).toPromise();
    }

    /**
     * Get upcoming subscription renewals
     */
    @Get('renewals')
    @UseInterceptors(CacheInterceptor)
    @RateLimit({ ttl: 60, limit: 30 })
    @ApiOperation({ summary: 'Get upcoming subscription renewals' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Renewals retrieved successfully' })
    async getUpcomingRenewals(
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID,
        @Query('days', new ValidationPipe({ transform: true })) days: number = 30
    ): Promise<ISubscription[]> {
        this.logger.log(`Fetching renewals for next ${days} days for organization ${organizationId}`);
        return await this.discoveryService.getUpcomingRenewals(organizationId, days);
    }

    /**
     * Get under-utilized subscriptions
     */
    @Get('under-utilized')
    @UseInterceptors(CacheInterceptor)
    @RateLimit({ ttl: 300, limit: 20 })
    @ApiOperation({ summary: 'Get under-utilized subscriptions' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Under-utilized subscriptions retrieved' })
    async getUnderUtilizedSubscriptions(
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID,
        @Query('threshold', new ValidationPipe({ transform: true })) threshold: number = 30
    ): Promise<ISubscription[]> {
        this.logger.log(`Fetching under-utilized subscriptions for organization ${organizationId}`);
        return await this.discoveryService.getUnderUtilizedSubscriptions(organizationId, threshold);
    }

    /**
     * Update subscription details
     */
    @Put(':id')
    @RateLimit({ ttl: 60, limit: 20 })
    @ApiOperation({ summary: 'Update subscription details' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Subscription updated successfully' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Subscription not found' })
    async updateSubscription(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Body(new ValidationPipe()) updateDto: UpdateSubscriptionDto,
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID
    ): Promise<ISubscription> {
        this.logger.log(`Updating subscription ${id} for organization ${organizationId}`);
        return await this.discoveryService.updateSubscription(id, updateDto, organizationId);
    }

    /**
     * Get subscription usage analytics
     */
    @Get(':id/analytics')
    @UseInterceptors(CacheInterceptor)
    @RateLimit({ ttl: 300, limit: 30 })
    @ApiOperation({ summary: 'Get subscription usage analytics' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Analytics retrieved successfully' })
    async getSubscriptionAnalytics(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID,
        @Query() options: AnalyticsOptionsDto
    ): Promise<UsageAnalysis> {
        this.logger.log(`Fetching analytics for subscription ${id}`);
        return await this.discoveryService.analyzeUsagePatterns(id, {
            timeframe: options.timeframe || 30,
            utilizationThreshold: options.threshold || 30,
            includeInactive: options.includeInactive || false
        });
    }

    /**
     * Get subscription by ID
     */
    @Get(':id')
    @UseInterceptors(CacheInterceptor)
    @RateLimit({ ttl: 60, limit: 50 })
    @ApiOperation({ summary: 'Get subscription details' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Subscription retrieved successfully' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Subscription not found' })
    async getSubscription(
        @Param('id', ParseUUIDPipe) id: UUID,
        @Query('organizationId', ParseUUIDPipe) organizationId: UUID
    ): Promise<ISubscription> {
        this.logger.log(`Fetching subscription ${id} for organization ${organizationId}`);
        return await this.discoveryService.getSubscription(id, organizationId);
    }
}