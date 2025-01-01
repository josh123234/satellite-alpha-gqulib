/**
 * @fileoverview Data Transfer Object (DTO) for handling usage metric data in the analytics system.
 * Implements comprehensive validation, transformation rules, and API documentation for usage metrics.
 * @version 1.0.0
 */

import { IsString, IsNumber, IsDate, IsEnum, IsNotEmpty, IsUUID, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MetricType, IUsageMetric } from '../interfaces/metric.interface';

/**
 * DTO for creating and validating new usage metric records.
 * Implements comprehensive validation rules and API documentation for metric collection.
 * @implements {Pick<IUsageMetric, 'subscriptionId' | 'metricType' | 'value' | 'unit' | 'timestamp'>}
 */
export class CreateUsageMetricDto {
  /**
   * Unique identifier of the subscription being monitored
   */
  @IsUUID('4')
  @IsNotEmpty()
  @ApiProperty({
    description: 'Unique identifier of the subscription',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true
  })
  subscriptionId: string;

  /**
   * Type of metric being recorded from the standardized MetricType enum
   */
  @IsEnum(MetricType)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Type of usage metric being recorded',
    enum: MetricType,
    example: MetricType.ACTIVE_USERS,
    required: true,
    enumName: 'MetricType'
  })
  metricType: MetricType;

  /**
   * Numerical value of the metric measurement
   */
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Numerical value of the metric',
    example: 42,
    minimum: 0,
    maximum: 1000000,
    required: true,
    type: Number
  })
  value: number;

  /**
   * Unit of measurement for the metric value
   */
  @IsString()
  @IsIn(['users', 'bytes', 'requests', 'sessions'])
  @IsNotEmpty()
  @ApiProperty({
    description: 'Unit of measurement for the metric',
    example: 'users',
    enum: ['users', 'bytes', 'requests', 'sessions'],
    required: true
  })
  unit: string;

  /**
   * Timestamp when the metric was recorded
   */
  @IsDate()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Timestamp when the metric was recorded',
    example: '2024-01-20T12:00:00Z',
    required: true,
    type: Date
  })
  timestamp: Date;
}