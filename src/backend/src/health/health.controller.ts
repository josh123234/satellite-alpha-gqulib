import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { Retry } from '@nestjs/common';
import { DatabaseHealthIndicator } from './services/database.health';
import { RedisHealthIndicator } from './services/redis.health';

/**
 * Interface for comprehensive system metrics
 */
interface SystemMetrics {
  database: {
    responseTime: string;
    connectionPool: string;
    queryPerformance: {
      averageExecutionTime: number;
      slowQueries: number;
    };
  };
  cache: {
    hitRate: number;
    missRate: number;
    memoryUsage: {
      used: number;
      peak: number;
      fragmentation: number;
    };
    operations: {
      totalCommands: number;
      commandsPerSecond: number;
      averageLatency: number;
    };
  };
  timestamp: string;
}

/**
 * Enhanced health controller providing comprehensive system health monitoring
 * and metrics collection for the SaaS Management Platform
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator
  ) {}

  /**
   * Comprehensive health check endpoint with retry mechanism
   * Monitors database, cache, and system components
   */
  @Get()
  @HealthCheck()
  @Retry({ attempts: 3, delay: 1000 })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database health checks
      async () => this.db.checkHealth('database'),
      async () => this.db.checkConnection('database_connection'),

      // Redis cache health checks
      async () => this.redis.checkConnection('redis'),
      async () => this.redis.checkClusterStatus('redis_cluster'),
    ]);
  }

  /**
   * Detailed metrics endpoint providing comprehensive performance data
   * Collects metrics from database, cache, and system components
   */
  @Get('metrics')
  async getDetailedMetrics(): Promise<SystemMetrics> {
    // Collect database metrics
    const dbMetrics = await this.db.getMetrics();
    
    // Collect Redis metrics
    const cacheMetrics = await this.redis.getPerformanceMetrics();

    // Aggregate and return comprehensive metrics
    return {
      database: {
        responseTime: dbMetrics.responseTime,
        connectionPool: dbMetrics.connectionPool,
        queryPerformance: {
          averageExecutionTime: dbMetrics.queryPerformance.averageExecutionTime,
          slowQueries: dbMetrics.queryPerformance.slowQueries,
        },
      },
      cache: {
        hitRate: cacheMetrics.hitRate,
        missRate: cacheMetrics.missRate,
        memoryUsage: {
          used: cacheMetrics.memoryUsage.used,
          peak: cacheMetrics.memoryUsage.peak,
          fragmentation: cacheMetrics.memoryUsage.fragmentation,
        },
        operations: {
          totalCommands: cacheMetrics.operations.totalCommands,
          commandsPerSecond: cacheMetrics.operations.commandsPerSecond,
          averageLatency: cacheMetrics.operations.averageLatency,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}