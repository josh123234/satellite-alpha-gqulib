// bull@4.12.0 - Provides base job interface and type definitions for Bull queue processing system
import { Job } from 'bull';

/**
 * Defines available job types with literal string values for type safety
 * Used to categorize different background processing tasks in the system
 */
export enum JobType {
    ANALYTICS_PROCESSING = 'analytics_processing',
    USAGE_METRICS_UPDATE = 'usage_metrics_update',
    NOTIFICATION_DISPATCH = 'notification_dispatch'
}

/**
 * Defines possible job states in the processing lifecycle
 * Used to track the current state of jobs in the queue
 */
export enum JobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    RETRYING = 'retrying'
}

/**
 * Defines priority levels for job processing order
 * Lower numbers indicate higher priority
 */
export enum JobPriority {
    HIGH = 1,
    MEDIUM = 2,
    LOW = 3
}

/**
 * Defines the complete structure of data and configuration for queue jobs
 * Provides comprehensive type safety for job processing configurations
 */
export interface JobData {
    /** Type of job to be processed */
    type: JobType;
    
    /** Generic payload containing job-specific data */
    payload: Record<string, any>;
    
    /** Timestamp when the job was created */
    timestamp: Date;
    
    /** Processing priority level */
    priority: JobPriority;
    
    /** Maximum number of retry attempts */
    retryLimit: number;
    
    /** Job timeout in milliseconds */
    timeout: number;
}

/**
 * Extends Bull Job interface with comprehensive tracking and monitoring properties
 * Provides complete type safety for job processing and monitoring
 */
export interface QueueJob extends Job<JobData> {
    /** Job data and processing configuration */
    data: JobData;
    
    /** Processing progress percentage (0-100) */
    progress: number;
    
    /** Number of processing attempts made */
    attempts: number;
    
    /** Current job status */
    status: JobStatus;
    
    /** Error details if job failed */
    error: Error | null;
    
    /** Total processing time in milliseconds */
    processingTime: number;
}