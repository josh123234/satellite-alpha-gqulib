import { Injectable } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'; // @nestjs/terminus ^10.0.0
import { Redis, Cluster, RedisOptions } from 'ioredis'; // ioredis ^5.0.0
import { REDIS_CONFIG } from '../../config/cache.config';

/**
 * Interface for Redis cache performance metrics
 */
interface CacheMetrics {
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
  connections: {
    current: number;
    totalConnections: number;
    rejectedConnections: number;
  };
  eviction: {
    evictedKeys: number;
    evictionRate: number;
  };
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly redis: Redis | Cluster;
  private lastCheckTimestamp: number;
  private metrics: CacheMetrics;
  private readonly connectionTimeout: number = 5000; // 5 seconds timeout

  constructor() {
    super();
    this.initializeRedisClient();
    this.lastCheckTimestamp = Date.now();
    this.initializeMetrics();
  }

  /**
   * Initialize Redis client with appropriate configuration
   */
  private initializeRedisClient(): void {
    const options: RedisOptions = {
      host: REDIS_CONFIG.host,
      port: REDIS_CONFIG.port,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    };

    if (REDIS_CONFIG.cluster) {
      this.redis = new Cluster([{ host: REDIS_CONFIG.host, port: REDIS_CONFIG.port }], {
        ...options,
        clusterRetryStrategy: options.retryStrategy,
      });
    } else {
      this.redis = new Redis(options);
    }

    this.setupEventHandlers();
  }

  /**
   * Initialize default metrics structure
   */
  private initializeMetrics(): void {
    this.metrics = {
      hitRate: 0,
      missRate: 0,
      memoryUsage: {
        used: 0,
        peak: 0,
        fragmentation: 0,
      },
      operations: {
        totalCommands: 0,
        commandsPerSecond: 0,
        averageLatency: 0,
      },
      connections: {
        current: 0,
        totalConnections: 0,
        rejectedConnections: 0,
      },
      eviction: {
        evictedKeys: 0,
        evictionRate: 0,
      },
    };
  }

  /**
   * Set up Redis client event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('ready', () => {
      console.log('Redis connection established');
    });

    this.redis.on('close', () => {
      console.warn('Redis connection closed');
    });
  }

  /**
   * Check Redis connection health with comprehensive metrics
   * @param key - Health check key identifier
   * @returns Promise<HealthIndicatorResult>
   */
  async checkConnection(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        ),
      ]);

      const latency = Date.now() - startTime;
      const metrics = await this.getPerformanceMetrics();

      return this.getStatus(key, true, {
        latency: `${latency}ms`,
        ...metrics,
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check Redis cluster health status
   * @param key - Health check key identifier
   * @returns Promise<HealthIndicatorResult>
   */
  async checkClusterStatus(key: string): Promise<HealthIndicatorResult> {
    if (!REDIS_CONFIG.cluster) {
      return this.getStatus(key, true, {
        message: 'Cluster mode not enabled',
      });
    }

    try {
      const cluster = this.redis as Cluster;
      const nodes = await cluster.nodes();
      const clusterInfo = await Promise.all(
        nodes.map(async (node) => {
          const info = await node.info();
          return {
            nodeId: node.options.key,
            status: node.status,
            role: info.includes('role:master') ? 'master' : 'slave',
            connected: node.status === 'ready',
          };
        })
      );

      return this.getStatus(key, true, {
        nodes: clusterInfo,
        totalNodes: nodes.length,
        healthyNodes: clusterInfo.filter(node => node.connected).length,
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: 'Cluster health check failed',
        error: error.message,
      });
    }
  }

  /**
   * Collect detailed Redis performance metrics
   * @returns Promise<CacheMetrics>
   */
  async getPerformanceMetrics(): Promise<CacheMetrics> {
    try {
      const info = await this.redis.info();
      const infoLines = info.split('\n');
      const getMetric = (key: string): string => {
        const line = infoLines.find(l => l.startsWith(key));
        return line ? line.split(':')[1] : '0';
      };

      const hits = parseInt(getMetric('keyspace_hits'), 10);
      const misses = parseInt(getMetric('keyspace_misses'), 10);
      const totalOps = hits + misses;

      this.metrics = {
        hitRate: totalOps ? (hits / totalOps) * 100 : 0,
        missRate: totalOps ? (misses / totalOps) * 100 : 0,
        memoryUsage: {
          used: parseInt(getMetric('used_memory'), 10),
          peak: parseInt(getMetric('used_memory_peak'), 10),
          fragmentation: parseFloat(getMetric('mem_fragmentation_ratio')),
        },
        operations: {
          totalCommands: parseInt(getMetric('total_commands_processed'), 10),
          commandsPerSecond: parseInt(getMetric('instantaneous_ops_per_sec'), 10),
          averageLatency: parseFloat(getMetric('latency_ms')),
        },
        connections: {
          current: parseInt(getMetric('connected_clients'), 10),
          totalConnections: parseInt(getMetric('total_connections_received'), 10),
          rejectedConnections: parseInt(getMetric('rejected_connections'), 10),
        },
        eviction: {
          evictedKeys: parseInt(getMetric('evicted_keys'), 10),
          evictionRate: parseFloat(getMetric('evicted_keys_per_sec')),
        },
      };

      return this.metrics;
    } catch (error) {
      console.error('Error collecting Redis metrics:', error);
      return this.metrics;
    }
  }
}