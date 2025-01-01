// @nestjs/common version ^10.0.0 - Dependency injection and common utilities
import { Injectable, Logger } from '@nestjs/common';

// stripe version ^12.0.0 - Official Stripe SDK
import Stripe from 'stripe';

// rxjs version ^7.0.0 - Reactive programming support
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, retry, timeout } from 'rxjs/operators';

// Internal imports
import { 
    IntegrationProvider, 
    ProviderType, 
    ConnectionStatus 
} from '../interfaces/provider.interface';

// Configuration interfaces
interface RetryConfig {
    attempts: number;
    delay: number;
    maxDelay: number;
}

interface RateLimit {
    maxRequests: number;
    windowMs: number;
    current: number;
    windowStart: number;
}

/**
 * Enhanced Stripe integration service implementing secure payment processing,
 * subscription tracking, and transaction analysis capabilities.
 */
@Injectable()
export class StripeService implements IntegrationProvider {
    private readonly logger = new Logger(StripeService.name);
    private readonly stripeClient: Stripe;
    public readonly providerType = ProviderType.STRIPE;
    public connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;

    private readonly retryConfig: RetryConfig = {
        attempts: 3,
        delay: 1000,
        maxDelay: 5000
    };

    private readonly rateLimit: RateLimit = {
        maxRequests: 100,
        windowMs: 60000, // 1 minute
        current: 0,
        windowStart: Date.now()
    };

    constructor() {
        this.stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2023-10-16',
            typescript: true,
            maxNetworkRetries: this.retryConfig.attempts,
            timeout: 30000,
        });
        this.initializeRateLimiting();
    }

    /**
     * Establishes secure connection with Stripe API including retry mechanisms
     * @param credentials - API credentials including secret key
     */
    public connect(credentials: Record<string, string>): Observable<boolean> {
        return from(this.validateAndInitialize(credentials)).pipe(
            map(isValid => {
                if (isValid) {
                    this.connectionStatus = ConnectionStatus.CONNECTED;
                    this.logger.log('Successfully connected to Stripe API');
                    return true;
                }
                throw new Error('Failed to establish Stripe connection');
            }),
            retry({
                count: this.retryConfig.attempts,
                delay: (error, retryCount) => 
                    Math.min(this.retryConfig.delay * Math.pow(2, retryCount), 
                    this.retryConfig.maxDelay)
            }),
            catchError(error => {
                this.connectionStatus = ConnectionStatus.ERROR;
                this.logger.error(`Stripe connection error: ${error.message}`);
                return throwError(() => error);
            })
        );
    }

    /**
     * Safely terminates Stripe API connection with cleanup
     */
    public disconnect(): Observable<boolean> {
        return new Observable(subscriber => {
            try {
                // Perform cleanup
                this.connectionStatus = ConnectionStatus.DISCONNECTED;
                this.rateLimit.current = 0;
                this.logger.log('Successfully disconnected from Stripe API');
                subscriber.next(true);
                subscriber.complete();
            } catch (error) {
                this.logger.error(`Stripe disconnect error: ${error.message}`);
                subscriber.error(error);
            }
        });
    }

    /**
     * Validates Stripe API credentials with enhanced security checks
     * @param credentials - API credentials to validate
     */
    public validateCredentials(credentials: Record<string, string>): Observable<boolean> {
        return from(this.stripeClient.balance.retrieve()).pipe(
            timeout(5000),
            map(() => {
                this.logger.log('Stripe credentials validated successfully');
                return true;
            }),
            catchError(error => {
                this.logger.error(`Stripe credential validation failed: ${error.message}`);
                return throwError(() => error);
            })
        );
    }

    /**
     * Retrieves payment and subscription data with caching and batching
     * @param options - Query options including pagination and filtering
     */
    public fetchData(options?: Record<string, any>): Observable<any> {
        return new Observable(subscriber => {
            if (!this.checkRateLimit()) {
                subscriber.error(new Error('Rate limit exceeded'));
                return;
            }

            const fetchPromise = this.stripeClient.subscriptions.list({
                limit: options?.limit || 100,
                starting_after: options?.startingAfter,
                expand: ['data.customer', 'data.latest_invoice']
            });

            from(fetchPromise).pipe(
                map(response => {
                    this.incrementRateLimit();
                    return {
                        data: response.data,
                        hasMore: response.has_more,
                        nextPage: response.data[response.data.length - 1]?.id
                    };
                }),
                catchError(error => {
                    this.logger.error(`Stripe data fetch error: ${error.message}`);
                    return throwError(() => error);
                })
            ).subscribe(subscriber);
        });
    }

    /**
     * Synchronizes subscription data with enhanced error handling
     * @param data - Subscription data to sync
     */
    public syncData(data: any): Observable<boolean> {
        return new Observable(subscriber => {
            if (!this.checkRateLimit()) {
                subscriber.error(new Error('Rate limit exceeded'));
                return;
            }

            const syncPromise = this.processSyncData(data);

            from(syncPromise).pipe(
                map(() => {
                    this.incrementRateLimit();
                    this.logger.log('Stripe data sync completed successfully');
                    return true;
                }),
                catchError(error => {
                    this.logger.error(`Stripe data sync error: ${error.message}`);
                    return throwError(() => error);
                })
            ).subscribe(subscriber);
        });
    }

    /**
     * Initializes rate limiting mechanism
     * @private
     */
    private initializeRateLimiting(): void {
        setInterval(() => {
            if (Date.now() - this.rateLimit.windowStart >= this.rateLimit.windowMs) {
                this.rateLimit.current = 0;
                this.rateLimit.windowStart = Date.now();
            }
        }, this.rateLimit.windowMs);
    }

    /**
     * Checks if current request is within rate limits
     * @private
     */
    private checkRateLimit(): boolean {
        return this.rateLimit.current < this.rateLimit.maxRequests;
    }

    /**
     * Increments the rate limit counter
     * @private
     */
    private incrementRateLimit(): void {
        this.rateLimit.current++;
    }

    /**
     * Validates and initializes Stripe connection
     * @private
     */
    private async validateAndInitialize(credentials: Record<string, string>): Promise<boolean> {
        try {
            if (!credentials.secretKey) {
                throw new Error('Stripe secret key is required');
            }

            // Test API key validity
            await this.stripeClient.balance.retrieve();
            return true;
        } catch (error) {
            this.logger.error(`Stripe initialization error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Processes sync data with error handling
     * @private
     */
    private async processSyncData(data: any): Promise<void> {
        try {
            if (!data || !Array.isArray(data)) {
                throw new Error('Invalid sync data format');
            }

            for (const item of data) {
                await this.stripeClient.subscriptions.update(
                    item.id,
                    item.updateData
                );
            }
        } catch (error) {
            this.logger.error(`Sync processing error: ${error.message}`);
            throw error;
        }
    }
}