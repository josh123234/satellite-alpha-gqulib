import { Controller, Post, Get, Patch, Query, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationService } from './notification.service';
import { 
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationResponseDto,
  BatchNotificationDto
} from './dto/notification.dto';
import { ApiPaginatedResponse, PaginationOptions } from '../common/decorators/api-paginated-response.decorator';
import { PaginatedDto } from '../common/decorators/api-paginated-response.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Controller handling notification management endpoints with real-time capabilities
 * Implements secure API endpoints for creating, retrieving, and managing notifications
 */
@Controller('notifications')
@ApiTags('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiSecurity('bearer')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Creates a new notification with real-time delivery
   */
  @Post()
  @RateLimit({ ttl: 60, limit: 10 })
  @Roles('admin', 'notification-manager')
  @ApiOperation({ summary: 'Create and broadcast a new notification' })
  @ApiResponse({ status: 201, type: NotificationResponseDto })
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @Request() req: { user: JwtPayload }
  ): Promise<NotificationResponseDto> {
    // Ensure organization context
    createNotificationDto.organizationId = req.user.organizationId;
    return this.notificationService.createNotification(createNotificationDto);
  }

  /**
   * Creates multiple notifications in batch
   */
  @Post('batch')
  @RateLimit({ ttl: 60, limit: 5 })
  @Roles('admin', 'notification-manager')
  @ApiOperation({ summary: 'Create multiple notifications in batch' })
  @ApiResponse({ status: 201, type: [NotificationResponseDto] })
  async createBatchNotifications(
    @Body() notifications: BatchNotificationDto[],
    @Request() req: { user: JwtPayload }
  ): Promise<NotificationResponseDto[]> {
    // Set organization context for all notifications
    notifications.forEach(notification => {
      notification.organizationId = req.user.organizationId;
    });
    return this.notificationService.createBatchNotifications(notifications);
  }

  /**
   * Retrieves paginated notifications for an organization
   */
  @Get('organization/:organizationId')
  @RateLimit({ ttl: 60, limit: 30 })
  @Roles('admin', 'org-admin')
  @ApiOperation({ summary: 'Get notifications by organization' })
  @ApiPaginatedResponse(NotificationResponseDto)
  async getNotificationsByOrganization(
    @Param('organizationId') organizationId: string,
    @Query() options: PaginationOptions
  ): Promise<PaginatedDto<NotificationResponseDto>> {
    return this.notificationService.getNotificationsByOrganization(
      organizationId,
      options
    );
  }

  /**
   * Retrieves notifications for a specific user
   */
  @Get('user/:userId')
  @RateLimit({ ttl: 60, limit: 30 })
  @ApiOperation({ summary: 'Get notifications by user' })
  @ApiPaginatedResponse(NotificationResponseDto)
  async getNotificationsByUser(
    @Param('userId') userId: string,
    @Query() options: PaginationOptions,
    @Request() req: { user: JwtPayload }
  ): Promise<PaginatedDto<NotificationResponseDto>> {
    // Ensure user can only access their own notifications
    if (userId !== req.user.sub && !req.user.roles.includes('admin')) {
      throw new Error('Unauthorized access to user notifications');
    }
    return this.notificationService.getNotificationsByUser(userId, options);
  }

  /**
   * Retrieves unread notifications for the current user
   */
  @Get('unread')
  @RateLimit({ ttl: 60, limit: 30 })
  @ApiOperation({ summary: 'Get unread notifications' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  async getUnreadNotifications(
    @Request() req: { user: JwtPayload }
  ): Promise<NotificationResponseDto[]> {
    return this.notificationService.getUnreadNotifications(req.user.sub);
  }

  /**
   * Marks multiple notifications as read
   */
  @Patch('mark-read')
  @RateLimit({ ttl: 60, limit: 20 })
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ status: 200 })
  async markNotificationsAsRead(
    @Body('notificationIds') notificationIds: string[],
    @Request() req: { user: JwtPayload }
  ): Promise<void> {
    return this.notificationService.markNotificationsAsRead(
      req.user.sub,
      notificationIds
    );
  }
}