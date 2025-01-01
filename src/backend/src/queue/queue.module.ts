/**
 * @fileoverview Queue module configuration for handling asynchronous tasks in the SaaS Management Platform.
 * Implements robust queue management with high availability, monitoring, and error handling.
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { BullModule } from '@nestjs/bull'; // ^10.0.0
import { ConfigService } from '@nestjs/config'; // ^3.0.0
import { AnalyticsProcessor } from './processors/analytics.processor';
import { NotificationProcessor } from './processors/notification.processor';

/**
 * Queue module that configures and manages Bull queues for asynchronous task processing.
 * Implements comprehensive monitoring, error handling, and high availability features.
 */
@Module({
  imports: [
    // Configure Bull with Redis connection and high availability settings
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
          tls: configService.get<boolean>('REDIS_TLS_ENABLED'),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          connectTimeout: 10000,
          retryStrategy: (times: number) => Math.min(times * 1000, 30000),
          reconnectOnError: (error: Error) => {
            const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNREFUSED'];
            return targetErrors.some(e => error.message.includes(e));
          }
        },
        defaultJobOptions: {
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        },
        settings: {
          stalledInterval: 30000, // Check for stalled jobs every 30 seconds
          maxStalledCount: 3, // Maximum number of stalled job checks
          guardInterval: 5000, // How often check for stalled jobs (ms)
        }
      })
    }),

    // Configure analytics queue with optimized settings
    BullModule.registerQueue({
      name: 'analytics',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        priority: 'high',
        timeout: 30000 // 30 seconds timeout
      },
      settings: {
        lockDuration: 30000,
        lockRenewTime: 15000,
        maxStalledCount: 2,
        retryProcessDelay: 5000,
        drainDelay: 300,
        concurrency: 5,
        limiter: {
          max: 1000, // Maximum number of jobs processed
          duration: 5000, // Per 5 seconds
          bounceBack: true // Queue jobs when limit is hit
        }
      }
    }),

    // Configure notifications queue with high reliability settings
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        priority: 'critical',
        timeout: 20000 // 20 seconds timeout
      },
      settings: {
        lockDuration: 20000,
        lockRenewTime: 10000,
        maxStalledCount: 3,
        retryProcessDelay: 3000,
        drainDelay: 300,
        concurrency: 10,
        limiter: {
          max: 2000, // Maximum number of notifications
          duration: 5000, // Per 5 seconds
          bounceBack: true
        }
      }
    })
  ],
  providers: [
    AnalyticsProcessor,
    NotificationProcessor
  ],
  exports: [
    BullModule
  ]
})
export class QueueModule {}