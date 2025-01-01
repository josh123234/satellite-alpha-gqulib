/**
 * @fileoverview Data Transfer Object for updating subscription entries in the SaaS Management Platform
 * @version 1.0.0
 */

import { 
    IsString, 
    IsNumber, 
    IsOptional, 
    IsEnum, 
    IsObject,
    MinLength,
    MaxLength,
    Min
} from 'class-validator'; // ^0.14.0

import { ApiProperty, PartialType } from '@nestjs/swagger'; // ^7.0.0

import { 
    ISubscription, 
    BillingCycle, 
    SubscriptionStatus 
} from '../interfaces/subscription.interface';

/**
 * DTO for updating existing subscription entries
 * Implements partial update pattern allowing optional field updates
 * Includes comprehensive validation and Swagger documentation
 */
export class UpdateSubscriptionDto implements Partial<ISubscription> {
    @ApiProperty({
        description: 'Subscription name',
        example: 'Slack Enterprise',
        minLength: 3,
        maxLength: 100,
        required: false
    })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'Subscription description',
        example: 'Team communication platform',
        maxLength: 500,
        required: false
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({
        description: 'Service provider name',
        example: 'Slack Technologies',
        maxLength: 100,
        required: false
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    provider?: string;

    @ApiProperty({
        description: 'Subscription cost',
        example: 999.99,
        minimum: 0,
        required: false
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cost?: number;

    @ApiProperty({
        description: 'Billing cycle',
        enum: BillingCycle,
        example: BillingCycle.MONTHLY,
        required: false
    })
    @IsOptional()
    @IsEnum(BillingCycle)
    billingCycle?: BillingCycle;

    @ApiProperty({
        description: 'Total number of licenses',
        example: 100,
        minimum: 1,
        required: false
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    totalLicenses?: number;

    @ApiProperty({
        description: 'Subscription status',
        enum: SubscriptionStatus,
        example: SubscriptionStatus.ACTIVE,
        required: false
    })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;

    @ApiProperty({
        description: 'Additional subscription metadata',
        type: 'object',
        example: {
            customField: 'value',
            integrationId: 'int_123'
        },
        required: false
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}