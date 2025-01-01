/**
 * @fileoverview Analytics module configuration for the SaaS Management Platform
 * Configures and exports analytics functionality with caching and database integration
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0
import * as redisStore from 'cache-manager-redis-store'; // ^3.0.0

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { UsageMetricEntity } from './entities/usage-metric.entity';

/**
 * Analytics module configuration with Redis caching and TypeORM integration
 * Implements comprehensive analytics functionality for the SaaS Management Platform
 */
@Module({
  imports: [
    // Configure TypeORM for UsageMetric entity with eager loading optimization
    TypeOrmModule.forFeature([UsageMetricEntity]),

    // Configure Redis cache with optimized settings for analytics data
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      ttl: 300, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
      prefix: 'analytics:', // Cache key prefix for analytics
      isGlobal: true, // Make cache available globally
      // Redis connection options
      socket: {
        keepAlive: 1000,
        reconnectStrategy: (retries: number) => Math.min(retries * 100, 3000),
      },
      // Cluster configuration for high availability
      cluster: process.env.REDIS_CLUSTER === 'true' ? [
        {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        }
      ] : undefined,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    // Add any additional providers needed for analytics functionality
  ],
  exports: [
    // Export services for use in other modules
    AnalyticsService,
    AnalyticsRepository,
  ],
})
export class AnalyticsModule {}