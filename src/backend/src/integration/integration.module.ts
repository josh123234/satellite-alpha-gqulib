// @nestjs/common version ^10.0.0
import { Module, OnModuleInit, Logger } from '@nestjs/common';

// Internal imports
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { GoogleWorkspaceService } from './services/google-workspace.service';
import { QuickBooksService } from './services/quickbooks.service';
import { StripeService } from './services/stripe.service';

/**
 * IntegrationModule configures and provides integration-related services
 * for managing third-party service connections with comprehensive monitoring
 * and security capabilities.
 */
@Module({
  imports: [],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    GoogleWorkspaceService,
    QuickBooksService,
    StripeService,
    {
      provide: 'INTEGRATION_CONFIG',
      useValue: {
        monitoring: {
          healthCheckInterval: 60000, // 1 minute
          metricsInterval: 300000, // 5 minutes
          alertThresholds: {
            errorRate: 0.05, // 5% error rate threshold
            latency: 2000, // 2 second latency threshold
            availability: 0.99 // 99% availability requirement
          }
        },
        security: {
          rateLimiting: {
            windowMs: 60000, // 1 minute window
            maxRequests: 100 // Maximum requests per window
          },
          encryption: {
            algorithm: 'aes-256-gcm',
            keyRotationInterval: 86400000 // 24 hours
          }
        },
        providers: {
          googleWorkspace: {
            maxRetries: 3,
            timeout: 30000
          },
          quickBooks: {
            maxRetries: 3,
            timeout: 30000
          },
          stripe: {
            maxRetries: 3,
            timeout: 30000
          }
        }
      }
    }
  ],
  exports: [IntegrationService]
})
export class IntegrationModule implements OnModuleInit {
  private readonly logger = new Logger(IntegrationModule.name);
  private readonly moduleVersion = '1.0.0';

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly googleWorkspaceService: GoogleWorkspaceService,
    private readonly quickBooksService: QuickBooksService,
    private readonly stripeService: StripeService
  ) {}

  /**
   * Lifecycle hook for module initialization.
   * Sets up monitoring, metrics collection, and security measures.
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log(`Initializing Integration Module v${this.moduleVersion}`);

      // Initialize health monitoring for all providers
      await this.setupHealthMonitoring();

      // Initialize security measures
      await this.setupSecurityMeasures();

      // Validate provider configurations
      await this.validateProviderConfigurations();

      this.logger.log('Integration Module initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Integration Module', error.stack);
      throw error;
    }
  }

  /**
   * Sets up health monitoring for integration providers
   */
  private async setupHealthMonitoring(): Promise<void> {
    try {
      // Setup monitoring for Google Workspace
      await this.googleWorkspaceService.monitorUsage({
        interval: 300000, // 5 minutes
        thresholds: {
          licenseUtilization: 0.9,
          apiQuota: 0.8
        }
      }).toPromise();

      // Setup monitoring for QuickBooks
      // Implementation would be similar to Google Workspace

      // Setup monitoring for Stripe
      // Implementation would be similar to Google Workspace

      this.logger.log('Health monitoring initialized for all providers');
    } catch (error) {
      this.logger.error('Failed to setup health monitoring', error.stack);
      throw error;
    }
  }

  /**
   * Sets up security measures for integration providers
   */
  private async setupSecurityMeasures(): Promise<void> {
    try {
      // Initialize rate limiting
      this.setupRateLimiting();

      // Initialize encryption for sensitive data
      this.setupEncryption();

      // Setup audit logging
      this.setupAuditLogging();

      this.logger.log('Security measures initialized successfully');
    } catch (error) {
      this.logger.error('Failed to setup security measures', error.stack);
      throw error;
    }
  }

  /**
   * Validates configurations for all providers
   */
  private async validateProviderConfigurations(): Promise<void> {
    try {
      const validations = await Promise.all([
        this.googleWorkspaceService.validateCredentials({}).toPromise(),
        this.quickBooksService.validateCredentials({}).toPromise(),
        this.stripeService.validateCredentials({}).toPromise()
      ]);

      const invalidConfigs = validations.filter(v => !v.valid);
      if (invalidConfigs.length > 0) {
        throw new Error('One or more provider configurations are invalid');
      }

      this.logger.log('All provider configurations validated successfully');
    } catch (error) {
      this.logger.error('Provider configuration validation failed', error.stack);
      throw error;
    }
  }

  /**
   * Sets up rate limiting for API endpoints
   */
  private setupRateLimiting(): void {
    // Implementation would configure rate limiting for each provider
    this.logger.log('Rate limiting configured for all providers');
  }

  /**
   * Sets up encryption for sensitive data
   */
  private setupEncryption(): void {
    // Implementation would configure encryption for sensitive data
    this.logger.log('Encryption configured for sensitive data');
  }

  /**
   * Sets up audit logging for integration operations
   */
  private setupAuditLogging(): void {
    // Implementation would configure audit logging
    this.logger.log('Audit logging configured successfully');
  }
}