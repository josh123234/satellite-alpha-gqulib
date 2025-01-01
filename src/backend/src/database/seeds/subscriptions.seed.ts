import { Factory, Seeder } from 'typeorm-seeding'; // ^1.6.1
import { Connection } from 'typeorm'; // ^0.3.17
import { faker } from '@faker-js/faker'; // ^8.0.0
import { Logger } from 'winston'; // ^3.8.2
import { getDatabaseConfig, validateConnection } from '../../config/database.config';
import { ISubscription, SubscriptionStatus, BillingCycle } from '../../discovery/interfaces/subscription.interface';

// Common SaaS providers with their typical cost ranges and billing cycles
const SAAS_PROVIDERS = [
  { name: 'Slack', costRange: { min: 8, max: 15 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'Microsoft 365', costRange: { min: 12, max: 35 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'Google Workspace', costRange: { min: 6, max: 25 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'Salesforce', costRange: { min: 25, max: 300 }, defaultCycle: BillingCycle.ANNUAL },
  { name: 'Zoom', costRange: { min: 15, max: 25 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'Adobe Creative Cloud', costRange: { min: 30, max: 80 }, defaultCycle: BillingCycle.ANNUAL },
  { name: 'Atlassian', costRange: { min: 10, max: 50 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'Dropbox', costRange: { min: 15, max: 25 }, defaultCycle: BillingCycle.MONTHLY },
  { name: 'DocuSign', costRange: { min: 10, max: 40 }, defaultCycle: BillingCycle.ANNUAL },
  { name: 'HubSpot', costRange: { min: 50, max: 1200 }, defaultCycle: BillingCycle.ANNUAL }
];

// Status distribution for realistic data patterns
const STATUS_WEIGHTS = {
  [SubscriptionStatus.ACTIVE]: 0.7,    // 70% active
  [SubscriptionStatus.INACTIVE]: 0.1,  // 10% inactive
  [SubscriptionStatus.PENDING]: 0.1,   // 10% pending
  [SubscriptionStatus.CANCELLED]: 0.05, // 5% cancelled
  [SubscriptionStatus.WARNING]: 0.05   // 5% warning
};

// Environment-specific batch sizes for efficient seeding
const BATCH_SIZES = {
  development: 50,
  test: 20,
  staging: 100,
  production: 0 // Prevent accidental seeding in production
};

export default class SubscriptionSeeder implements Seeder {
  private readonly logger: Logger;
  private readonly batchSize: number;

  constructor() {
    // Initialize logger
    this.logger = new Logger({
      level: process.env.LOG_LEVEL || 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'seeds/subscription-seed.log' })
      ]
    });

    // Set environment-specific batch size
    this.batchSize = BATCH_SIZES[process.env.NODE_ENV] || BATCH_SIZES.development;
  }

  public async run(factory: Factory, connection: Connection): Promise<void> {
    try {
      // Validate database connection
      await validateConnection(await getDatabaseConfig());

      this.logger.info('Starting subscription seed process');

      // Start transaction for data consistency
      const queryRunner = connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Clear existing data in development/test environments
        if (['development', 'test'].includes(process.env.NODE_ENV)) {
          await queryRunner.manager.clear('subscription');
          this.logger.info('Cleared existing subscription data');
        }

        // Fetch organization IDs for proper relationships
        const organizations = await queryRunner.manager.query(
          'SELECT id FROM organization WHERE status = $1',
          ['ACTIVE']
        );

        if (!organizations.length) {
          throw new Error('No active organizations found for seeding subscriptions');
        }

        // Generate and insert subscription data in batches
        for (let i = 0; i < organizations.length; i++) {
          const orgSubscriptions = await this.generateOrgSubscriptions(
            organizations[i].id,
            faker.number.int({ min: 3, max: this.batchSize })
          );

          await queryRunner.manager.save('subscription', orgSubscriptions);
          
          this.logger.info(`Seeded subscriptions for organization ${organizations[i].id}`);
        }

        // Commit transaction
        await queryRunner.commitTransaction();
        this.logger.info('Successfully completed subscription seeding');

      } catch (error) {
        // Rollback on error
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // Release resources
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error('Subscription seeding failed', { error: error.message });
      throw error;
    }
  }

  private async generateOrgSubscriptions(orgId: string, count: number): Promise<ISubscription[]> {
    const subscriptions: ISubscription[] = [];

    for (let i = 0; i < count; i++) {
      const provider = faker.helpers.arrayElement(SAAS_PROVIDERS);
      const status = this.getWeightedStatus();
      const licenses = faker.number.int({ min: 5, max: 500 });
      const usedLicenses = status === SubscriptionStatus.ACTIVE ? 
        faker.number.int({ min: 1, max: licenses }) : 0;

      const subscription: ISubscription = {
        id: faker.string.uuid() as any,
        organizationId: orgId as any,
        name: provider.name,
        description: faker.company.catchPhrase(),
        provider: provider.name,
        cost: faker.number.float({
          min: provider.costRange.min,
          max: provider.costRange.max,
          precision: 2
        }),
        billingCycle: provider.defaultCycle,
        renewalDate: faker.date.future(),
        status,
        totalLicenses: licenses,
        usedLicenses,
        metadata: this.generateMetadata(provider.name, status),
        lastSyncedAt: faker.date.recent(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      // Validate subscription data
      this.validateSubscription(subscription);
      subscriptions.push(subscription);
    }

    return subscriptions;
  }

  private getWeightedStatus(): SubscriptionStatus {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const [status, weight] of Object.entries(STATUS_WEIGHTS)) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return status as SubscriptionStatus;
      }
    }

    return SubscriptionStatus.ACTIVE;
  }

  private generateMetadata(provider: string, status: SubscriptionStatus): Record<string, any> {
    return {
      features: faker.helpers.arrayElements([
        'basic', 'premium', 'enterprise', 'custom'
      ], { min: 1, max: 3 }),
      integrations: faker.helpers.arrayElements([
        'sso', 'api_access', 'audit_logs', 'advanced_security'
      ], { min: 0, max: 4 }),
      usage_metrics: {
        average_daily_users: faker.number.int({ min: 1, max: 100 }),
        peak_concurrent_users: faker.number.int({ min: 5, max: 200 }),
        data_storage_gb: faker.number.float({ min: 0, max: 1000, precision: 2 })
      },
      contract_details: {
        term_length_months: faker.number.int({ min: 12, max: 36 }),
        auto_renewal: faker.datatype.boolean(),
        cancellation_notice_days: faker.number.int({ min: 30, max: 90 })
      },
      support_level: faker.helpers.arrayElement([
        'basic', 'standard', 'premium', '24x7'
      ]),
      compliance: {
        gdpr_compliant: faker.datatype.boolean(),
        hipaa_compliant: faker.datatype.boolean(),
        soc2_compliant: faker.datatype.boolean()
      },
      status_history: this.generateStatusHistory(status)
    };
  }

  private generateStatusHistory(currentStatus: SubscriptionStatus): Array<{
    status: SubscriptionStatus;
    timestamp: Date;
    reason?: string;
  }> {
    const history = [];
    const startDate = faker.date.past({ years: 2 });
    
    // Always start with PENDING
    history.push({
      status: SubscriptionStatus.PENDING,
      timestamp: startDate,
      reason: 'Initial subscription creation'
    });

    // Add ACTIVE status after PENDING
    history.push({
      status: SubscriptionStatus.ACTIVE,
      timestamp: faker.date.between({ from: startDate, to: new Date() }),
      reason: 'Subscription activated'
    });

    // Add current status if different from ACTIVE
    if (currentStatus !== SubscriptionStatus.ACTIVE) {
      history.push({
        status: currentStatus,
        timestamp: faker.date.recent(),
        reason: this.getStatusChangeReason(currentStatus)
      });
    }

    return history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getStatusChangeReason(status: SubscriptionStatus): string {
    const reasons = {
      [SubscriptionStatus.INACTIVE]: 'Temporary suspension due to payment issue',
      [SubscriptionStatus.CANCELLED]: 'Customer requested cancellation',
      [SubscriptionStatus.WARNING]: 'Approaching license limit',
      [SubscriptionStatus.PENDING]: 'Awaiting account setup completion'
    };

    return reasons[status] || 'Status changed by system';
  }

  private validateSubscription(subscription: ISubscription): void {
    if (!subscription.organizationId) {
      throw new Error('Organization ID is required');
    }

    if (subscription.cost < 0) {
      throw new Error('Cost cannot be negative');
    }

    if (subscription.usedLicenses > subscription.totalLicenses) {
      throw new Error('Used licenses cannot exceed total licenses');
    }

    if (subscription.renewalDate < new Date()) {
      throw new Error('Renewal date must be in the future');
    }
  }
}