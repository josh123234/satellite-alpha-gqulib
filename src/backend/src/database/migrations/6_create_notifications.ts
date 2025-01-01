import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'; // ^0.3.17
import { getDatabaseConfig } from '../../config/database.config';

export class CreateNotifications6 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for notification properties
    await queryRunner.query(`
      CREATE TYPE notification_type_enum AS ENUM (
        'SUBSCRIPTION_RENEWAL',
        'USAGE_THRESHOLD',
        'AI_INSIGHT',
        'SYSTEM_ALERT'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE notification_priority_enum AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE notification_status_enum AS ENUM (
        'READ',
        'UNREAD'
      );
    `);

    // Create notifications table
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            comment: 'Unique identifier for the notification'
          },
          {
            name: 'organization_id',
            type: 'uuid',
            comment: 'Reference to the organization this notification belongs to'
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
            comment: 'Reference to the specific user if notification is user-targeted'
          },
          {
            name: 'type',
            type: 'notification_type_enum',
            comment: 'Type of notification (subscription renewal, usage threshold, etc.)'
          },
          {
            name: 'priority',
            type: 'notification_priority_enum',
            default: "'MEDIUM'",
            comment: 'Priority level of the notification'
          },
          {
            name: 'status',
            type: 'notification_status_enum',
            default: "'UNREAD'",
            comment: 'Read/Unread status of the notification'
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            comment: 'Short descriptive title of the notification'
          },
          {
            name: 'message',
            type: 'text',
            comment: 'Detailed notification message content'
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional notification data including delivery channel configuration'
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            comment: 'Timestamp when notification was created'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            comment: 'Timestamp when notification was last updated'
          }
        ],
        indices: [
          {
            name: 'idx_notifications_org_type_created',
            columnNames: ['organization_id', 'type', 'created_at'],
            comment: 'Index for efficient notification filtering by organization and type'
          },
          {
            name: 'idx_notifications_user_status',
            columnNames: ['user_id', 'status'],
            comment: 'Index for efficient user notification queries'
          }
        ]
      }),
      true
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        name: 'fk_notifications_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        name: 'fk_notifications_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      })
    );

    // Create GIN index for JSONB metadata queries
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notifications_metadata',
        columnNames: ['metadata'],
        using: 'GIN',
        comment: 'GIN index for efficient JSONB metadata queries'
      })
    );

    // Add trigger for updated_at timestamp
    await queryRunner.query(`
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON notifications
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
    `);

    // Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE notifications IS 'Stores system-wide notifications including subscription renewals, usage alerts, and AI insights';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_timestamp ON notifications;`);

    // Drop foreign keys
    await queryRunner.dropForeignKey('notifications', 'fk_notifications_user');
    await queryRunner.dropForeignKey('notifications', 'fk_notifications_organization');

    // Drop indices
    await queryRunner.dropIndex('notifications', 'idx_notifications_metadata');
    await queryRunner.dropIndex('notifications', 'idx_notifications_org_type_created');
    await queryRunner.dropIndex('notifications', 'idx_notifications_user_status');

    // Drop table
    await queryRunner.dropTable('notifications');

    // Drop enum types
    await queryRunner.query('DROP TYPE IF EXISTS notification_status_enum;');
    await queryRunner.query('DROP TYPE IF EXISTS notification_priority_enum;');
    await queryRunner.query('DROP TYPE IF EXISTS notification_type_enum;');
  }
}