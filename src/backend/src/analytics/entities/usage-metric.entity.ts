/**
 * @fileoverview TypeORM entity class for usage metrics in the SaaS Management Platform
 * Provides schema for storing analytics data with optimized indexing and validation
 * @version 1.0.0
 */

import { 
    Entity, 
    Column, 
    PrimaryGeneratedColumn, 
    ManyToOne, 
    CreateDateColumn,
    Index,
    Check
} from 'typeorm'; // ^0.3.0

import { IUsageMetric, MetricType } from '../interfaces/metric.interface';
import { SubscriptionEntity } from '../../discovery/entities/subscription.entity';
import { UUID } from 'crypto';

/**
 * Entity class representing usage metrics for SaaS subscriptions
 * Implements comprehensive tracking with performance optimizations
 */
@Entity('usage_metrics')
@Index(['subscriptionId', 'metricType'])
@Index(['timestamp', 'subscriptionId'])
@Index(['metricType', 'timestamp'])
@Check('value >= 0')
export class UsageMetricEntity implements IUsageMetric {
    @PrimaryGeneratedColumn('uuid')
    id: UUID;

    @Column({ name: 'subscription_id', type: 'uuid' })
    @Index()
    subscriptionId: UUID;

    @Column({
        type: 'enum',
        enum: MetricType,
        name: 'metric_type'
    })
    @Index()
    metricType: MetricType;

    @Column({
        type: 'decimal',
        precision: 15,
        scale: 4,
        comment: 'Numerical value of the metric measurement'
    })
    value: number;

    @Column({
        type: 'varchar',
        length: 50,
        comment: 'Unit of measurement for the metric'
    })
    unit: string;

    @Column({
        type: 'timestamp with time zone',
        name: 'timestamp',
        comment: 'When the metric was recorded'
    })
    @Index()
    timestamp: Date;

    @ManyToOne(
        () => SubscriptionEntity,
        { 
            onDelete: 'CASCADE',
            nullable: false 
        }
    )
    subscription: SubscriptionEntity;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamp with time zone',
        comment: 'Timestamp when the record was created'
    })
    createdAt: Date;

    @Column({
        type: 'jsonb',
        nullable: true,
        default: {},
        comment: 'Additional metadata and context for the metric'
    })
    metadata: Record<string, unknown>;

    @Column({
        type: 'uuid',
        name: 'organization_id',
        comment: 'Organization ID for multi-tenant support'
    })
    @Index()
    organizationId: UUID;

    @Column({
        type: 'varchar',
        length: 100,
        comment: 'System or integration that generated this metric'
    })
    source: string;

    /**
     * Creates a new usage metric entity instance
     * @param data Partial entity data for initialization
     */
    constructor(data?: Partial<UsageMetricEntity>) {
        if (data) {
            Object.assign(this, data);
        }
        
        // Set defaults if not provided
        this.timestamp = this.timestamp || new Date();
        this.metadata = this.metadata || {};
        
        // Validate metric type
        if (this.metricType && !Object.values(MetricType).includes(this.metricType)) {
            throw new Error(`Invalid metric type: ${this.metricType}`);
        }

        // Validate value
        if (typeof this.value === 'number' && this.value < 0) {
            throw new Error('Metric value cannot be negative');
        }
    }
}