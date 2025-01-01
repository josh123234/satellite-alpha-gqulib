// @nestjs/common version ^10.0.0 - NestJS framework core decorators and utilities
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';

// rxjs version ^7.8.1 - Reactive programming support
import { Observable, forkJoin, of, throwError, timer, BehaviorSubject } from 'rxjs';
import { map, catchError, retry, timeout, mergeMap, tap } from 'rxjs/operators';

// @aws-sdk/client-cloudwatch version ^3.0.0 - AWS CloudWatch integration
import { CloudWatch, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

// Internal imports
import { IntegrationProvider, ProviderType, ConnectionStatus } from './interfaces/provider.interface';

/**
 * Connection pool configuration for managing provider connections
 */
interface ConnectionPool {
    maxSize: number;
    activeConnections: number;
    idleConnections: any[];
}

/**
 * Enhanced connection options with reliability features
 */
interface ConnectionOptions {
    timeout?: number;
    retryAttempts?: number;
    poolSize?: number;
    healthCheckInterval?: number;
}

/**
 * Detailed connection result with health information
 */
interface ConnectionResult {
    success: boolean;
    provider: ProviderType;
    status: ConnectionStatus;
    metrics: {
        connectionTime: number;
        retryCount: number;
    };
}

/**
 * Provider health status information
 */
interface HealthStatus {
    provider: ProviderType;
    status: ConnectionStatus;
    lastCheck: Date;
    metrics: {
        latency: number;
        errorRate: number;
        availability: number;
    };
}

/**
 * Core service managing all third-party integrations with comprehensive
 * monitoring, reliability features, and enterprise-grade error handling.
 */
@Injectable()
export class IntegrationService implements OnModuleDestroy {
    private readonly logger = new Logger(IntegrationService.name);
    private readonly providers = new Map<ProviderType, IntegrationProvider>();
    private readonly activeConnections = new Map<ProviderType, ConnectionPool>();
    private readonly healthChecks = new Map<ProviderType, NodeJS.Timer>();
    private readonly healthStatus = new BehaviorSubject<Map<ProviderType, HealthStatus>>(new Map());
    private readonly cloudWatch: CloudWatch;

    constructor(
        private readonly googleWorkspaceService: IntegrationProvider,
        private readonly quickBooksService: IntegrationProvider,
        private readonly stripeService: IntegrationProvider,
        private readonly configService: any
    ) {
        // Initialize CloudWatch client
        this.cloudWatch = new CloudWatch({
            region: this.configService.get('AWS_REGION'),
            credentials: {
                accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
            },
        });

        // Register providers with health monitoring
        this.initializeProviders();
        this.initializeConnectionPools();
        this.setupHealthChecks();
    }

    /**
     * Establishes monitored connection with specified provider
     * @param providerType - Type of provider to connect
     * @param credentials - Authentication credentials
     * @param options - Connection configuration options
     */
    public connectProvider(
        providerType: ProviderType,
        credentials: Record<string, string>,
        options: ConnectionOptions = {}
    ): Observable<ConnectionResult> {
        const startTime = Date.now();
        const provider = this.providers.get(providerType);

        if (!provider) {
            return throwError(() => new Error(`Unsupported provider type: ${providerType}`));
        }

        return provider.validateCredentials(credentials).pipe(
            mergeMap(validation => {
                if (!validation.valid) {
                    return throwError(() => new Error(`Invalid credentials: ${validation.issues?.join(', ')}`));
                }

                return this.acquireConnection(providerType).pipe(
                    mergeMap(() => provider.connect(credentials, {
                        timeout: options.timeout || 30000,
                        retryAttempts: options.retryAttempts || 3
                    })),
                    timeout(options.timeout || 30000),
                    retry({
                        count: options.retryAttempts || 3,
                        delay: (error, retryCount) => timer(Math.pow(2, retryCount) * 1000)
                    }),
                    map(success => ({
                        success,
                        provider: providerType,
                        status: success ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR,
                        metrics: {
                            connectionTime: Date.now() - startTime,
                            retryCount: 0
                        }
                    })),
                    tap(result => this.recordMetrics(providerType, result)),
                    catchError(error => {
                        this.logger.error(`Connection failed for ${providerType}`, error.stack);
                        return of({
                            success: false,
                            provider: providerType,
                            status: ConnectionStatus.ERROR,
                            metrics: {
                                connectionTime: Date.now() - startTime,
                                retryCount: options.retryAttempts || 3
                            }
                        });
                    })
                );
            })
        );
    }

    /**
     * Monitors health status of specified provider
     * @param providerType - Provider to monitor
     */
    public monitorProviderHealth(providerType: ProviderType): Observable<HealthStatus> {
        const provider = this.providers.get(providerType);
        
        if (!provider) {
            return throwError(() => new Error(`Unsupported provider type: ${providerType}`));
        }

        return provider.getConnectionMetrics().pipe(
            map(metrics => ({
                provider: providerType,
                status: provider.connectionStatus,
                lastCheck: new Date(),
                metrics: {
                    latency: metrics.latency,
                    errorRate: metrics.errorRate,
                    availability: this.calculateAvailability(metrics)
                }
            })),
            tap(status => {
                this.healthStatus.next(this.healthStatus.value.set(providerType, status));
                this.publishHealthMetrics(providerType, status);
            }),
            catchError(error => {
                this.logger.error(`Health check failed for ${providerType}`, error.stack);
                return throwError(() => error);
            })
        );
    }

    /**
     * Cleanup resources on module destruction
     */
    async onModuleDestroy() {
        // Clear all health check intervals
        for (const [providerType, interval] of this.healthChecks) {
            clearInterval(interval);
            this.logger.log(`Stopped health checks for ${providerType}`);
        }

        // Disconnect all providers
        const disconnectPromises = Array.from(this.providers.entries()).map(([type, provider]) => 
            provider.disconnect(false).toPromise()
        );

        await Promise.all(disconnectPromises);
        this.logger.log('All providers disconnected successfully');
    }

    private initializeProviders(): void {
        this.providers.set(ProviderType.GOOGLE_WORKSPACE, this.googleWorkspaceService);
        this.providers.set(ProviderType.QUICKBOOKS, this.quickBooksService);
        this.providers.set(ProviderType.STRIPE, this.stripeService);
    }

    private initializeConnectionPools(): void {
        for (const providerType of this.providers.keys()) {
            this.activeConnections.set(providerType, {
                maxSize: 10,
                activeConnections: 0,
                idleConnections: []
            });
        }
    }

    private setupHealthChecks(): void {
        for (const providerType of this.providers.keys()) {
            const interval = setInterval(() => {
                this.monitorProviderHealth(providerType).subscribe();
            }, 60000); // Check every minute

            this.healthChecks.set(providerType, interval);
        }
    }

    private acquireConnection(providerType: ProviderType): Observable<void> {
        const pool = this.activeConnections.get(providerType);
        
        if (!pool) {
            return throwError(() => new Error('Connection pool not initialized'));
        }

        if (pool.activeConnections >= pool.maxSize) {
            return throwError(() => new Error('Connection pool exhausted'));
        }

        pool.activeConnections++;
        return of(void 0);
    }

    private calculateAvailability(metrics: any): number {
        return (1 - (metrics.errorRate / 100)) * 100;
    }

    private async publishHealthMetrics(providerType: ProviderType, status: HealthStatus): Promise<void> {
        try {
            await this.cloudWatch.send(new PutMetricDataCommand({
                Namespace: 'SaaSManagement/Integrations',
                MetricData: [
                    {
                        MetricName: 'Latency',
                        Value: status.metrics.latency,
                        Unit: 'Milliseconds',
                        Dimensions: [{ Name: 'Provider', Value: providerType }]
                    },
                    {
                        MetricName: 'ErrorRate',
                        Value: status.metrics.errorRate,
                        Unit: 'Percent',
                        Dimensions: [{ Name: 'Provider', Value: providerType }]
                    },
                    {
                        MetricName: 'Availability',
                        Value: status.metrics.availability,
                        Unit: 'Percent',
                        Dimensions: [{ Name: 'Provider', Value: providerType }]
                    }
                ]
            }));
        } catch (error) {
            this.logger.error('Failed to publish metrics to CloudWatch', error.stack);
        }
    }

    private recordMetrics(providerType: ProviderType, result: ConnectionResult): void {
        this.publishHealthMetrics(providerType, {
            provider: providerType,
            status: result.status,
            lastCheck: new Date(),
            metrics: {
                latency: result.metrics.connectionTime,
                errorRate: result.success ? 0 : 100,
                availability: result.success ? 100 : 0
            }
        }).catch(error => {
            this.logger.error('Failed to record connection metrics', error.stack);
        });
    }
}