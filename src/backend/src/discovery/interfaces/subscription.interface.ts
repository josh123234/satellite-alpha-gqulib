/**
 * @fileoverview Subscription interface and related type definitions for the SaaS Management Platform
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // @types/node latest

/**
 * Enum representing all possible subscription status values
 * Used for tracking the current state of a subscription
 */
export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',       // Subscription is active and in use
    INACTIVE = 'INACTIVE',   // Subscription is not currently in use
    PENDING = 'PENDING',     // Subscription is awaiting activation/setup
    CANCELLED = 'CANCELLED', // Subscription has been terminated
    WARNING = 'WARNING'      // Subscription requires attention (e.g., approaching renewal)
}

/**
 * Enum representing supported billing cycle options
 * Defines the frequency of subscription payments
 */
export enum BillingCycle {
    MONTHLY = 'MONTHLY',     // Monthly billing cycle
    QUARTERLY = 'QUARTERLY', // Quarterly billing cycle
    ANNUAL = 'ANNUAL',       // Annual billing cycle
    CUSTOM = 'CUSTOM'        // Custom billing cycle period
}

/**
 * Core interface defining the structure of a subscription
 * Provides comprehensive type safety for subscription data management
 */
export interface ISubscription {
    /** Unique identifier for the subscription */
    id: UUID;

    /** Organization ID for multi-tenant support */
    organizationId: UUID;

    /** Name of the subscription/service */
    name: string;

    /** Detailed description of the subscription */
    description: string;

    /** Service provider name */
    provider: string;

    /** Subscription cost per billing cycle */
    cost: number;

    /** Billing cycle frequency */
    billingCycle: BillingCycle;

    /** Next renewal date */
    renewalDate: Date;

    /** Current subscription status */
    status: SubscriptionStatus;

    /** Total number of licenses available */
    totalLicenses: number;

    /** Number of licenses currently in use */
    usedLicenses: number;

    /** Additional metadata for flexible storage of subscription-specific data */
    metadata: Record<string, any>;

    /** Timestamp of last successful sync with provider */
    lastSyncedAt: Date;

    /** Subscription creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;
}