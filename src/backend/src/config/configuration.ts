import { config } from 'dotenv'; // ^16.0.0
import { ConfigModule, registerAs, ConfigFactory } from '@nestjs/config'; // ^10.0.0
import { TypeOrmModuleOptions } from '@nestjs/typeorm'; // ^10.0.0
import { BullModuleOptions } from '@nestjs/bull'; // ^10.0.0
import * as Joi from 'joi'; // ^17.9.0
import { Injectable } from '@nestjs/common';

// Import internal configurations
import { aiConfig, tensorflow, pytorch, langchain } from './ai.config';
import getCacheConfig from './cache.config';

// Load environment variables
config();

// Configuration schema definition using Joi
const configurationSchema = Joi.object({
  // App Configuration
  APP_NAME: Joi.string().default('SaaS Management Platform'),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  CONFIG_VERSION: Joi.string().default('1.0'),
  AUDIT_ENABLED: Joi.boolean().default(true),

  // Security Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  ENCRYPTION_KEY: Joi.string().required(),
  RATE_LIMIT_WINDOW: Joi.number().default(15),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // AWS Configuration
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(true),

  // Logging Configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
});

// Configuration interface
interface ConfigSchema {
  app: {
    name: string;
    environment: string;
    port: number;
    apiPrefix: string;
    corsOrigins: string[];
    configVersion: string;
    auditEnabled: boolean;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    encryptionKey: string;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  database: TypeOrmModuleOptions;
  cache: ReturnType<typeof getCacheConfig>;
  queue: BullModuleOptions;
  ai: typeof aiConfig;
  aws: {
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  logging: {
    level: string;
  };
}

@Injectable()
export class ConfigurationService {
  private static validateEnvironmentVariables(): void {
    const { error } = configurationSchema.validate(process.env, {
      allowUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }
  }

  private static getDatabaseConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true',
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      entities: ['dist/**/*.entity{.ts,.js}'],
      migrations: ['dist/migrations/*{.ts,.js}'],
      migrationsRun: true,
      keepConnectionAlive: true,
      autoLoadEntities: true,
    };
  }

  private static getQueueConfig(): BullModuleOptions {
    return {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    };
  }
}

// Configuration factory function
export const loadConfiguration = registerAs('config', (): ConfigFactory<ConfigSchema> => {
  // Validate environment variables
  ConfigurationService.validateEnvironmentVariables();

  // Create immutable configuration object
  const configuration: ConfigSchema = Object.freeze({
    app: {
      name: process.env.APP_NAME || 'SaaS Management Platform',
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT, 10) || 3000,
      apiPrefix: process.env.API_PREFIX || 'api/v1',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'],
      configVersion: process.env.CONFIG_VERSION || '1.0',
      auditEnabled: process.env.AUDIT_ENABLED === 'true',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      encryptionKey: process.env.ENCRYPTION_KEY,
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15,
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    },
    database: ConfigurationService.getDatabaseConfig(),
    cache: getCacheConfig(),
    queue: ConfigurationService.getQueueConfig(),
    ai: {
      tensorflow,
      pytorch,
      langchain,
    },
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  return configuration;
});

// Export configuration and its components
export const configuration = {
  app: loadConfiguration().app,
  database: loadConfiguration().database,
  cache: loadConfiguration().cache,
  queue: loadConfiguration().queue,
  ai: loadConfiguration().ai,
  security: loadConfiguration().security,
};

// Export configuration module
export const ConfigurationModule = ConfigModule.forRoot({
  load: [loadConfiguration],
  validationSchema: configurationSchema,
  validationOptions: {
    allowUnknown: true,
    abortEarly: false,
  },
  isGlobal: true,
  cache: true,
});