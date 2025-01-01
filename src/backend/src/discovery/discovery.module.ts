/**
 * @fileoverview NestJS module definition for the subscription discovery and management feature
 * @version 1.0.0
 */

import { Module, Global, DynamicModule } from '@nestjs/common'; // @nestjs/common ^10.x
import { TypeOrmModule } from '@nestjs/typeorm'; // @nestjs/typeorm ^10.x
import { CacheModule } from '@nestjs/cache-manager'; // @nestjs/cache-manager ^2.x
import { ThrottlerModule } from '@nestjs/throttler'; // @nestjs/throttler ^5.x

import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { Subscription } from './entities/subscription.entity';

/**
 * Configuration options for the Discovery module
 */
export interface DiscoveryModuleOptions {
  cacheTtl?: number;
  maxCacheItems?: number;
  throttleTtl?: number;
  throttleLimit?: number;
  isProduction?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: DiscoveryModuleOptions = {
  cacheTtl: 3600,
  maxCacheItems: 100,
  throttleTtl: 60,
  throttleLimit: 100,
  isProduction: process.env.NODE_ENV === 'production'
};

/**
 * Discovery module for SaaS subscription management
 * Provides centralized configuration for discovery features
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription]),
    CacheModule.register({
      ttl: DEFAULT_OPTIONS.cacheTtl,
      max: DEFAULT_OPTIONS.maxCacheItems,
      isGlobal: true
    }),
    ThrottlerModule.forRoot({
      ttl: DEFAULT_OPTIONS.throttleTtl,
      limit: DEFAULT_OPTIONS.throttleLimit
    })
  ],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    {
      provide: 'SUBSCRIPTION_REPOSITORY',
      useClass: SubscriptionRepository
    }
  ],
  exports: [DiscoveryService, TypeOrmModule]
})
export class DiscoveryModule {
  static moduleVersion = '1.0.0';
  static isProduction = process.env.NODE_ENV === 'production';

  /**
   * Configures the Discovery module with custom options
   * @param options - Module configuration options
   * @returns Configured DynamicModule instance
   */
  static configure(options: DiscoveryModuleOptions = {}): DynamicModule {
    const moduleOptions = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    return {
      module: DiscoveryModule,
      imports: [
        TypeOrmModule.forFeature([Subscription]),
        CacheModule.register({
          ttl: moduleOptions.cacheTtl,
          max: moduleOptions.maxCacheItems,
          isGlobal: true
        }),
        ThrottlerModule.forRoot({
          ttl: moduleOptions.throttleTtl,
          limit: moduleOptions.throttleLimit
        })
      ],
      controllers: [DiscoveryController],
      providers: [
        {
          provide: 'MODULE_OPTIONS',
          useValue: moduleOptions
        },
        DiscoveryService,
        {
          provide: 'SUBSCRIPTION_REPOSITORY',
          useClass: SubscriptionRepository
        }
      ],
      exports: [DiscoveryService, TypeOrmModule, 'MODULE_OPTIONS']
    };
  }
}