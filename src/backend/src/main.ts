import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

// Global configuration constants
const PORT = process.env.PORT || 3000;

const CORS_OPTIONS = {
  origin: ['https://*.saasplatform.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  maxAge: 3600
};

const HELMET_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:']
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true
};

const RATE_LIMIT_CONFIG = {
  windowMs: 900000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
};

const SWAGGER_CONFIG = {
  title: 'SaaS Management Platform API',
  description: 'Comprehensive API documentation for the SaaS Management Platform',
  version: '1.0',
  tags: ['AI', 'Analytics', 'Discovery', 'Integration'],
  security: [{ bearer: [], oauth2: [] }]
};

async function bootstrap() {
  // Create NestJS application with security settings
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug'],
    cors: CORS_OPTIONS
  });

  // Apply security middleware
  app.use(helmet(HELMET_CONFIG));
  app.use(compression());
  app.use(rateLimit(RATE_LIMIT_CONFIG));

  // Configure request logging
  app.use(morgan('combined'));

  // Apply correlation ID middleware for request tracing
  app.use(new CorrelationIdMiddleware().use);

  // Configure global pipes, filters and interceptors
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true
    },
    validationError: {
      target: false,
      value: false
    }
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Configure API prefix
  app.setGlobalPrefix('api/v1');

  // Configure Swagger documentation
  const config = new DocumentBuilder()
    .setTitle(SWAGGER_CONFIG.title)
    .setDescription(SWAGGER_CONFIG.description)
    .setVersion(SWAGGER_CONFIG.version)
    .addBearerAuth()
    .addOAuth2()
    .addServer('https://api.saasplatform.com')
    .addServer('http://localhost:3000')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    }
  });

  // Configure graceful shutdown
  app.enableShutdownHooks();

  // Start server
  await app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Documentation available at http://localhost:${PORT}/api/docs`);
  });

  // Handle unhandled rejections and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Application specific logging
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});