import { Injectable } from '@nestjs/common'; // ^10.0.0
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'; // ^10.0.0
import { Connection } from 'typeorm'; // ^0.3.0
import { CircuitBreaker } from 'circuit-breaker-js'; // ^0.1.0
import { Logger } from '@nestjs/common'; // ^10.0.0
import { getDatabaseConfig } from '../../config/database.config';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly healthCheckCache: Map<string, { result: HealthIndicatorResult; timestamp: number }>;
  private readonly cacheTTL: number = 10000; // 10 seconds cache TTL

  constructor(
    private readonly connection: Connection,
    logger: Logger
  ) {
    super();
    this.logger = logger;
    this.initializeCircuitBreaker();
    const dbConfig = getDatabaseConfig();
    this.timeout = dbConfig.monitoring?.maxQueryExecutionTime || 5000;
    this.maxRetries = 3;
    this.healthCheckCache = new Map();
  }

  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker({
      windowDuration: 60000, // 1 minute
      numBuckets: 10,
      timeoutDuration: 30000,
      errorThreshold: 50,
      volumeThreshold: 10
    });
  }

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check circuit breaker status
      if (!this.circuitBreaker.isAvailable()) {
        this.logger.error('Database circuit breaker is open');
        return this.getUnhealthyStatus(key, 'Circuit breaker is open');
      }

      // Check cache for recent health check result
      const cachedResult = this.getCachedResult(key);
      if (cachedResult) {
        return cachedResult;
      }

      // Perform health check with retries
      const startTime = Date.now();
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const isHealthy = await this.checkConnection();
          const responseTime = Date.now() - startTime;

          if (isHealthy) {
            const result = this.getHealthyStatus(key, responseTime);
            this.cacheHealthCheckResult(key, result);
            return result;
          }
        } catch (error) {
          lastError = error;
          this.logger.warn(`Database health check attempt ${attempt} failed: ${error.message}`);
          if (attempt < this.maxRetries) {
            await this.delay(1000 * attempt); // Exponential backoff
          }
        }
      }

      // All retries failed
      this.circuitBreaker.recordFailure();
      const unhealthyResult = this.getUnhealthyStatus(key, lastError?.message || 'Connection check failed');
      this.cacheHealthCheckResult(key, unhealthyResult);
      return unhealthyResult;

    } catch (error) {
      this.logger.error('Database health check error:', error);
      this.circuitBreaker.recordFailure();
      return this.getUnhealthyStatus(key, 'Health check failed');
    }
  }

  private async checkConnection(): Promise<boolean> {
    if (!this.connection || !this.connection.isConnected) {
      throw new Error('Database connection is not initialized');
    }

    try {
      // Check connection pool status
      const poolStats = await this.getConnectionPoolStats();
      
      // Execute test query with timeout
      const queryStartTime = Date.now();
      await Promise.race([
        this.connection.query('SELECT 1'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), this.timeout)
        )
      ]);

      const queryTime = Date.now() - queryStartTime;

      // Verify connection pool health
      if (poolStats.used / poolStats.total > 0.9) {
        throw new Error('Connection pool near capacity');
      }

      // Check replication lag if applicable
      if (this.connection.options.replication) {
        await this.checkReplicationLag();
      }

      return true;
    } catch (error) {
      throw new Error(`Connection check failed: ${error.message}`);
    }
  }

  private async getConnectionPoolStats(): Promise<{ used: number; total: number }> {
    const pool = (this.connection as any).driver.pool;
    return {
      used: pool.used || 0,
      total: pool.size || 0
    };
  }

  private async checkReplicationLag(): Promise<void> {
    const maxLagThreshold = 10000; // 10 seconds
    const replicationLag = await this.connection.query(
      'SELECT EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp()) * 1000 as lag'
    );
    
    if (replicationLag[0].lag > maxLagThreshold) {
      throw new Error(`Replication lag exceeds threshold: ${replicationLag[0].lag}ms`);
    }
  }

  private getHealthyStatus(key: string, responseTime: number): HealthIndicatorResult {
    return this.getStatus(key, true, {
      responseTime: `${responseTime}ms`,
      connectionPool: this.connection.isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  }

  private getUnhealthyStatus(key: string, error: string): HealthIndicatorResult {
    return this.getStatus(key, false, {
      error,
      timestamp: new Date().toISOString()
    });
  }

  private getCachedResult(key: string): HealthIndicatorResult | null {
    const cached = this.healthCheckCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }
    return null;
  }

  private cacheHealthCheckResult(key: string, result: HealthIndicatorResult): void {
    this.healthCheckCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}