/**
 * Enum defining different types of notifications supported by the system.
 * Used to categorize notifications for different events and scenarios.
 */
export enum NotificationType {
    SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
    USAGE_THRESHOLD = 'USAGE_THRESHOLD',
    AI_INSIGHT = 'AI_INSIGHT',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Enum defining priority levels for notifications.
 * Used to determine the urgency and importance of notifications.
 */
export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

/**
 * Enum defining possible states of a notification.
 * Tracks the lifecycle status of notifications in the system.
 */
export enum NotificationStatus {
    UNREAD = 'UNREAD',
    READ = 'READ',
    ARCHIVED = 'ARCHIVED'
}

/**
 * Interface defining the structure of notification objects in the system.
 * Provides a comprehensive type definition for notifications across the application.
 */
export interface INotification {
    /** Unique identifier for the notification */
    id: string;

    /** Organization ID associated with the notification */
    organizationId: string;

    /** User ID of the notification recipient */
    userId: string;

    /** Type of the notification from NotificationType enum */
    type: NotificationType;

    /** Priority level of the notification */
    priority: NotificationPriority;

    /** Current status of the notification */
    status: NotificationStatus;

    /** Short descriptive title of the notification */
    title: string;

    /** Detailed notification message */
    message: string;

    /** Additional contextual data associated with the notification */
    metadata: Record<string, any>;

    /** Timestamp when the notification was created */
    createdAt: Date;

    /** Timestamp when the notification was last updated */
    updatedAt: Date;
}