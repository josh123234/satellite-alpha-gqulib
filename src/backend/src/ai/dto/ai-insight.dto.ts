import { IsString, IsNumber, IsEnum, IsOptional, IsArray, ValidateNested, IsDate, Min, Max, Length, IsUUID } from 'class-validator'; // v0.14.x
import { Type, Transform } from 'class-transformer'; // v0.5.x
import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger'; // v7.x
import { ModelMetrics } from '../interfaces/model.interface';

/**
 * Enumeration of possible AI insight types
 */
export enum InsightType {
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  USAGE_PATTERN = 'USAGE_PATTERN',
  LICENSE_OPTIMIZATION = 'LICENSE_OPTIMIZATION',
  SECURITY_RECOMMENDATION = 'SECURITY_RECOMMENDATION',
  INTEGRATION_SUGGESTION = 'INTEGRATION_SUGGESTION',
  RENEWAL_OPTIMIZATION = 'RENEWAL_OPTIMIZATION',
  COMPLIANCE_ALERT = 'COMPLIANCE_ALERT'
}

/**
 * Priority levels for insights based on impact and urgency
 */
export enum InsightPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * DTO for the source of an AI insight with validation and metadata
 */
@ValidateNested()
export class InsightSourceDTO {
  @ApiProperty({
    description: 'Unique identifier of the AI model that generated the insight',
    example: 'model_cost_opt_v1'
  })
  @IsString()
  @Length(5, 50)
  modelId: string;

  @ApiProperty({
    description: 'Confidence score of the insight (0-1)',
    example: 0.95,
    minimum: 0,
    maximum: 1
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({
    description: 'Timestamp when the insight was generated'
  })
  @IsDate()
  @Type(() => Date)
  @Transform(({ value }) => new Date(value))
  timestamp: Date;

  @ApiProperty({
    description: 'Version of the AI model',
    example: '1.2.0'
  })
  @IsString()
  @Length(5, 20)
  modelVersion: string;

  @ApiProperty({
    description: 'Model performance metrics'
  })
  @ValidateNested()
  @Type(() => Object)
  metrics: ModelMetrics;

  /**
   * Validates source data integrity and thresholds
   */
  validate(): boolean {
    if (this.confidence < 0.5) {
      return false;
    }

    if (this.timestamp > new Date()) {
      return false;
    }

    if (!this.modelVersion.match(/^\d+\.\d+\.\d+$/)) {
      return false;
    }

    if (!this.metrics?.accuracy || this.metrics.accuracy < 0.7) {
      return false;
    }

    return true;
  }
}

/**
 * Main DTO for AI-generated insights with comprehensive validation
 */
@ValidateNested()
export class AIInsightDTO {
  @ApiProperty({
    description: 'Unique identifier for the insight',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Type of insight',
    enum: InsightType,
    example: InsightType.COST_OPTIMIZATION
  })
  @IsEnum(InsightType)
  type: InsightType;

  @ApiProperty({
    description: 'Concise title of the insight',
    example: 'Potential cost savings in development tools'
  })
  @IsString()
  @Length(10, 100)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the insight',
    example: 'Analysis shows potential 25% cost reduction by optimizing license allocation'
  })
  @IsString()
  @Length(20, 1000)
  description: string;

  @ApiProperty({
    description: 'Source information for the insight'
  })
  @ValidateNested()
  @Type(() => InsightSourceDTO)
  source: InsightSourceDTO;

  @ApiProperty({
    description: 'Additional structured data related to the insight'
  })
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'List of actionable recommendations',
    example: ['Consolidate duplicate licenses', 'Remove inactive users']
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  recommendations: string[];

  @ApiProperty({
    description: 'Estimated cost savings in USD',
    example: 1200.50,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  potentialSavings: number;

  @ApiProperty({
    description: 'Timestamp until when the insight is valid'
  })
  @IsDate()
  @Type(() => Date)
  validUntil: Date;

  @ApiProperty({
    description: 'Priority level of the insight',
    enum: InsightPriority,
    example: InsightPriority.HIGH
  })
  @IsEnum(InsightPriority)
  priority: InsightPriority;

  @ApiProperty({
    description: 'Categorization tags for the insight',
    example: ['cost', 'licenses', 'optimization']
  })
  @IsArray()
  @IsString({ each: true })
  @Length(2, 20, { each: true })
  tags: string[];

  @ApiProperty({
    description: 'Business category of the insight',
    example: 'Development Tools'
  })
  @IsString()
  @Length(3, 50)
  category: string;

  /**
   * Transforms the DTO to a secure response format
   * @param format Optional response format preferences
   * @returns Sanitized insight response
   */
  toResponse(format?: Record<string, any>): Record<string, any> {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      priority: this.priority,
      recommendations: this.recommendations,
      potentialSavings: Math.round(this.potentialSavings * 100) / 100,
      confidence: this.source.confidence,
      validUntil: this.validUntil.toISOString(),
      tags: this.tags,
      category: this.category,
      metadata: {
        modelId: this.source.modelId,
        modelVersion: this.source.modelVersion,
        generatedAt: this.source.timestamp.toISOString(),
        accuracy: this.source.metrics.accuracy
      }
    };
  }

  /**
   * Validates insight data integrity and business rules
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.source.validate()) {
      errors.push('Invalid source data');
    }

    if (this.recommendations.length < 1) {
      errors.push('At least one recommendation is required');
    }

    if (this.validUntil <= new Date()) {
      errors.push('Valid until date must be in the future');
    }

    if (this.type === InsightType.COST_OPTIMIZATION && this.potentialSavings <= 0) {
      errors.push('Cost optimization insights must have positive potential savings');
    }

    if (!this.tags.length) {
      errors.push('At least one tag is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}