import { Module } from '@nestjs/common'; // ^10.0.0
import { TerminusModule } from '@nestjs/terminus'; // ^10.0.0
import { ScheduleModule } from '@nestjs/schedule'; // ^10.0.0
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch'; // ^3.0.0
import { ConfigService } from '@nestjs/config'; // ^10.0.0

import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './services/database.health';
import { RedisHealthIndicator } from './services/redis.health';

// Constants for health check configuration
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const METRICS_NAMESPACE = 'SaasManagement/Health';
const METRICS_RETENTION_DAYS = 90;

/**
 * Enhanced health module providing comprehensive system monitoring,
 * metrics collection, and CloudWatch integration
 */
@Module({
  imports: [
    TerminusModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    {
      provide: CloudWatchClient,
      useFactory: (configService: ConfigService) => {
        return new CloudWatchClient({
          region: configService.get('aws.region'),
          credentials: {
            accessKeyId: configService.get('aws.credentials.accessKeyId'),
            secretAccessKey: configService.get('aws.credentials.secretAccessKey'),
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'HEALTH_CONFIG',
      useFactory: (configService: ConfigService) => ({
        checkInterval: HEALTH_CHECK_INTERVAL,
        metricsNamespace: METRICS_NAMESPACE,
        retentionDays: METRICS_RETENTION_DAYS,
        alertThresholds: {
          database: {
            responseTime: 1000, // ms
            connectionPoolUsage: 80, // percentage
            replicationLag: 10000, // ms
          },
          redis: {
            latency: 100, // ms
            memoryUsage: 80, // percentage
            hitRate: 50, // percentage
          },
        },
        cloudWatch: {
          enabled: configService.get('aws.cloudwatch.enabled'),
          region: configService.get('aws.region'),
        },
      }),
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {
  private readonly moduleVersion = '1.0.0';
  private readonly healthConfig: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudWatchClient: CloudWatchClient,
  ) {
    this.initializeHealthModule();
  }

  /**
   * Initialize health module with configuration and CloudWatch setup
   */
  private async initializeHealthModule(): Promise<void> {
    this.healthConfig = this.configService.get('HEALTH_CONFIG');

    // Initialize CloudWatch metrics if enabled
    if (this.healthConfig.cloudWatch.enabled) {
      await this.setupCloudWatchMetrics();
    }

    // Log module initialization
    console.info(`Health Module ${this.moduleVersion} initialized with configuration:`, {
      checkInterval: this.healthConfig.checkInterval,
      metricsNamespace: this.healthConfig.metricsNamespace,
      cloudWatchEnabled: this.healthConfig.cloudWatch.enabled,
    });
  }

  /**
   * Set up CloudWatch metrics configuration
   */
  private async setupCloudWatchMetrics(): Promise<void> {
    try {
      // Create custom metric namespace if it doesn't exist
      await this.cloudWatchClient.send({
        Namespace: this.healthConfig.metricsNamespace,
        MetricData: [
          {
            MetricName: 'HealthCheckInitialization',
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              {
                Name: 'Environment',
                Value: this.configService.get('app.environment'),
              },
              {
                Name: 'Version',
                Value: this.moduleVersion,
              },
            ],
          },
        ],
      });

      console.info('CloudWatch metrics configuration completed successfully');
    } catch (error) {
      console.error('Failed to initialize CloudWatch metrics:', error);
      // Continue module initialization even if CloudWatch setup fails
    }
  }
}