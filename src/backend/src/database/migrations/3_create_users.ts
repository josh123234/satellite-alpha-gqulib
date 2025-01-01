import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for user roles and status
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM (
        'admin',
        'finance_manager',
        'department_manager',
        'user'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE user_status_enum AS ENUM (
        'active',
        'inactive',
        'pending'
      );
    `);

    // Create users table with comprehensive fields and constraints
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
        password_hash VARCHAR(255) NOT NULL CHECK (length(password_hash) >= 60),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role user_role_enum NOT NULL,
        org_id UUID NOT NULL,
        department VARCHAR(100),
        status user_status_enum NOT NULL DEFAULT 'pending',
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        CONSTRAINT usr_org_fk FOREIGN KEY (org_id)
          REFERENCES organizations(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );

      -- Create indexes for optimized query performance
      CREATE UNIQUE INDEX idx_users_email ON users USING btree (email);
      CREATE INDEX idx_users_org_role ON users USING btree (org_id, role);
      CREATE INDEX idx_users_department ON users USING btree (department);
      CREATE INDEX idx_users_active ON users USING btree (org_id) WHERE status = 'active';

      -- Create updated_at trigger function
      CREATE OR REPLACE FUNCTION update_users_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Create trigger for updated_at
      CREATE TRIGGER users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_users_updated_at();

      -- Add table and column comments for documentation
      COMMENT ON TABLE users IS 'Stores user information with enhanced RBAC and organization relationships';
      COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
      COMMENT ON COLUMN users.email IS 'User email address - must be unique and valid format';
      COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password - minimum 60 characters';
      COMMENT ON COLUMN users.first_name IS 'User first name';
      COMMENT ON COLUMN users.last_name IS 'User last name';
      COMMENT ON COLUMN users.role IS 'User role for RBAC - admin, finance_manager, department_manager, or user';
      COMMENT ON COLUMN users.org_id IS 'Foreign key to organizations table';
      COMMENT ON COLUMN users.department IS 'Optional department association for department-level access control';
      COMMENT ON COLUMN users.status IS 'User account status - active, inactive, or pending';
      COMMENT ON COLUMN users.last_login IS 'Timestamp of last successful login for security monitoring';
      COMMENT ON COLUMN users.created_at IS 'Timestamp of user creation';
      COMMENT ON COLUMN users.updated_at IS 'Timestamp of last user record update';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all related objects in correct order
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS users_updated_at ON users;
      DROP FUNCTION IF EXISTS update_users_updated_at();
      DROP INDEX IF EXISTS idx_users_active;
      DROP INDEX IF EXISTS idx_users_department;
      DROP INDEX IF EXISTS idx_users_org_role;
      DROP INDEX IF EXISTS idx_users_email;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TYPE IF EXISTS user_status_enum;
      DROP TYPE IF EXISTS user_role_enum;
    `);
  }
}