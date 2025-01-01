import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { faker } from '@faker-js/faker';
import { NotificationController } from '../notification.controller';
import { NotificationService } from '../notification.service';
import { WebSocketGateway } from '@nestjs/websockets';
import { 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus 
} from '../interfaces/notification.interface';
import { 
  CreateNotificationDto, 
  NotificationResponseDto 
} from '../dto/notification.dto';
import { PaginatedDto } from '../../common/decorators/api-paginated-response.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockNotificationService: MockProxy<NotificationService>;
  let mockWebSocketGateway: MockProxy<WebSocketGateway>;

  // Test data generators
  const generateMockJwtPayload = (): { user: JwtPayload } => ({
    user: {
      sub: faker.string.uuid(),
      email: faker.internet.email(),
      organizationId: faker.string.uuid(),
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: faker.string.uuid(),
      iss: 'saas-platform'
    }
  });

  const generateMockNotification = (): NotificationResponseDto => ({
    id: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    userId: faker.string.uuid(),
    type: NotificationType.SUBSCRIPTION_RENEWAL,
    priority: NotificationPriority.HIGH,
    status: NotificationStatus.UNREAD,
    title: faker.lorem.sentence(),
    message: faker.lorem.paragraph(),
    metadata: { subscriptionId: faker.string.uuid() },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeAll(async () => {
    mockNotificationService = mock<NotificationService>();
    mockWebSocketGateway = mock<WebSocketGateway>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService
        },
        {
          provide: WebSocketGateway,
          useValue: mockWebSocketGateway
        }
      ]
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create notification with proper tenant validation', async () => {
      // Arrange
      const mockPayload = generateMockJwtPayload();
      const mockNotification = generateMockNotification();
      const createDto: CreateNotificationDto = {
        organizationId: mockPayload.user.organizationId,
        userId: mockPayload.user.sub,
        type: NotificationType.SUBSCRIPTION_RENEWAL,
        priority: NotificationPriority.HIGH,
        title: 'Test Notification',
        message: 'Test Message',
        metadata: { test: 'data' }
      };

      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      // Act
      const result = await controller.createNotification(createDto, mockPayload);

      // Assert
      expect(result).toEqual(mockNotification);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockPayload.user.organizationId
        })
      );
    });

    it('should enforce rate limits for notification creation', async () => {
      // Arrange
      const mockPayload = generateMockJwtPayload();
      const createDto = {
        organizationId: mockPayload.user.organizationId,
        userId: mockPayload.user.sub,
        type: NotificationType.SUBSCRIPTION_RENEWAL,
        priority: NotificationPriority.HIGH,
        title: 'Test Notification',
        message: 'Test Message'
      };

      mockNotificationService.createNotification.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      // Act & Assert
      await expect(
        controller.createNotification(createDto, mockPayload)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getNotificationsByOrganization', () => {
    it('should return paginated notifications for organization', async () => {
      // Arrange
      const orgId = faker.string.uuid();
      const mockNotifications = Array(3).fill(null).map(generateMockNotification);
      const mockPaginatedResponse: PaginatedDto<NotificationResponseDto> = {
        data: mockNotifications,
        page: 1,
        pageSize: 10,
        totalItems: 3,
        totalPages: 1
      };

      mockNotificationService.getNotificationsByOrganization.mockResolvedValue(
        mockPaginatedResponse
      );

      // Act
      const result = await controller.getNotificationsByOrganization(
        orgId,
        { page: 1, pageSize: 10 }
      );

      // Assert
      expect(result).toEqual(mockPaginatedResponse);
      expect(mockNotificationService.getNotificationsByOrganization).toHaveBeenCalledWith(
        orgId,
        expect.any(Object)
      );
    });

    it('should validate organization access', async () => {
      // Arrange
      const orgId = faker.string.uuid();
      mockNotificationService.getNotificationsByOrganization.mockRejectedValue(
        new Error('Unauthorized organization access')
      );

      // Act & Assert
      await expect(
        controller.getNotificationsByOrganization(orgId, { page: 1, pageSize: 10 })
      ).rejects.toThrow('Unauthorized organization access');
    });
  });

  describe('getNotificationsByUser', () => {
    it('should return user notifications with proper authorization', async () => {
      // Arrange
      const mockPayload = generateMockJwtPayload();
      const mockNotifications = Array(3).fill(null).map(generateMockNotification);
      const mockPaginatedResponse: PaginatedDto<NotificationResponseDto> = {
        data: mockNotifications,
        page: 1,
        pageSize: 10,
        totalItems: 3,
        totalPages: 1
      };

      mockNotificationService.getNotificationsByUser.mockResolvedValue(
        mockPaginatedResponse
      );

      // Act
      const result = await controller.getNotificationsByUser(
        mockPayload.user.sub,
        { page: 1, pageSize: 10 },
        mockPayload
      );

      // Assert
      expect(result).toEqual(mockPaginatedResponse);
      expect(mockNotificationService.getNotificationsByUser).toHaveBeenCalledWith(
        mockPayload.user.sub,
        expect.any(Object)
      );
    });

    it('should prevent unauthorized access to other user notifications', async () => {
      // Arrange
      const mockPayload = generateMockJwtPayload();
      const otherUserId = faker.string.uuid();

      // Act & Assert
      await expect(
        controller.getNotificationsByUser(
          otherUserId,
          { page: 1, pageSize: 10 },
          { user: { ...mockPayload.user, roles: ['user'] } }
        )
      ).rejects.toThrow('Unauthorized access to user notifications');
    });
  });

  describe('markNotificationsAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      // Arrange
      const mockPayload = generateMockJwtPayload();
      const notificationIds = [faker.string.uuid(), faker.string.uuid()];

      mockNotificationService.markNotificationsAsRead.mockResolvedValue(undefined);

      // Act
      await controller.markNotificationsAsRead(notificationIds, mockPayload);

      // Assert
      expect(mockNotificationService.markNotificationsAsRead).toHaveBeenCalledWith(
        mockPayload.user.sub,
        notificationIds
      );
    });
  });

  afterAll(async () => {
    jest.resetAllMocks();
  });
});