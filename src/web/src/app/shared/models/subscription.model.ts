// @ts-nocheck
/**
 * @fileoverview Subscription model definitions for SaaS Management Platform
 * @version 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // Latest version

/**
 * Enum representing all possible subscription statuses
 */
export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    CANCELLED = 'CANCELLED',
    RENEWAL_REQUIRED = 'RENEWAL_REQUIRED'
}

/**
 * Enum representing supported billing cycle options
 */
export enum BillingCycle {
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    ANNUAL = 'ANNUAL',
    CUSTOM = 'CUSTOM'
}

/**
 * Interface for subscription metadata including tags and integration data
 */
export interface SubscriptionMetadata {
    /** Array of tags for categorization and filtering */
    tags: string[];
    /** Custom fields for extensibility */
    customFields: Record<string, unknown>;
    /** Integration-specific data */
    integrationData: Record<string, unknown>;
}

/**
 * Interface for contract-related information
 */
export interface ContractDetails {
    /** Unique identifier for the contract */
    contractId: string;
    /** Contract terms and conditions */
    terms: string;
    /** Contract start date */
    startDate: Date;
    /** Contract end date */
    endDate: Date;
}

/**
 * Interface for tracking subscription usage metrics
 */
export interface UsageMetrics {
    /** Last active usage timestamp */
    lastActive: Date;
    /** Current utilization rate (0-100) */
    utilizationRate: number;
    /** Number of active users */
    activeUsers: number;
}

/**
 * Comprehensive interface for SaaS subscription management
 */
export interface Subscription {
    /** Unique identifier for the subscription */
    id: UUID;
    /** Organization ID owning the subscription */
    organizationId: UUID;
    /** Name of the subscription */
    name: string;
    /** Detailed description of the subscription */
    description: string;
    /** SaaS provider name */
    provider: string;
    /** Subscription cost */
    cost: number;
    /** Billing cycle type */
    billingCycle: BillingCycle;
    /** Next renewal date */
    renewalDate: Date;
    /** Current subscription status */
    status: SubscriptionStatus;
    /** Total number of licenses */
    totalLicenses: number;
    /** Number of licenses currently in use */
    usedLicenses: number;
    /** Additional metadata */
    metadata: SubscriptionMetadata;
    /** Contract information */
    contractDetails: ContractDetails;
    /** Usage tracking metrics */
    usageMetrics: UsageMetrics;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}