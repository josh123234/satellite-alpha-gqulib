import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { Logger } from '@nestjs/common';

/**
 * NotificationModule provides comprehensive notification capabilities for the SaaS Management Platform.
 * Implements real-time notifications, multi-channel delivery, and database persistence.
 * 
 * Features:
 * - Real-time WebSocket notifications for subscription updates
 * - Usage threshold alerts and AI insights delivery
 * - Multi-tenant notification management
 * - Scalable notification persistence with TypeORM
 * - Priority-based notification processing
 */
@Module({
  imports: [
    // Configure TypeORM for notification persistence
    TypeOrmModule.forFeature([NotificationEntity]),
    
    // Import WebSocket module for real-time delivery
    WebSocketModule
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    {
      provide: 'NOTIFICATION_LOGGER',
      useFactory: () => {
        return new Logger('NotificationModule');
      }
    }
  ],
  exports: [NotificationService]
})
export class NotificationModule {
  private readonly logger = new Logger('NotificationModule');

  constructor() {
    this.logger.log('Notification module initialized with real-time capabilities');
  }
}