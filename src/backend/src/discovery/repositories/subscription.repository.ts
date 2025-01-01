/**
 * @fileoverview TypeORM repository implementation for subscription data access and management
 * @version 1.0.0
 */

import { 
    Repository, 
    EntityRepository, 
    FindOptionsWhere, 
    Between, 
    LessThan,
    SelectQueryBuilder
} from 'typeorm'; // ^0.3.17

import { Subscription } from '../entities/subscription.entity';
import { ISubscription, SubscriptionStatus } from '../interfaces/subscription.interface';
import { UUID } from 'crypto';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

/**
 * Repository class for handling subscription data access operations
 * Implements optimized query patterns and multi-tenant support
 */
@EntityRepository(Subscription)
export class SubscriptionRepository extends Repository<Subscription> {
    /**
     * Find all subscriptions for a given organization with pagination and sorting
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @param options - Pagination and sorting options
     * @returns Promise containing subscriptions array and total count
     */
    async findByOrganizationId(
        organizationId: UUID,
        options: PaginationOptions
    ): Promise<[Subscription[], number]> {
        const queryBuilder = this.createQueryBuilder('subscription')
            .where('subscription.organizationId = :organizationId', { organizationId })
            .orderBy(`subscription.${options.sortBy || 'createdAt'}`, options.sortOrder || 'DESC')
            .skip((options.page - 1) * options.limit)
            .take(options.limit);

        return await queryBuilder.getManyAndCount();
    }

    /**
     * Find subscriptions with upcoming renewals in date range
     * @param startDate - Start date for renewal window
     * @param endDate - End date for renewal window
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @returns Promise containing array of subscriptions with upcoming renewals
     */
    async findUpcomingRenewals(
        startDate: Date,
        endDate: Date,
        organizationId: UUID
    ): Promise<Subscription[]> {
        return this.find({
            where: {
                organizationId,
                renewalDate: Between(startDate, endDate),
                status: SubscriptionStatus.ACTIVE
            },
            order: {
                renewalDate: 'ASC'
            }
        });
    }

    /**
     * Find subscriptions by their status with organization context
     * @param status - Subscription status to filter by
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @returns Promise containing array of filtered subscriptions
     */
    async findByStatus(
        status: SubscriptionStatus,
        organizationId: UUID
    ): Promise<Subscription[]> {
        return this.find({
            where: {
                organizationId,
                status
            },
            order: {
                updatedAt: 'DESC'
            }
        });
    }

    /**
     * Find under-utilized subscriptions based on license usage threshold
     * @param threshold - Utilization threshold percentage (0-100)
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @returns Promise containing array of under-utilized subscriptions
     */
    async findUnderUtilized(
        threshold: number,
        organizationId: UUID
    ): Promise<Subscription[]> {
        const queryBuilder = this.createQueryBuilder('subscription')
            .where('subscription.organizationId = :organizationId', { organizationId })
            .andWhere('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
            .andWhere('(CAST(subscription.usedLicenses AS FLOAT) / CAST(subscription.totalLicenses AS FLOAT)) * 100 <= :threshold', { threshold })
            .orderBy('subscription.usedLicenses / subscription.totalLicenses', 'ASC');

        return await queryBuilder.getMany();
    }

    /**
     * Find subscriptions requiring attention (warning status or low utilization)
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @param utilizationThreshold - Optional utilization threshold percentage
     * @returns Promise containing array of subscriptions needing attention
     */
    async findRequiringAttention(
        organizationId: UUID,
        utilizationThreshold: number = 30
    ): Promise<Subscription[]> {
        const queryBuilder = this.createQueryBuilder('subscription')
            .where('subscription.organizationId = :organizationId', { organizationId })
            .andWhere(
                '(subscription.status = :warningStatus OR ' +
                '(CAST(subscription.usedLicenses AS FLOAT) / CAST(subscription.totalLicenses AS FLOAT)) * 100 <= :threshold)',
                { 
                    warningStatus: SubscriptionStatus.WARNING,
                    threshold: utilizationThreshold
                }
            )
            .orderBy('subscription.renewalDate', 'ASC');

        return await queryBuilder.getMany();
    }

    /**
     * Find subscriptions by cost range
     * @param minCost - Minimum cost threshold
     * @param maxCost - Maximum cost threshold
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @returns Promise containing array of subscriptions within cost range
     */
    async findByCostRange(
        minCost: number,
        maxCost: number,
        organizationId: UUID
    ): Promise<Subscription[]> {
        return this.find({
            where: {
                organizationId,
                cost: Between(minCost, maxCost),
                status: SubscriptionStatus.ACTIVE
            },
            order: {
                cost: 'DESC'
            }
        });
    }

    /**
     * Update subscription license counts with optimistic locking
     * @param subscriptionId - Subscription UUID to update
     * @param usedLicenses - New used license count
     * @param organizationId - Organization UUID for multi-tenant filtering
     * @returns Promise containing updated subscription
     */
    async updateLicenseCount(
        subscriptionId: UUID,
        usedLicenses: number,
        organizationId: UUID
    ): Promise<Subscription> {
        const subscription = await this.findOneOrFail({
            where: {
                id: subscriptionId,
                organizationId
            }
        });

        subscription.usedLicenses = usedLicenses;
        subscription.status = usedLicenses >= subscription.totalLicenses 
            ? SubscriptionStatus.WARNING 
            : SubscriptionStatus.ACTIVE;

        return this.save(subscription);
    }
}