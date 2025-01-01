import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'; // ^0.3.17
import { getDatabaseConfig } from '../../config/database.config';

export class CreateOrganizations1 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extension for UUID generation if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create settings validation function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION validate_organization_settings()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NOT (NEW.settings ? 'timezone' 
          AND NEW.settings ? 'defaultCurrency'
          AND NEW.settings ? 'features') THEN
          RAISE EXCEPTION 'Invalid settings structure';
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create audit trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_organization_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO audit_log (
          table_name,
          record_id,
          action,
          old_values,
          new_values,
          user_id,
          timestamp
        ) VALUES (
          TG_TABLE_NAME,
          NEW.id,
          TG_OP,
          row_to_json(OLD),
          row_to_json(NEW),
          current_setting('app.current_user_id', TRUE),
          CURRENT_TIMESTAMP
        );
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create organizations table
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        schema: (await getDatabaseConfig()).schema,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            comment: 'Unique identifier for the organization',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Organization display name',
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: false,
            default: `'{"timezone": "UTC", "defaultCurrency": "USD", "features": {}}'::jsonb`,
            comment: 'Organization configuration and settings',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            comment: 'Timestamp of organization creation',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            comment: 'Timestamp of last organization update',
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'Soft delete timestamp',
          },
        ],
        indices: [
          {
            name: 'idx_organizations_name',
            columnNames: ['name'],
            isUnique: true,
            where: 'deleted_at IS NULL',
          },
          {
            name: 'idx_organizations_created_at',
            columnNames: ['created_at'],
            using: 'BRIN',
          },
          {
            name: 'idx_organizations_settings',
            columnNames: ['settings'],
            using: 'GIN',
          },
        ],
      }),
      true
    );

    // Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE organizations IS 'Organizations table for multi-tenant SaaS management platform';
    `);

    // Create triggers
    await queryRunner.query(`
      CREATE TRIGGER update_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER validate_organizations_settings
        BEFORE INSERT OR UPDATE ON organizations
        FOR EACH ROW
        EXECUTE FUNCTION validate_organization_settings();
    `);

    await queryRunner.query(`
      CREATE TRIGGER audit_organizations_changes
        AFTER INSERT OR UPDATE OR DELETE ON organizations
        FOR EACH ROW
        EXECUTE FUNCTION audit_organization_changes();
    `);

    // Create row-level security policy
    await queryRunner.query(`
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY organization_tenant_isolation ON organizations
        USING (id::text = current_setting('app.current_organization_id', TRUE))
        WITH CHECK (id::text = current_setting('app.current_organization_id', TRUE));
    `);

    // Grant appropriate permissions
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE ON organizations TO application_user;
      GRANT USAGE ON SEQUENCE organizations_id_seq TO application_user;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop RLS policies
    await queryRunner.query(`
      DROP POLICY IF EXISTS organization_tenant_isolation ON organizations;
    `);

    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_organizations_changes ON organizations;
      DROP TRIGGER IF EXISTS validate_organizations_settings ON organizations;
      DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
    `);

    // Drop trigger functions
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS audit_organization_changes();
      DROP FUNCTION IF EXISTS validate_organization_settings();
      DROP FUNCTION IF EXISTS update_updated_at_column();
    `);

    // Drop table
    await queryRunner.dropTable('organizations', true, true, true);

    // Revoke permissions
    await queryRunner.query(`
      REVOKE ALL PRIVILEGES ON organizations FROM application_user;
    `);
  }
}