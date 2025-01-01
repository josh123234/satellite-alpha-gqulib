/**
 * @fileoverview Notification model definitions for the SaaS Management Platform
 * Provides type-safe interfaces and implementations for handling system notifications
 */

/**
 * Enum defining different types of notifications supported by the system
 */
export enum NotificationType {
    SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
    USAGE_THRESHOLD = 'USAGE_THRESHOLD',
    AI_INSIGHT = 'AI_INSIGHT',
    SYSTEM_ALERT = 'SYSTEM_ALERT',
    LICENSE_EXPIRY = 'LICENSE_EXPIRY',
    COST_ANOMALY = 'COST_ANOMALY',
    SECURITY_ALERT = 'SECURITY_ALERT',
    INTEGRATION_STATUS = 'INTEGRATION_STATUS'
}

/**
 * Enum defining priority levels for notifications with associated response times
 */
export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
    CRITICAL = 'CRITICAL'
}

/**
 * Enum defining possible states of a notification throughout its lifecycle
 */
export enum NotificationStatus {
    UNREAD = 'UNREAD',
    READ = 'READ',
    ARCHIVED = 'ARCHIVED',
    DELETED = 'DELETED',
    ACTIONED = 'ACTIONED'
}

/**
 * Interface defining type-safe metadata structure for different notification types
 */
export interface INotificationMetadata {
    subscriptionId?: string;
    costAmount?: number;
    thresholdValue?: number;
    aiConfidence?: number;
    actionRequired?: boolean;
    expiryDate?: Date;
    severity?: string;
    affectedUsers?: string[];
    relatedResources?: string[];
}

/**
 * Interface defining the structure of notification objects with enhanced metadata typing
 */
export interface INotification {
    id: string;
    organizationId: string;
    userId: string;
    type: NotificationType;
    priority: NotificationPriority;
    status: NotificationStatus;
    title: string;
    message: string;
    metadata: INotificationMetadata;
    tags: string[];
    source: string;
    category: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    actionedAt: Date;
}

/**
 * Class implementing the INotification interface with comprehensive utility methods
 */
export class Notification implements INotification {
    id: string;
    organizationId: string;
    userId: string;
    type: NotificationType;
    priority: NotificationPriority;
    status: NotificationStatus;
    title: string;
    message: string;
    metadata: INotificationMetadata;
    tags: string[];
    source: string;
    category: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    actionedAt: Date;

    /**
     * Creates a new Notification instance with enhanced validation
     * @param data Partial notification data to initialize the instance
     * @throws Error if required fields are missing or invalid
     */
    constructor(data: Partial<INotification>) {
        // Validate required fields
        if (!data.type || !data.title || !data.message) {
            throw new Error('Required notification fields missing');
        }

        // Initialize properties with defaults
        this.id = data.id || crypto.randomUUID();
        this.organizationId = data.organizationId || '';
        this.userId = data.userId || '';
        this.type = data.type;
        this.priority = data.priority || NotificationPriority.MEDIUM;
        this.status = data.status || NotificationStatus.UNREAD;
        this.title = data.title;
        this.message = data.message;
        this.metadata = data.metadata || {};
        this.tags = data.tags || [];
        this.source = data.source || 'system';
        this.category = data.category || 'general';
        
        // Handle date fields
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
        this.actionedAt = data.actionedAt ? new Date(data.actionedAt) : null;

        // Validate metadata structure based on notification type
        this.validateMetadata();
    }

    /**
     * Checks if the notification is unread
     * @returns boolean indicating if the notification is unread
     */
    isUnread(): boolean {
        return this.status === NotificationStatus.UNREAD;
    }

    /**
     * Checks if the notification is urgent priority
     * @returns boolean indicating if the notification requires immediate attention
     */
    isUrgent(): boolean {
        return this.priority === NotificationPriority.URGENT || 
               this.priority === NotificationPriority.CRITICAL;
    }

    /**
     * Updates the notification status to READ
     */
    markAsRead(): void {
        this.status = NotificationStatus.READ;
        this.updatedAt = new Date();
    }

    /**
     * Archives the notification
     */
    archive(): void {
        this.status = NotificationStatus.ARCHIVED;
        this.updatedAt = new Date();
    }

    /**
     * Checks if the notification has expired
     * @returns boolean indicating if the notification has expired
     */
    isExpired(): boolean {
        return this.expiresAt && this.expiresAt < new Date();
    }

    /**
     * Checks if the notification requires user action
     * @returns boolean indicating if action is required
     */
    requiresAction(): boolean {
        return this.metadata.actionRequired === true && 
               this.status !== NotificationStatus.ACTIONED;
    }

    /**
     * Validates metadata structure based on notification type
     * @private
     * @throws Error if metadata is invalid for the notification type
     */
    private validateMetadata(): void {
        switch (this.type) {
            case NotificationType.SUBSCRIPTION_RENEWAL:
                if (!this.metadata.subscriptionId || !this.metadata.expiryDate) {
                    throw new Error('Invalid metadata for subscription renewal notification');
                }
                break;
            case NotificationType.USAGE_THRESHOLD:
                if (typeof this.metadata.thresholdValue !== 'number') {
                    throw new Error('Invalid metadata for usage threshold notification');
                }
                break;
            case NotificationType.AI_INSIGHT:
                if (typeof this.metadata.aiConfidence !== 'number') {
                    throw new Error('Invalid metadata for AI insight notification');
                }
                break;
            case NotificationType.COST_ANOMALY:
                if (typeof this.metadata.costAmount !== 'number') {
                    throw new Error('Invalid metadata for cost anomaly notification');
                }
                break;
        }
    }
}