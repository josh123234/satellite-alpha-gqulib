import { Factory, Seeder } from 'typeorm-seeding'; // ^1.6.1
import { Connection } from 'typeorm'; // ^0.3.17
import { faker } from '@faker-js/faker'; // ^8.0.0
import { Logger } from 'winston'; // ^3.8.0
import { getDatabaseConfig } from '../../config/database.config';

// Industry types for organizations
const INDUSTRY_TYPES = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Education',
  'Manufacturing',
  'Retail',
  'Professional Services',
  'Media & Entertainment'
];

// Subscription tiers
const SUBSCRIPTION_TIERS = ['Basic', 'Professional', 'Enterprise'];

// Feature flags for organizations
const AVAILABLE_FEATURES = [
  'ai_insights',
  'advanced_analytics',
  'multi_vendor_support',
  'custom_reporting',
  'sso_integration',
  'api_access',
  'audit_logging',
  'cost_optimization'
];

// Sample organization data structure
interface OrganizationSeed {
  name: string;
  industry: string;
  tier: string;
  employee_count: number;
  settings: {
    subscription_preferences: {
      auto_renewal: boolean;
      payment_method: string;
      billing_cycle: string;
      notifications_enabled: boolean;
    };
    notification_settings: {
      email_notifications: boolean;
      slack_notifications: boolean;
      renewal_reminder_days: number[];
      alert_thresholds: {
        cost_increase_percent: number;
        unused_licenses_percent: number;
      };
    };
    security_settings: {
      mfa_required: boolean;
      password_policy: {
        min_length: number;
        require_special_chars: boolean;
        require_numbers: boolean;
        expiry_days: number;
      };
      session_timeout: number;
      ip_whitelist: string[];
    };
    integration_configs: {
      google_workspace: boolean;
      slack: boolean;
      microsoft_365: boolean;
      okta: boolean;
    };
  };
  metadata: {
    created_by: string;
    region: string;
    features_enabled: string[];
    subscription_start_date: Date;
    last_billing_date: Date;
  };
  created_at: Date;
  updated_at: Date;
}

export class OrganizationSeeder implements Seeder {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'seeds.log' })
      ]
    });
  }

  private generateOrganizationData(): OrganizationSeed {
    const tier = faker.helpers.arrayElement(SUBSCRIPTION_TIERS);
    const createdAt = faker.date.past();
    
    return {
      name: faker.company.name(),
      industry: faker.helpers.arrayElement(INDUSTRY_TYPES),
      tier,
      employee_count: faker.number.int({ min: 10, max: 1000 }),
      settings: {
        subscription_preferences: {
          auto_renewal: faker.datatype.boolean(),
          payment_method: faker.helpers.arrayElement(['credit_card', 'bank_transfer', 'paypal']),
          billing_cycle: faker.helpers.arrayElement(['monthly', 'quarterly', 'annual']),
          notifications_enabled: true
        },
        notification_settings: {
          email_notifications: true,
          slack_notifications: faker.datatype.boolean(),
          renewal_reminder_days: [30, 15, 7, 1],
          alert_thresholds: {
            cost_increase_percent: faker.number.int({ min: 10, max: 30 }),
            unused_licenses_percent: faker.number.int({ min: 15, max: 25 })
          }
        },
        security_settings: {
          mfa_required: tier === 'Enterprise',
          password_policy: {
            min_length: faker.number.int({ min: 8, max: 12 }),
            require_special_chars: true,
            require_numbers: true,
            expiry_days: faker.number.int({ min: 60, max: 90 })
          },
          session_timeout: faker.number.int({ min: 30, max: 120 }),
          ip_whitelist: tier === 'Enterprise' ? [faker.internet.ip()] : []
        },
        integration_configs: {
          google_workspace: faker.datatype.boolean(),
          slack: faker.datatype.boolean(),
          microsoft_365: faker.datatype.boolean(),
          okta: tier === 'Enterprise' ? faker.datatype.boolean() : false
        }
      },
      metadata: {
        created_by: faker.internet.email(),
        region: faker.location.countryCode(),
        features_enabled: this.getFeaturesByTier(tier),
        subscription_start_date: createdAt,
        last_billing_date: faker.date.recent()
      },
      created_at: createdAt,
      updated_at: faker.date.recent()
    };
  }

  private getFeaturesByTier(tier: string): string[] {
    switch (tier) {
      case 'Enterprise':
        return AVAILABLE_FEATURES;
      case 'Professional':
        return AVAILABLE_FEATURES.slice(0, 6);
      case 'Basic':
        return AVAILABLE_FEATURES.slice(0, 3);
      default:
        return [];
    }
  }

  private validateOrganizationData(org: OrganizationSeed): boolean {
    try {
      // Required fields validation
      if (!org.name || !org.industry || !org.tier) {
        return false;
      }

      // Date validation
      if (org.created_at > org.updated_at) {
        return false;
      }

      // Settings validation
      if (!org.settings.subscription_preferences || !org.settings.notification_settings) {
        return false;
      }

      // Metadata validation
      if (!org.metadata.created_by || !org.metadata.region) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Organization data validation failed', { error });
      return false;
    }
  }

  public async run(factory: Factory, connection: Connection): Promise<void> {
    try {
      const dbConfig = await getDatabaseConfig();
      const queryRunner = connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Clear existing records in development environment
        if (process.env.NODE_ENV === 'development') {
          await queryRunner.query('TRUNCATE TABLE organizations CASCADE');
          this.logger.info('Cleared existing organization records');
        }

        // Generate and insert organization records
        const organizationsToCreate = 50;
        const organizations: OrganizationSeed[] = [];

        for (let i = 0; i < organizationsToCreate; i++) {
          const orgData = this.generateOrganizationData();
          
          if (this.validateOrganizationData(orgData)) {
            organizations.push(orgData);
          } else {
            this.logger.warn(`Invalid organization data generated for index ${i}`);
          }
        }

        // Batch insert organizations
        await queryRunner.query(
          `INSERT INTO organizations (
            name, industry, tier, employee_count, settings, metadata, created_at, updated_at
          ) VALUES ${organizations.map((org) => `(
            '${org.name}',
            '${org.industry}',
            '${org.tier}',
            ${org.employee_count},
            '${JSON.stringify(org.settings)}'::jsonb,
            '${JSON.stringify(org.metadata)}'::jsonb,
            '${org.created_at.toISOString()}',
            '${org.updated_at.toISOString()}'
          )`).join(',')}`
        );

        await queryRunner.commitTransaction();
        this.logger.info(`Successfully seeded ${organizations.length} organizations`);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Failed to seed organizations', { error });
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error('Organization seeder failed', { error });
      throw error;
    }
  }
}