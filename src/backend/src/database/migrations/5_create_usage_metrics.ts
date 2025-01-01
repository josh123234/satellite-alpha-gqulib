import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'; // ^0.3.17

export class CreateUsageMetrics5 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create ENUM type for metric types
        await queryRunner.query(`
            CREATE TYPE usage_metric_type AS ENUM (
                'ACTIVE_USERS',
                'STORAGE_USED',
                'API_CALLS',
                'BANDWIDTH',
                'COMPUTE_HOURS',
                'DATABASE_SIZE',
                'ERROR_RATE',
                'RESPONSE_TIME',
                'CONCURRENT_USERS',
                'FEATURE_USAGE'
            );
        `);

        // Create the usage_metrics table
        await queryRunner.createTable(new Table({
            name: 'usage_metrics',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'gen_random_uuid()',
                    comment: 'Unique identifier for the usage metric record'
                },
                {
                    name: 'subscription_id',
                    type: 'uuid',
                    isNullable: false,
                    comment: 'Foreign key reference to the subscription this metric belongs to'
                },
                {
                    name: 'recorded_at',
                    type: 'timestamp with time zone',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                    comment: 'Timestamp when the metric was recorded'
                },
                {
                    name: 'metric_type',
                    type: 'usage_metric_type',
                    isNullable: false,
                    comment: 'Type of usage metric being recorded'
                },
                {
                    name: 'value',
                    type: 'numeric(20,5)',
                    isNullable: false,
                    comment: 'Numerical value of the metric'
                },
                {
                    name: 'unit',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                    comment: 'Unit of measurement for the metric value'
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Additional contextual data for the metric'
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                    comment: 'Timestamp when the record was created'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                    comment: 'Timestamp when the record was last updated'
                }
            ],
            indices: [
                {
                    name: 'idx_usage_metrics_subscription_time',
                    columnNames: ['subscription_id', 'recorded_at'],
                    comment: 'Optimizes time-series queries for specific subscriptions'
                },
                {
                    name: 'idx_usage_metrics_type_time',
                    columnNames: ['metric_type', 'recorded_at'],
                    comment: 'Optimizes queries for specific metric types over time'
                },
                {
                    name: 'idx_usage_metrics_metadata',
                    columnNames: ['metadata'],
                    using: 'gin',
                    comment: 'Enables efficient querying of JSONB metadata'
                }
            ]
        }), true);

        // Add foreign key constraint
        await queryRunner.createForeignKey('usage_metrics', new TableForeignKey({
            name: 'fk_usage_metrics_subscription',
            columnNames: ['subscription_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'subscriptions',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }));

        // Create updated_at trigger
        await queryRunner.query(`
            CREATE TRIGGER trg_usage_metrics_updated_at
            BEFORE UPDATE ON usage_metrics
            FOR EACH ROW
            EXECUTE FUNCTION update_timestamp();
        `);

        // Create partitioning function for time-based partitioning
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION create_usage_metrics_partition()
            RETURNS trigger AS $$
            DECLARE
                partition_date text;
                partition_name text;
            BEGIN
                partition_date := to_char(NEW.recorded_at, 'YYYY_MM');
                partition_name := 'usage_metrics_' || partition_date;
                
                IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
                    EXECUTE format(
                        'CREATE TABLE %I PARTITION OF usage_metrics
                        FOR VALUES FROM (%L) TO (%L)',
                        partition_name,
                        date_trunc('month', NEW.recorded_at),
                        date_trunc('month', NEW.recorded_at) + interval '1 month'
                    );
                    
                    -- Create partition-specific indices
                    EXECUTE format(
                        'CREATE INDEX %I ON %I (subscription_id, recorded_at)',
                        'idx_' || partition_name || '_sub_time',
                        partition_name
                    );
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create partition trigger
        await queryRunner.query(`
            CREATE TRIGGER trg_usage_metrics_partition
            BEFORE INSERT ON usage_metrics
            FOR EACH ROW
            EXECUTE FUNCTION create_usage_metrics_partition();
        `);

        // Add table comment
        await queryRunner.query(`
            COMMENT ON TABLE usage_metrics IS 'Stores time-series usage metrics data for SaaS applications with automatic partitioning by month';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers first
        await queryRunner.query('DROP TRIGGER IF EXISTS trg_usage_metrics_partition ON usage_metrics');
        await queryRunner.query('DROP TRIGGER IF EXISTS trg_usage_metrics_updated_at ON usage_metrics');
        
        // Drop functions
        await queryRunner.query('DROP FUNCTION IF EXISTS create_usage_metrics_partition()');
        
        // Drop foreign key
        await queryRunner.dropForeignKey('usage_metrics', 'fk_usage_metrics_subscription');
        
        // Drop table (this will also drop all partitions)
        await queryRunner.dropTable('usage_metrics', true, true);
        
        // Drop enum type
        await queryRunner.query('DROP TYPE IF EXISTS usage_metric_type');
    }
}