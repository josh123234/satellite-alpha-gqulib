import { Process, Processor } from '@nestjs/bull'; // ^10.0.0
import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { Job } from 'bull'; // ^4.12.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { INotification, NotificationType, NotificationPriority } from '../../notification/interfaces/notification.interface';
import { NotificationService } from '../../notification/notification.service';
import { JobType, JobData, QueueJob } from '../interfaces/job.interface';

/**
 * Processor class for handling asynchronous notification dispatch through Bull queue
 * Implements priority-based processing, comprehensive error handling, and monitoring
 */
@Injectable()
@Processor('notifications')
export class NotificationProcessor {
    // Maximum retry attempts for failed notifications
    private readonly MAX_RETRY_ATTEMPTS = 3;
    
    // Retry delay intervals in milliseconds (exponential backoff)
    private readonly RETRY_DELAYS = [1000, 5000, 15000];
    
    // Priority-based processing delays
    private readonly PRIORITY_DELAYS = new Map<NotificationPriority, number>([
        [NotificationPriority.URGENT, 0],
        [NotificationPriority.HIGH, 1000],
        [NotificationPriority.MEDIUM, 5000],
        [NotificationPriority.LOW, 15000]
    ]);

    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        private readonly notificationService: NotificationService
    ) {}

    /**
     * Processes notification dispatch jobs from the queue
     * Implements priority-based processing and comprehensive error handling
     */
    @Process(JobType.NOTIFICATION_DISPATCH)
    async processNotification(job: Job<QueueJob>): Promise<void> {
        const correlationId = uuidv4();
        this.logger.debug(`Processing notification job ${job.id} [${correlationId}]`);

        try {
            // Extract notification data from job
            const notification = job.data.data.payload as INotification;
            
            // Validate notification data
            await this.validateNotification(notification);

            // Apply priority-based processing delay
            const delay = this.PRIORITY_DELAYS.get(notification.priority) || 0;
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Update job progress
            await job.progress(50);

            // Process notification through service
            await this.notificationService.createNotification({
                organizationId: notification.organizationId,
                userId: notification.userId,
                type: notification.type,
                priority: notification.priority,
                title: notification.title,
                message: notification.message,
                metadata: notification.metadata
            });

            // Mark job as completed
            await job.progress(100);
            this.logger.debug(`Notification job ${job.id} completed successfully [${correlationId}]`);

        } catch (error) {
            this.logger.error(
                `Error processing notification job ${job.id} [${correlationId}]: ${error.message}`,
                error.stack
            );

            // Handle retry logic
            if (job.attemptsMade < this.MAX_RETRY_ATTEMPTS) {
                await this.handleRetry(job.data.data.payload as INotification, error);
                throw error; // Trigger Bull's retry mechanism
            }

            // Log final failure
            this.logger.error(
                `Notification job ${job.id} failed permanently after ${job.attemptsMade} attempts [${correlationId}]`
            );
            throw error;
        }
    }

    /**
     * Handles retry logic for failed notification attempts
     * Implements exponential backoff strategy
     */
    private async handleRetry(notification: INotification, error: Error): Promise<void> {
        const attemptIndex = Math.min(
            this.RETRY_DELAYS.length - 1,
            notification.metadata?.retryCount || 0
        );

        const retryDelay = this.RETRY_DELAYS[attemptIndex];
        const updatedNotification = {
            ...notification,
            metadata: {
                ...notification.metadata,
                retryCount: (notification.metadata?.retryCount || 0) + 1,
                lastError: error.message,
                lastRetryTimestamp: new Date().toISOString()
            }
        };

        this.logger.debug(
            `Scheduling retry for notification ${notification.id} ` +
            `with delay ${retryDelay}ms (attempt ${updatedNotification.metadata.retryCount})`
        );

        // Schedule retry with updated metadata
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    /**
     * Validates notification data structure and content
     */
    private async validateNotification(notification: INotification): Promise<void> {
        if (!notification.organizationId || !notification.userId) {
            throw new Error('Missing required notification identifiers');
        }

        if (!notification.type || !Object.values(NotificationType).includes(notification.type)) {
            throw new Error('Invalid notification type');
        }

        if (!notification.priority || !Object.values(NotificationPriority).includes(notification.priority)) {
            throw new Error('Invalid notification priority');
        }

        if (!notification.title || !notification.message) {
            throw new Error('Missing notification content');
        }
    }
}