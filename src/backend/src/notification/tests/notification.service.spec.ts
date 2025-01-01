import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  INotification
} from '../interfaces/notification.interface';
import {
  CreateNotificationDto,
  BatchNotificationDto,
  NotificationResponseDto
} from '../dto/notification.dto';
import { SocketEventType } from '../../websocket/interfaces/socket-event.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: NotificationRepository;
  let websocketGateway: WebsocketGateway;

  // Test constants
  const TEST_TIMEOUT = 5000;
  const TEST_ORG_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001';

  // Mock notification data
  const mockNotification: INotification = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    organizationId: TEST_ORG_ID,
    userId: TEST_USER_ID,
    type: NotificationType.SUBSCRIPTION_RENEWAL,
    priority: NotificationPriority.HIGH,
    status: NotificationStatus.UNREAD,
    title: 'Test Notification',
    message: 'Test notification message',
    metadata: { subscriptionId: 'sub_123' },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    // Create mock repository
    const mockRepository = {
      save: jest.fn().mockResolvedValue(mockNotification),
      batchCreate: jest.fn().mockResolvedValue([mockNotification]),
      findByOrganizationId: jest.fn().mockResolvedValue({
        data: [mockNotification],
        totalItems: 1,
        page: 1,
        pageSize: 10
      }),
      findByUserId: jest.fn().mockResolvedValue({
        data: [mockNotification],
        totalItems: 1,
        page: 1,
        pageSize: 10
      }),
      findUnreadByUserId: jest.fn().mockResolvedValue([mockNotification]),
      markAsRead: jest.fn().mockResolvedValue(undefined)
    };

    // Create mock websocket gateway
    const mockWebsocketGateway = {
      broadcastToRoom: jest.fn(),
      broadcastToUser: jest.fn(),
      emitNotification: jest.fn(),
      emitBatchNotifications: jest.fn()
    };

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationRepository,
          useValue: mockRepository
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway
        }
      ]
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<NotificationRepository>(NotificationRepository);
    websocketGateway = module.get<WebsocketGateway>(WebsocketGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
    expect(websocketGateway).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create and broadcast a notification', async () => {
      const createDto: CreateNotificationDto = {
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        type: NotificationType.SUBSCRIPTION_RENEWAL,
        priority: NotificationPriority.HIGH,
        title: 'Test Notification',
        message: 'Test notification message',
        metadata: { subscriptionId: 'sub_123' }
      };

      const result = await service.createNotification(createDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: expect.any(String),
        organizationId: createDto.organizationId,
        userId: createDto.userId,
        type: createDto.type,
        priority: createDto.priority,
        status: NotificationStatus.UNREAD
      });

      // Verify WebSocket broadcast was called after delay
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(websocketGateway.broadcastToRoom).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should throw error for invalid notification input', async () => {
      const invalidDto = {
        organizationId: TEST_ORG_ID,
        // Missing required fields
        type: 'INVALID_TYPE',
        message: 'Test message'
      };

      await expect(service.createNotification(invalidDto as any))
        .rejects
        .toThrow('Missing required notification fields');
    });
  });

  describe('createBatchNotifications', () => {
    it('should create and broadcast multiple notifications', async () => {
      const batchDto: BatchNotificationDto[] = [
        {
          organizationId: TEST_ORG_ID,
          userId: TEST_USER_ID,
          type: NotificationType.SUBSCRIPTION_RENEWAL,
          priority: NotificationPriority.HIGH,
          title: 'Test Notification 1',
          message: 'Test message 1',
          metadata: { subscriptionId: 'sub_123' }
        },
        {
          organizationId: TEST_ORG_ID,
          userId: TEST_USER_ID,
          type: NotificationType.USAGE_THRESHOLD,
          priority: NotificationPriority.MEDIUM,
          title: 'Test Notification 2',
          message: 'Test message 2',
          metadata: { subscriptionId: 'sub_124' }
        }
      ];

      const result = await service.createBatchNotifications(batchDto);

      expect(repository.batchCreate).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        organizationId: TEST_ORG_ID,
        status: NotificationStatus.UNREAD
      });
    });

    it('should throw error for batch size exceeding limit', async () => {
      const largeBatchDto = Array(101).fill({
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        type: NotificationType.SUBSCRIPTION_RENEWAL,
        priority: NotificationPriority.HIGH,
        title: 'Test',
        message: 'Test'
      });

      await expect(service.createBatchNotifications(largeBatchDto))
        .rejects
        .toThrow('Batch size cannot exceed 100 notifications');
    });
  });

  describe('getNotificationsByOrganization', () => {
    it('should retrieve paginated notifications for organization', async () => {
      const result = await service.getNotificationsByOrganization(
        TEST_ORG_ID,
        { page: 1, pageSize: 10 }
      );

      expect(repository.findByOrganizationId).toHaveBeenCalledWith(
        TEST_ORG_ID,
        { page: 1, pageSize: 10 }
      );
      expect(result.data).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });
  });

  describe('getUnreadNotifications', () => {
    it('should retrieve unread notifications for user', async () => {
      const result = await service.getUnreadNotifications(TEST_USER_ID);

      expect(repository.findUnreadByUserId).toHaveBeenCalledWith(TEST_USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(NotificationStatus.UNREAD);
    });
  });

  describe('markNotificationsAsRead', () => {
    it('should mark notifications as read and broadcast update', async () => {
      const notificationIds = [mockNotification.id];

      await service.markNotificationsAsRead(TEST_USER_ID, notificationIds);

      expect(repository.markAsRead).toHaveBeenCalledWith(TEST_USER_ID, notificationIds);
      expect(websocketGateway.broadcastToUser).toHaveBeenCalledWith(
        `user_${TEST_USER_ID}`,
        {
          type: SocketEventType.SUBSCRIPTION_UPDATED,
          payload: {
            notificationIds,
            status: NotificationStatus.READ
          }
        }
      );
    });
  });
});