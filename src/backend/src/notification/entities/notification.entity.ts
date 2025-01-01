import { 
    Entity, 
    Column, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn
} from 'typeorm'; // ^0.3.17

import {
    INotification,
    NotificationType,
    NotificationPriority,
    NotificationStatus
} from '../interfaces/notification.interface';

/**
 * Entity class representing notifications in the database.
 * Implements comprehensive support for real-time alerts, subscription renewals,
 * usage monitoring, and AI insights with multi-tenant data isolation.
 */
@Entity('notifications', { schema: 'public' })
@Index(['organizationId', 'status'], { name: 'idx_notifications_org_status' })
@Index(['userId', 'status'], { name: 'idx_notifications_user_status' })
@Index(['type', 'priority'], { name: 'idx_notifications_type_priority' })
export class NotificationEntity implements INotification {
    @PrimaryGeneratedColumn('uuid', {
        name: 'id',
        comment: 'Unique identifier for the notification'
    })
    id: string;

    @Column('uuid', {
        name: 'organization_id',
        comment: 'Organization ID for multi-tenant data isolation'
    })
    organizationId: string;

    @Column('uuid', {
        name: 'user_id',
        comment: 'Target user ID for the notification'
    })
    userId: string;

    @Column({
        type: 'enum',
        enum: NotificationType,
        comment: 'Type of notification (renewal, usage, insight, alert)'
    })
    type: NotificationType;

    @Column({
        type: 'enum',
        enum: NotificationPriority,
        default: NotificationPriority.MEDIUM,
        comment: 'Priority level of the notification'
    })
    priority: NotificationPriority;

    @Column({
        type: 'enum',
        enum: NotificationStatus,
        default: NotificationStatus.UNREAD,
        comment: 'Current status of the notification'
    })
    status: NotificationStatus;

    @Column('varchar', {
        length: 255,
        comment: 'Short descriptive title of the notification'
    })
    title: string;

    @Column('text', {
        comment: 'Detailed notification message content'
    })
    message: string;

    @Column('jsonb', {
        default: {},
        comment: 'Additional contextual data in JSONB format'
    })
    metadata: Record<string, any>;

    @CreateDateColumn({
        type: 'timestamptz',
        name: 'created_at',
        comment: 'Timestamp of notification creation'
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamptz',
        name: 'updated_at',
        comment: 'Timestamp of last notification update'
    })
    updatedAt: Date;

    /**
     * Creates a new notification entity instance with validation and default values.
     * @param notification - Partial notification data to initialize the entity
     */
    constructor(notification?: Partial<INotification>) {
        if (notification) {
            // Validate required fields
            if (!notification.organizationId) {
                throw new Error('Organization ID is required');
            }
            if (!notification.userId) {
                throw new Error('User ID is required');
            }
            if (!notification.type) {
                throw new Error('Notification type is required');
            }
            if (!notification.title) {
                throw new Error('Notification title is required');
            }
            if (!notification.message) {
                throw new Error('Notification message is required');
            }

            // Validate enum values
            if (notification.type && !Object.values(NotificationType).includes(notification.type)) {
                throw new Error('Invalid notification type');
            }
            if (notification.priority && !Object.values(NotificationPriority).includes(notification.priority)) {
                throw new Error('Invalid notification priority');
            }
            if (notification.status && !Object.values(NotificationStatus).includes(notification.status)) {
                throw new Error('Invalid notification status');
            }

            // Set default values
            this.status = notification.status || NotificationStatus.UNREAD;
            this.priority = notification.priority || NotificationPriority.MEDIUM;
            this.metadata = notification.metadata || {};

            // Apply provided data
            Object.assign(this, notification);
        }
    }
}