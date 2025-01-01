// rxjs version 7.x - Reactive programming support for asynchronous operations
import { Observable } from 'rxjs';

/**
 * Enumeration of supported third-party service provider types
 */
export enum ProviderType {
    GOOGLE_WORKSPACE = 'GOOGLE_WORKSPACE',
    QUICKBOOKS = 'QUICKBOOKS',
    STRIPE = 'STRIPE'
}

/**
 * Enumeration of possible integration connection states
 */
export enum ConnectionStatus {
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    ERROR = 'ERROR',
    CONNECTING = 'CONNECTING',
    RATE_LIMITED = 'RATE_LIMITED'
}

/**
 * Core interface that defines the contract for all third-party service integrations.
 * Implements comprehensive integration capabilities including authentication,
 * data synchronization, and provider-specific operations.
 */
export interface IntegrationProvider {
    /**
     * Readonly property indicating the type of integration provider
     */
    readonly providerType: ProviderType;

    /**
     * Current connection status of the integration
     */
    connectionStatus: ConnectionStatus;

    /**
     * Establishes secure connection with the third-party service
     * @param credentials - Key-value pairs of required authentication credentials
     * @param options - Optional connection configuration parameters
     * @returns Observable that emits connection success status
     */
    connect(
        credentials: Record<string, string>,
        options?: {
            timeout?: number;
            retryAttempts?: number;
        }
    ): Observable<boolean>;

    /**
     * Safely terminates the connection with the third-party service
     * @param force - Whether to force disconnect ignoring pending operations
     * @returns Observable that emits disconnection success status
     */
    disconnect(force: boolean): Observable<boolean>;

    /**
     * Validates the provided service credentials with comprehensive security checks
     * @param credentials - Key-value pairs of credentials to validate
     * @returns Observable that emits detailed validation result with potential issues
     */
    validateCredentials(
        credentials: Record<string, string>
    ): Observable<{
        valid: boolean;
        issues?: string[];
    }>;

    /**
     * Retrieves data from the third-party service with filtering and pagination support
     * @param options - Optional parameters for data retrieval
     * @returns Observable that emits retrieved data with metadata
     */
    fetchData(options?: {
        filter?: Record<string, any>;
        pagination?: {
            page: number;
            limit: number;
        };
        timeout?: number;
    }): Observable<{
        data: any;
        metadata: {
            total: number;
            page: number;
        };
    }>;

    /**
     * Synchronizes data with the third-party service with conflict resolution
     * @param data - Data to be synchronized
     * @param options - Optional synchronization configuration
     * @returns Observable that emits sync result with conflict details
     */
    syncData(
        data: any,
        options?: {
            conflictResolution?: 'override' | 'merge' | 'skip';
            validation?: boolean;
        }
    ): Observable<{
        success: boolean;
        conflicts?: any[];
    }>;

    /**
     * Retrieves detailed metrics about the integration connection
     * @returns Observable that emits connection performance metrics
     */
    getConnectionMetrics(): Observable<{
        latency: number;
        requestCount: number;
        errorRate: number;
        lastSync: Date;
    }>;
}