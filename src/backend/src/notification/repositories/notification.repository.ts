import { Repository, EntityRepository, FindOptionsWhere, QueryRunner } from 'typeorm'; // ^0.3.17
import { NotificationEntity } from '../entities/notification.entity';
import { INotification } from '../interfaces/notification.interface';
import { createPaginationOptions, paginate } from '../../common/utils/pagination.util';
import { PaginatedDto, PaginationOptions } from '../../common/decorators/api-paginated-response.decorator';

/**
 * Repository class for handling notification database operations with support for
 * multi-tenancy, caching, and performance optimization.
 */
@EntityRepository(NotificationEntity)
export class NotificationRepository extends Repository<NotificationEntity> {
    private queryRunner: QueryRunner;
    private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes in seconds

    constructor() {
        super();
        // Initialize query runner for transaction management
        this.queryRunner = this.manager.connection.createQueryRunner();
    }

    /**
     * Find notifications for a specific organization with pagination and caching
     * @param organizationId - Organization identifier for multi-tenant isolation
     * @param options - Pagination options for result set
     * @returns Promise containing paginated notifications with metadata
     */
    async findByOrganizationId(
        organizationId: string,
        options: PaginationOptions
    ): Promise<PaginatedDto<NotificationEntity>> {
        if (!organizationId) {
            throw new Error('Organization ID is required');
        }

        // Create optimized query builder with index hints
        const queryBuilder = this.createQueryBuilder('notification')
            .where('notification.organizationId = :organizationId', { organizationId })
            .orderBy('notification.createdAt', 'DESC')
            .cache(`org_notifications_${organizationId}`, this.DEFAULT_CACHE_TTL);

        // Add pagination with performance optimization
        const { skip, take } = createPaginationOptions(options.page, options.pageSize);
        queryBuilder.skip(skip).take(take);

        // Execute count query with optimization
        const totalItems = await queryBuilder.getCount();

        // Execute paginated query with selected columns
        const notifications = await queryBuilder
            .select([
                'notification.id',
                'notification.type',
                'notification.priority',
                'notification.status',
                'notification.title',
                'notification.message',
                'notification.createdAt'
            ])
            .getMany();

        return paginate(notifications, totalItems, options);
    }

    /**
     * Find notifications for a specific user with pagination and metadata
     * @param userId - User identifier for filtering notifications
     * @param options - Pagination options for result set
     * @returns Promise containing paginated user notifications
     */
    async findByUserId(
        userId: string,
        options: PaginationOptions
    ): Promise<PaginatedDto<NotificationEntity>> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Create query builder with user index hint
        const queryBuilder = this.createQueryBuilder('notification')
            .where('notification.userId = :userId', { userId })
            .orderBy('notification.priority', 'DESC')
            .addOrderBy('notification.createdAt', 'DESC')
            .cache(`user_notifications_${userId}`, this.DEFAULT_CACHE_TTL);

        // Add pagination with optimization
        const { skip, take } = createPaginationOptions(options.page, options.pageSize);
        queryBuilder.skip(skip).take(take);

        // Execute optimized count and data queries
        const [notifications, totalItems] = await queryBuilder
            .select([
                'notification.id',
                'notification.type',
                'notification.priority',
                'notification.status',
                'notification.title',
                'notification.message',
                'notification.createdAt'
            ])
            .getManyAndCount();

        return paginate(notifications, totalItems, options);
    }

    /**
     * Find unread notifications for a user with priority sorting
     * @param userId - User identifier for filtering notifications
     * @returns Promise containing list of unread notifications
     */
    async findUnreadByUserId(userId: string): Promise<NotificationEntity[]> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return this.createQueryBuilder('notification')
            .where('notification.userId = :userId', { userId })
            .andWhere('notification.status = :status', { status: 'UNREAD' })
            .orderBy('notification.priority', 'DESC')
            .addOrderBy('notification.createdAt', 'DESC')
            .cache(`user_unread_${userId}`, this.DEFAULT_CACHE_TTL)
            .select([
                'notification.id',
                'notification.type',
                'notification.priority',
                'notification.title',
                'notification.message',
                'notification.createdAt'
            ])
            .getMany();
    }

    /**
     * Mark multiple notifications as read within a transaction
     * @param userId - User identifier for security validation
     * @param notificationIds - Array of notification IDs to mark as read
     */
    async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
        if (!userId || !notificationIds?.length) {
            throw new Error('User ID and notification IDs are required');
        }

        // Start transaction
        await this.queryRunner.startTransaction();

        try {
            // Update notifications with retry logic
            await this.createQueryBuilder()
                .update(NotificationEntity)
                .set({ status: 'READ' })
                .where('id IN (:...notificationIds)', { notificationIds })
                .andWhere('userId = :userId', { userId })
                .execute();

            // Clear relevant cache entries
            await this.manager.connection.queryResultCache?.remove([
                `user_notifications_${userId}`,
                `user_unread_${userId}`
            ]);

            await this.queryRunner.commitTransaction();
        } catch (error) {
            await this.queryRunner.rollbackTransaction();
            throw error;
        }
    }
}