import { Module } from '@nestjs/common'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { MongooseModule } from '@nestjs/mongoose'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^5.0.0

// Import configuration loader
import { loadConfiguration } from './config/configuration';

// Import core modules
import { AIModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';

/**
 * Root module of the SaaS Management Platform that configures and orchestrates
 * all core modules, global providers, middleware, and database connections.
 * Implements a microservices architecture with modular components.
 */
@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      load: [loadConfiguration],
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // PostgreSQL database configuration for primary data storage
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: ['dist/**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
        ssl: process.env.DB_SSL === 'true',
        autoLoadEntities: true,
        keepConnectionAlive: true,
        retryAttempts: 3,
        retryDelay: 3000,
      }),
    }),

    // MongoDB configuration for document storage
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    }),

    // Redis cache configuration
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
      store: 'redis',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    }),

    // Rate limiting configuration
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 100, // Number of requests allowed per time window
    }),

    // Core feature modules
    AIModule, // AI and machine learning capabilities
    AnalyticsModule, // Analytics and metrics processing
    AuthModule, // Authentication and authorization
  ],
  controllers: [], // No controllers at root level
  providers: [], // No providers at root level
})
export class AppModule {}