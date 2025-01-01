// @nestjs/swagger version 10.x
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// class-validator version 0.14.x
import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from '../interfaces/notification.interface';

/**
 * DTO for creating new notifications with comprehensive validation and documentation
 */
export class CreateNotificationDto {
  @IsUUID(4)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Organization ID (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  organizationId: string;

  @IsUUID(4)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Target user ID (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174001'
  })
  userId: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  @ApiProperty({
    enum: NotificationType,
    description: 'Type of notification (SUBSCRIPTION_RENEWAL, USAGE_THRESHOLD, AI_INSIGHT, SYSTEM_ALERT)',
    example: 'SUBSCRIPTION_RENEWAL'
  })
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsNotEmpty()
  @ApiProperty({
    enum: NotificationPriority,
    description: 'Priority level (LOW, MEDIUM, HIGH, URGENT)',
    example: 'HIGH'
  })
  priority: NotificationPriority;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  @ApiProperty({
    description: 'Notification title (5-100 characters)',
    example: 'Subscription Renewal Alert'
  })
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  @ApiProperty({
    description: 'Notification message content (10-1000 characters)',
    example: 'Your subscription for Adobe CC will expire in 30 days.'
  })
  message: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description: 'Additional notification metadata for extensibility',
    example: { subscriptionId: '123', renewalDate: '2024-03-15' }
  })
  metadata?: Record<string, any>;
}

/**
 * DTO for updating notification status with validation
 */
export class UpdateNotificationDto {
  @IsEnum(NotificationStatus)
  @IsNotEmpty()
  @ApiProperty({
    enum: NotificationStatus,
    description: 'Updated notification status (UNREAD, READ, ARCHIVED)',
    example: 'READ'
  })
  status: NotificationStatus;
}

/**
 * DTO for notification responses with complete entity representation
 */
export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique notification identifier (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174002'
  })
  id: string;

  @ApiProperty({
    description: 'Organization identifier',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  organizationId: string;

  @ApiProperty({
    description: 'Target user identifier',
    example: '123e4567-e89b-12d3-a456-426614174001'
  })
  userId: string;

  @ApiProperty({
    enum: NotificationType,
    description: 'Notification type',
    example: 'SUBSCRIPTION_RENEWAL'
  })
  type: NotificationType;

  @ApiProperty({
    enum: NotificationPriority,
    description: 'Notification priority',
    example: 'HIGH'
  })
  priority: NotificationPriority;

  @ApiProperty({
    enum: NotificationStatus,
    description: 'Current notification status',
    example: 'UNREAD'
  })
  status: NotificationStatus;

  @ApiProperty({
    description: 'Notification title',
    example: 'Subscription Renewal Alert'
  })
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your subscription for Adobe CC will expire in 30 days.'
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { subscriptionId: '123', renewalDate: '2024-03-15' }
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Notification creation timestamp',
    example: '2024-01-20T12:00:00Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-20T12:00:00Z'
  })
  updatedAt: Date;
}