import { Factory, Seeder } from 'typeorm-seeding'; // ^1.6.1
import { Connection } from 'typeorm'; // ^0.3.17
import { hash } from 'bcrypt'; // ^5.1.1
import { getDatabaseConfig } from '../../config/database.config';

// Constants
const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'changeme123';
const BATCH_SIZE = 100;

// Sample user data structure
interface UserSeed {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'finance_manager' | 'department_manager' | 'user';
  org_id: string;
  department: string;
  status: 'active' | 'inactive' | 'pending';
  metadata: Record<string, any>;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export default class UserSeeder implements Seeder {
  private readonly departments = [
    'Engineering',
    'Finance',
    'Marketing',
    'Sales',
    'Human Resources',
    'Operations',
    'Product',
    'Customer Success'
  ];

  public async run(factory: Factory, connection: Connection): Promise<void> {
    try {
      // Start transaction for atomic operation
      const queryRunner = connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Clear existing users in development environment
        if (process.env.NODE_ENV === 'development') {
          await queryRunner.manager.query('TRUNCATE TABLE users CASCADE');
        }

        // Get organization IDs from the database
        const organizations = await queryRunner.manager.query(
          'SELECT id FROM organizations WHERE deleted_at IS NULL'
        );

        if (!organizations.length) {
          throw new Error('No organizations found for user seeding');
        }

        // Hash default password
        const defaultPasswordHash = await hash(DEFAULT_PASSWORD, SALT_ROUNDS);

        // Generate seed data for different user roles
        const users: UserSeed[] = [];

        // Admin users (1 per organization)
        for (const org of organizations) {
          users.push(this.createUserSeed({
            role: 'admin',
            org_id: org.id,
            department: 'IT',
            password_hash: defaultPasswordHash
          }));
        }

        // Finance managers (2 per organization)
        for (const org of organizations) {
          for (let i = 0; i < 2; i++) {
            users.push(this.createUserSeed({
              role: 'finance_manager',
              org_id: org.id,
              department: 'Finance',
              password_hash: defaultPasswordHash
            }));
          }
        }

        // Department managers (1 per department per organization)
        for (const org of organizations) {
          for (const department of this.departments) {
            users.push(this.createUserSeed({
              role: 'department_manager',
              org_id: org.id,
              department,
              password_hash: defaultPasswordHash
            }));
          }
        }

        // Regular users (10-20 per organization)
        for (const org of organizations) {
          const userCount = Math.floor(Math.random() * 11) + 10; // 10-20 users
          for (let i = 0; i < userCount; i++) {
            users.push(this.createUserSeed({
              role: 'user',
              org_id: org.id,
              department: this.departments[Math.floor(Math.random() * this.departments.length)],
              password_hash: defaultPasswordHash
            }));
          }
        }

        // Insert users in batches
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
          const batch = users.slice(i, i + BATCH_SIZE);
          await queryRunner.manager.query(`
            INSERT INTO users (
              email, password_hash, first_name, last_name, role,
              org_id, department, status, metadata, last_login,
              created_at, updated_at, deleted_at
            )
            VALUES ${batch.map(user => `(
              '${user.email}',
              '${user.password_hash}',
              '${user.first_name}',
              '${user.last_name}',
              '${user.role}',
              '${user.org_id}',
              '${user.department}',
              '${user.status}',
              '${JSON.stringify(user.metadata)}',
              ${user.last_login ? `'${user.last_login.toISOString()}'` : 'NULL'},
              '${user.created_at.toISOString()}',
              '${user.updated_at.toISOString()}',
              ${user.deleted_at ? `'${user.deleted_at.toISOString()}'` : 'NULL'}
            )`).join(',')}
          `);
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('Error seeding users:', error);
      throw error;
    }
  }

  private createUserSeed(params: {
    role: UserSeed['role'];
    org_id: string;
    department: string;
    password_hash: string;
  }): UserSeed {
    const now = new Date();
    const firstName = this.generateRandomName();
    const lastName = this.generateRandomName();

    return {
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      password_hash: params.password_hash,
      first_name: firstName,
      last_name: lastName,
      role: params.role,
      org_id: params.org_id,
      department: params.department,
      status: 'active',
      metadata: {
        title: this.generateTitle(params.role, params.department),
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        },
        security: {
          mfa_enabled: params.role === 'admin',
          last_password_change: now.toISOString(),
          password_expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      last_login: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };
  }

  private generateRandomName(): string {
    const names = [
      'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
      'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  private generateTitle(role: UserSeed['role'], department: string): string {
    switch (role) {
      case 'admin':
        return 'System Administrator';
      case 'finance_manager':
        return 'Finance Manager';
      case 'department_manager':
        return `${department} Manager`;
      default:
        return `${department} Specialist`;
    }
  }
}