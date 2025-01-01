import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'; // ^0.3.17

export class CreateLicenses4 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for license status
        await queryRunner.query(`
            CREATE TYPE license_status AS ENUM (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'REVOKED'
            );
        `);

        // Create licenses table
        await queryRunner.createTable(new Table({
            name: 'licenses',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    default: 'uuid_generate_v4()',
                    comment: 'Unique identifier for the license'
                },
                {
                    name: 'subscription_id',
                    type: 'uuid',
                    isNullable: false,
                    comment: 'Reference to the parent subscription'
                },
                {
                    name: 'user_id',
                    type: 'uuid',
                    isNullable: true,
                    comment: 'Reference to the assigned user, nullable for unassigned licenses'
                },
                {
                    name: 'assigned_date',
                    type: 'timestamp',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                    comment: 'Date when the license was assigned'
                },
                {
                    name: 'status',
                    type: 'license_status',
                    isNullable: false,
                    default: "'ACTIVE'",
                    comment: 'Current status of the license'
                },
                {
                    name: 'last_used_at',
                    type: 'timestamp',
                    isNullable: true,
                    comment: 'Timestamp of last license usage'
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: false,
                    default: '{}',
                    comment: 'Additional license metadata and attributes'
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                    comment: 'Timestamp when the license was created'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                    comment: 'Timestamp when the license was last updated'
                }
            ],
            indices: [
                {
                    name: 'idx_licenses_subscription_status',
                    columnNames: ['subscription_id', 'status']
                },
                {
                    name: 'idx_licenses_user',
                    columnNames: ['user_id']
                },
                {
                    name: 'idx_licenses_active',
                    columnNames: ['status'],
                    where: "status = 'ACTIVE'"
                },
                {
                    name: 'idx_licenses_last_used',
                    columnNames: ['last_used_at']
                }
            ]
        }), true);

        // Add foreign key constraints
        await queryRunner.createForeignKey('licenses', new TableForeignKey({
            name: 'fk_licenses_subscription',
            columnNames: ['subscription_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'subscriptions',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }));

        await queryRunner.createForeignKey('licenses', new TableForeignKey({
            name: 'fk_licenses_user',
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        }));

        // Create updated_at trigger
        await queryRunner.query(`
            CREATE TRIGGER update_licenses_updated_at
                BEFORE UPDATE ON licenses
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);

        // Add table comment
        await queryRunner.query(`
            COMMENT ON TABLE licenses IS 'Tracks license assignments and usage for SaaS subscriptions';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        await queryRunner.dropForeignKey('licenses', 'fk_licenses_subscription');
        await queryRunner.dropForeignKey('licenses', 'fk_licenses_user');

        // Drop trigger
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_licenses_updated_at ON licenses;
        `);

        // Drop table
        await queryRunner.dropTable('licenses', true, true, true);

        // Drop enum type
        await queryRunner.query(`DROP TYPE IF EXISTS license_status;`);
    }
}