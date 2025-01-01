/**
 * @fileoverview Data Transfer Object for creating new subscription entries in the SaaS Management Platform
 * @version 1.0.0
 */

import { 
    IsString, 
    IsNumber, 
    IsOptional, 
    IsEnum, 
    IsObject,
    MaxLength,
    Min
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { 
    ISubscription,
    BillingCycle 
} from '../interfaces/subscription.interface';

/**
 * DTO for creating new subscription entries with comprehensive validation rules
 * Implements type-safe field definitions and detailed Swagger documentation
 */
export class CreateSubscriptionDto implements Pick<ISubscription, 
    'name' | 
    'description' | 
    'provider' | 
    'cost' | 
    'billingCycle' | 
    'totalLicenses' | 
    'metadata'> {

    @ApiProperty({
        description: 'Name of the subscription',
        example: 'Slack Enterprise',
        maxLength: 100,
        required: true
    })
    @IsString({ message: 'Subscription name must be a string' })
    @MaxLength(100, { message: 'Subscription name cannot exceed 100 characters' })
    name: string;

    @ApiProperty({
        description: 'Detailed description of the subscription',
        example: 'Enterprise communication platform',
        required: false
    })
    @IsString({ message: 'Description must be a string' })
    @IsOptional()
    @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
    description: string;

    @ApiProperty({
        description: 'Service provider name',
        example: 'Slack Technologies',
        required: true
    })
    @IsString({ message: 'Provider name must be a string' })
    @MaxLength(100, { message: 'Provider name cannot exceed 100 characters' })
    provider: string;

    @ApiProperty({
        description: 'Monthly cost of the subscription in USD',
        example: 1200.00,
        minimum: 0,
        required: true
    })
    @IsNumber({}, { message: 'Cost must be a valid number' })
    @Min(0, { message: 'Cost cannot be negative' })
    cost: number;

    @ApiProperty({
        description: 'Billing cycle of the subscription',
        enum: BillingCycle,
        example: BillingCycle.MONTHLY,
        required: true
    })
    @IsEnum(BillingCycle, { message: 'Invalid billing cycle value' })
    billingCycle: BillingCycle;

    @ApiProperty({
        description: 'Total number of licenses',
        example: 100,
        minimum: 1,
        required: true
    })
    @IsNumber({}, { message: 'Total licenses must be a valid number' })
    @Min(1, { message: 'Total licenses must be at least 1' })
    totalLicenses: number;

    @ApiProperty({
        description: 'Additional metadata for the subscription',
        required: false,
        type: 'object',
        example: {
            department: 'Engineering',
            costCenter: 'CC-123',
            tags: ['collaboration', 'communication']
        }
    })
    @IsObject({ message: 'Metadata must be a valid object' })
    @IsOptional()
    metadata: Record<string, any>;
}