import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm'; // ^10.0.0
import { registerAs } from '@nestjs/config'; // ^10.0.0
import { Logger } from 'winston'; // ^3.8.0
import { encrypt } from '../common/utils/encryption.util';

// Database configuration interface
interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  ssl: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    ca?: string;
    key?: string;
    cert?: string;
  };
  replication: {
    enabled: boolean;
    master: {
      host: string;
      port: number;
    };
    slaves: Array<{ host: string; port: number }>;
  };
  pooling: {
    min: number;
    max: number;
    idleTimeout: number;
    acquireTimeout: number;
  };
  monitoring: {
    logging: boolean;
    slowQueryThreshold: number;
    maxQueryExecutionTime: number;
    enableMetrics: boolean;
  };
  security: {
    enableEncryption: boolean;
    encryptionKey?: string;
    enableAudit: boolean;
  };
}

@Injectable()
export class DatabaseConfigService {
  private readonly logger: Logger;
  private config: DatabaseConfig;

  constructor() {
    this.initializeLogger();
    this.loadConfiguration();
  }

  private initializeLogger(): void {
    this.logger = new Logger({
      level: process.env.LOG_LEVEL || 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'database.log' })
      ]
    });
  }

  private loadConfiguration(): void {
    this.config = {
      type: process.env.DB_TYPE || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      schema: process.env.DB_SCHEMA || 'public',
      ssl: {
        enabled: process.env.DB_SSL === 'true',
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        ca: process.env.DB_SSL_CA,
        key: process.env.DB_SSL_KEY,
        cert: process.env.DB_SSL_CERT
      },
      replication: {
        enabled: process.env.DB_REPLICATION === 'true',
        master: {
          host: process.env.DB_MASTER_HOST,
          port: parseInt(process.env.DB_MASTER_PORT, 10) || 5432
        },
        slaves: JSON.parse(process.env.DB_SLAVES || '[]')
      },
      pooling: {
        min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
        max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
        idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
        acquireTimeout: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT, 10) || 20000
      },
      monitoring: {
        logging: process.env.DB_LOGGING === 'true',
        slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_MS, 10) || 1000,
        maxQueryExecutionTime: parseInt(process.env.DB_MAX_QUERY_TIME, 10) || 10000,
        enableMetrics: process.env.DB_METRICS === 'true'
      },
      security: {
        enableEncryption: process.env.DB_ENCRYPT === 'true',
        encryptionKey: process.env.DB_ENCRYPTION_KEY,
        enableAudit: process.env.DB_AUDIT === 'true'
      }
    };
  }

  private async encryptSensitiveData(): Promise<void> {
    if (this.config.security.enableEncryption && this.config.security.encryptionKey) {
      this.config.password = (await encrypt(
        this.config.password,
        this.config.security.encryptionKey
      )).data;
    }
  }

  private validateConfig(): boolean {
    const requiredFields = ['host', 'port', 'username', 'password', 'database'];
    const missingFields = requiredFields.filter(field => !this.config[field]);

    if (missingFields.length > 0) {
      this.logger.error('Missing required database configuration fields', { missingFields });
      return false;
    }

    if (this.config.replication.enabled && !this.config.replication.master.host) {
      this.logger.error('Master host is required when replication is enabled');
      return false;
    }

    return true;
  }

  private getReplicationConfig(): any {
    if (!this.config.replication.enabled) {
      return {};
    }

    return {
      master: {
        host: this.config.replication.master.host,
        port: this.config.replication.master.port,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database
      },
      slaves: this.config.replication.slaves.map(slave => ({
        host: slave.host,
        port: slave.port,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database
      }))
    };
  }

  private getSSLConfig(): any {
    if (!this.config.ssl.enabled) {
      return false;
    }

    return {
      rejectUnauthorized: this.config.ssl.rejectUnauthorized,
      ca: this.config.ssl.ca,
      key: this.config.ssl.key,
      cert: this.config.ssl.cert
    };
  }

  async getDatabaseConfig(): Promise<TypeOrmModuleOptions> {
    if (!this.validateConfig()) {
      throw new Error('Invalid database configuration');
    }

    await this.encryptSensitiveData();

    const baseConfig: TypeOrmModuleOptions = {
      type: this.config.type as any,
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      database: this.config.database,
      schema: this.config.schema,
      ssl: this.getSSLConfig(),
      synchronize: false,
      logging: this.config.monitoring.logging,
      maxQueryExecutionTime: this.config.monitoring.maxQueryExecutionTime,
      entities: ['dist/**/*.entity{.ts,.js}'],
      migrations: ['dist/migrations/*{.ts,.js}'],
      migrationsRun: true,
      keepConnectionAlive: true,
      autoLoadEntities: true,
      extra: {
        max: this.config.pooling.max,
        min: this.config.pooling.min,
        idleTimeoutMillis: this.config.pooling.idleTimeout,
        connectionTimeoutMillis: this.config.pooling.acquireTimeout,
        application_name: 'saas_management_platform',
        statement_timeout: this.config.monitoring.maxQueryExecutionTime
      }
    };

    if (this.config.replication.enabled) {
      baseConfig.replication = this.getReplicationConfig();
    }

    return baseConfig;
  }
}

export const databaseConfig = registerAs('database', async () => {
  const configService = new DatabaseConfigService();
  return await configService.getDatabaseConfig();
});

export const validateConfig = (config: TypeOrmModuleOptions): boolean => {
  const configService = new DatabaseConfigService();
  return configService['validateConfig']();
};