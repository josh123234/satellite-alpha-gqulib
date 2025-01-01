import { Module } from '@nestjs/common'; // ^10.0.0
import { RedisIoAdapter } from '@nestjs/platform-socket.io'; // ^10.0.0
import { WebsocketGateway } from './websocket.gateway';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Module that configures and provides real-time communication capabilities
 * for the SaaS Management Platform. Implements secure WebSocket connections with
 * Redis-based scalability, JWT authentication, and comprehensive monitoring.
 * 
 * Features:
 * - Secure WebSocket connections with JWT authentication
 * - Redis adapter for horizontal scaling
 * - Rate limiting and room-based access control
 * - Real-time event handling for subscriptions, alerts, and insights
 */
@Module({
  imports: [],
  providers: [
    WebsocketGateway,
    {
      provide: 'WS_ADAPTER',
      useFactory: () => {
        const logger = new Logger('WebSocketAdapter');
        
        // Configure Redis adapter for WebSocket scaling
        const redisAdapter = new RedisIoAdapter({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          retryAttempts: 5,
          retryDelay: 3000,
          password: process.env.REDIS_PASSWORD,
          // Enable TLS for production Redis connections
          tls: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: true
          } : undefined
        });

        // Configure adapter settings
        redisAdapter.setOptions({
          cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4200'],
            credentials: true
          },
          pingInterval: 10000,
          pingTimeout: 5000,
          transports: ['websocket'],
          allowUpgrades: false,
          serveClient: false
        });

        logger.log('WebSocket adapter configured with Redis for scalability');
        return redisAdapter;
      }
    }
  ],
  exports: [WebsocketGateway]
})
export class WebsocketModule {
  private readonly logger = new Logger('WebsocketModule');

  constructor() {
    this.logger.log('WebSocket module initialized with security and monitoring');
  }
}