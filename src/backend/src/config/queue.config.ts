import { BullModuleOptions } from '@nestjs/bull'; // ^10.0.0
import { registerAs } from '@nestjs/config'; // ^10.0.0
import { queue } from './configuration';

/**
 * Interface for queue monitoring configuration
 */
interface QueueMonitoringConfig {
  metrics: boolean;
  events: boolean;
}

/**
 * Interface for queue rate limiting configuration
 */
interface QueueRateLimitConfig {
  max: number;
  duration: number;
}

/**
 * Interface for queue-specific configuration
 */
interface QueueConfig {
  name: string;
  concurrency: number;
  rateLimit: QueueRateLimitConfig;
  monitoring: QueueMonitoringConfig;
}

/**
 * Enhanced Bull queue configuration with advanced features
 */
const QUEUE_CONFIG = {
  redis: {
    host: process.env.QUEUE_REDIS_HOST || 'localhost',
    port: parseInt(process.env.QUEUE_REDIS_PORT, 10) || 6379,
    password: process.env.QUEUE_REDIS_PASSWORD,
    tls: process.env.QUEUE_REDIS_TLS === 'true',
    cluster: {
      enabled: process.env.QUEUE_REDIS_CLUSTER === 'true',
      nodes: process.env.QUEUE_REDIS_CLUSTER_NODES?.split(',') || [],
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    retryStrategy: (times: number) => Math.min(times * 1000, 10000),
    enableOfflineQueue: true,
  },

  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS, 10) || 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    priority: 0,
    timeout: 30000,
    stackTraceLimit: 10,
    metrics: {
      enabled: true,
      collectInterval: 5000,
    },
  },

  analytics: {
    name: 'analytics',
    concurrency: parseInt(process.env.ANALYTICS_QUEUE_CONCURRENCY, 10) || 3,
    rateLimit: {
      max: 1000,
      duration: 60000,
    },
    monitoring: {
      metrics: true,
      events: true,
    },
  },

  notifications: {
    name: 'notifications',
    concurrency: parseInt(process.env.NOTIFICATIONS_QUEUE_CONCURRENCY, 10) || 5,
    rateLimit: {
      max: 2000,
      duration: 60000,
    },
    monitoring: {
      metrics: true,
      events: true,
    },
  },
};

/**
 * Factory function that generates enhanced Bull queue configuration
 * with advanced features for high availability, monitoring, and security
 * 
 * @returns {BullModuleOptions} Complete queue configuration object
 */
const getQueueConfig = (): BullModuleOptions => {
  const config: BullModuleOptions = {
    redis: {
      ...QUEUE_CONFIG.redis,
      // Configure TLS if enabled
      ...(QUEUE_CONFIG.redis.tls && {
        tls: {
          rejectUnauthorized: true,
        },
      }),
      // Configure cluster if enabled
      ...(QUEUE_CONFIG.redis.cluster.enabled && {
        cluster: {
          nodes: QUEUE_CONFIG.redis.cluster.nodes.map(node => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port, 10) };
          }),
          options: {
            maxRedirections: 16,
            retryDelayOnFailover: 100,
          },
        },
      }),
    },
    defaultJobOptions: {
      ...QUEUE_CONFIG.defaultJobOptions,
      // Enhanced error tracking
      stackTraceLimit: QUEUE_CONFIG.defaultJobOptions.stackTraceLimit,
      // Job metrics collection
      metrics: QUEUE_CONFIG.defaultJobOptions.metrics,
    },
    // Advanced queue settings
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 3,
      lockDuration: 30000,
      lockRenewTime: 15000,
    },
    // Enhanced error handling
    limiter: {
      max: 1000,
      duration: 5000,
      bounceBack: true,
    },
  };

  return config;
};

/**
 * Export enhanced queue configuration with advanced features
 */
export const queueConfig = registerAs('queue', () => ({
  ...getQueueConfig(),
  redis: QUEUE_CONFIG.redis,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
  analytics: QUEUE_CONFIG.analytics,
  notifications: QUEUE_CONFIG.notifications,
}));

/**
 * Export queue-specific configurations for direct access
 */
export const analyticsQueueConfig: QueueConfig = QUEUE_CONFIG.analytics;
export const notificationsQueueConfig: QueueConfig = QUEUE_CONFIG.notifications;