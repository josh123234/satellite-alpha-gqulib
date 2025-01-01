import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'; // ^0.3.17
import { getDatabaseConfig } from '../../config/database.config';

export class CreateSubscriptions2 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create billing_cycle enum type
    await queryRunner.query(`
      CREATE TYPE subscription_billing_cycle AS ENUM (
        'MONTHLY', 
        'QUARTERLY', 
        'ANNUAL'
      )
    `);

    // Create subscription status enum type
    await queryRunner.query(`
      CREATE TYPE subscription_status AS ENUM (
        'ACTIVE',
        'INACTIVE',
        'PENDING',
        'CANCELLED'
      )
    `);

    // Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            comment: 'Unique identifier for the subscription'
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to the organization that owns this subscription'
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Name of the SaaS subscription'
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
            comment: 'Detailed description of the subscription'
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Name of the SaaS provider'
          },
          {
            name: 'cost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
            comment: 'Monthly cost of the subscription'
          },
          {
            name: 'billing_cycle',
            type: 'subscription_billing_cycle',
            isNullable: false,
            comment: 'Billing frequency: MONTHLY, QUARTERLY, or ANNUAL'
          },
          {
            name: 'renewal_date',
            type: 'timestamp with time zone',
            isNullable: false,
            comment: 'Next renewal date of the subscription'
          },
          {
            name: 'status',
            type: 'subscription_status',
            default: "'PENDING'",
            isNullable: false,
            comment: 'Current status of the subscription'
          },
          {
            name: 'total_licenses',
            type: 'integer',
            isNullable: false,
            comment: 'Total number of licenses available'
          },
          {
            name: 'used_licenses',
            type: 'integer',
            isNullable: false,
            default: 0,
            comment: 'Number of licenses currently in use'
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional subscription metadata stored as JSON'
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Timestamp when the subscription was created'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Timestamp when the subscription was last updated'
          }
        ]
      }),
      true
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        name: 'fk_subscription_organization',
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      })
    );

    // Add composite index for organization_id and status
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'idx_subscription_org_status',
        columnNames: ['organization_id', 'status'],
        comment: 'Improves performance of filtered queries by organization and status'
      })
    );

    // Add BRIN index on renewal_date for efficient date range queries
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'idx_subscription_renewal_date',
        columnNames: ['renewal_date'],
        isUnique: false,
        using: 'BRIN',
        comment: 'Optimizes date range queries on renewal_date'
      })
    );

    // Add GIN index on metadata for JSON search
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'idx_subscription_metadata',
        columnNames: ['metadata'],
        using: 'GIN',
        comment: 'Enables efficient JSON search on metadata'
      })
    );

    // Add partial index for active subscriptions
    await queryRunner.query(`
      CREATE INDEX idx_subscription_active 
      ON subscriptions (id) 
      WHERE status = 'ACTIVE'
    `);

    // Add check constraints
    await queryRunner.query(`
      ALTER TABLE subscriptions 
      ADD CONSTRAINT chk_subscription_cost_positive 
      CHECK (cost >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions 
      ADD CONSTRAINT chk_subscription_licenses_valid 
      CHECK (used_licenses >= 0 AND used_licenses <= total_licenses)
    `);

    // Add trigger for updating updated_at timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_subscription_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_subscription_timestamp
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_subscription_timestamp();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_subscription_timestamp ON subscriptions`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_subscription_timestamp`);

    // Drop indexes
    await queryRunner.dropIndex('subscriptions', 'idx_subscription_org_status');
    await queryRunner.dropIndex('subscriptions', 'idx_subscription_renewal_date');
    await queryRunner.dropIndex('subscriptions', 'idx_subscription_metadata');
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscription_active`);

    // Drop foreign key
    await queryRunner.dropForeignKey('subscriptions', 'fk_subscription_organization');

    // Drop table
    await queryRunner.dropTable('subscriptions', true);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS subscription_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS subscription_billing_cycle`);
  }
}