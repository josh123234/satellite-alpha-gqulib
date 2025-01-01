/**
 * @fileoverview TypeORM entity class for subscription management in the SaaS Management Platform
 * @version 1.0.0
 */

import { 
    Entity, 
    Column, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn,
    Index,
    Check
} from 'typeorm'; // ^0.3.17

import { 
    ISubscription,
    SubscriptionStatus,
    BillingCycle
} from '../interfaces/subscription.interface';

import { UUID } from 'crypto';

/**
 * TypeORM entity class representing a SaaS subscription
 * Implements comprehensive subscription tracking with database optimizations
 */
@Entity('subscriptions')
@Index(['name', 'provider'])
@Index(['status', 'renewalDate'])
@Check('used_licenses <= total_licenses')
export class Subscription implements ISubscription {
    @PrimaryGeneratedColumn('uuid')
    id: UUID;

    @Column({ name: 'organization_id', type: 'uuid' })
    @Index()
    organizationId: UUID;

    @Column({ type: 'varchar', length: 255 })
    @Index()
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 100 })
    @Index()
    provider: string;

    @Column({ 
        type: 'decimal', 
        precision: 10, 
        scale: 2,
        comment: 'Subscription cost per billing cycle'
    })
    cost: number;

    @Column({ 
        name: 'billing_cycle', 
        type: 'enum', 
        enum: BillingCycle,
        comment: 'Frequency of billing cycle'
    })
    billingCycle: BillingCycle;

    @Column({ 
        name: 'renewal_date', 
        type: 'timestamp'
    })
    @Index()
    renewalDate: Date;

    @Column({ 
        type: 'enum', 
        enum: SubscriptionStatus,
        comment: 'Current status of the subscription'
    })
    @Index()
    status: SubscriptionStatus;

    @Column({ 
        name: 'total_licenses', 
        type: 'integer',
        comment: 'Total number of available licenses'
    })
    totalLicenses: number;

    @Column({ 
        name: 'used_licenses', 
        type: 'integer',
        comment: 'Number of licenses currently in use'
    })
    usedLicenses: number;

    @Column({ 
        type: 'jsonb', 
        nullable: true,
        comment: 'Flexible storage for subscription-specific metadata'
    })
    metadata: Record<string, any>;

    @Column({ 
        name: 'last_synced_at', 
        type: 'timestamp',
        nullable: true,
        comment: 'Timestamp of last successful provider sync'
    })
    lastSyncedAt: Date;

    @CreateDateColumn({ 
        name: 'created_at',
        comment: 'Timestamp of subscription creation'
    })
    createdAt: Date;

    @UpdateDateColumn({ 
        name: 'updated_at',
        comment: 'Timestamp of last update'
    })
    updatedAt: Date;
}