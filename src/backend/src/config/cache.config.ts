import { registerAs } from '@nestjs/config'; // @nestjs/config ^10.0.0
import { CacheModuleOptions } from '@nestjs/cache-manager'; // @nestjs/cache-manager ^2.0.0
import * as redisStore from 'cache-manager-redis-store'; // cache-manager-redis-store ^3.0.0

/**
 * Redis configuration interface defining all possible cache settings
 */
interface RedisConfig {
  store: any;
  host: string;
  port: number;
  password?: string;
  ttl: number;
  max: number;
  cluster: boolean;
  clusterNodes?: string[];
  tls: boolean;
  retryStrategy: (times: number) => number;
  connectTimeout: number;
  keepAlive: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
}

/**
 * Default Redis configuration with environment variable fallbacks
 */
const REDIS_CONFIG: RedisConfig = {
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD,
  ttl: parseInt(process.env.REDIS_TTL, 10) || 300, // 5 minutes default TTL
  max: parseInt(process.env.REDIS_MAX_ITEMS, 10) || 1000,
  cluster: process.env.REDIS_CLUSTER === 'true',
  clusterNodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
  tls: process.env.REDIS_TLS === 'true',
  retryStrategy: (times: number) => Math.min(times * 50, 2000), // Exponential backoff with 2s max
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 5000,
  keepAlive: parseInt(process.env.REDIS_KEEPALIVE, 10) || 30000,
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: true,
};

/**
 * Factory function that generates Redis cache configuration
 * Supports cluster mode, TLS, and advanced error handling
 * 
 * @returns {CacheModuleOptions} Complete cache configuration object
 */
export const getCacheConfig = registerAs('cache', (): CacheModuleOptions => {
  const config: any = {
    ...REDIS_CONFIG,
    // Error handling configuration
    retry_strategy: REDIS_CONFIG.retryStrategy,
    
    // Connection management
    connect_timeout: REDIS_CONFIG.connectTimeout,
    keepalive: REDIS_CONFIG.keepAlive,
    
    // Request handling
    max_retries_per_request: REDIS_CONFIG.maxRetriesPerRequest,
    enable_ready_check: REDIS_CONFIG.enableReadyCheck,
    enable_offline_queue: REDIS_CONFIG.enableOfflineQueue,
    lazy_connect: REDIS_CONFIG.lazyConnect,
  };

  // Configure cluster mode if enabled
  if (REDIS_CONFIG.cluster && REDIS_CONFIG.clusterNodes.length > 0) {
    config.cluster = true;
    config.nodes = REDIS_CONFIG.clusterNodes.map(node => {
      const [host, port] = node.split(':');
      return {
        host,
        port: parseInt(port, 10),
      };
    });
  }

  // Configure TLS if enabled
  if (REDIS_CONFIG.tls) {
    config.tls = {
      rejectUnauthorized: true, // Enforce valid certificates
    };
  }

  // Remove undefined values
  Object.keys(config).forEach(key => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });

  return {
    isGlobal: true, // Make cache available globally
    store: config.store,
    ...config,
  };
});

export default getCacheConfig;