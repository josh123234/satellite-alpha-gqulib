/**
 * @fileoverview Core metric interfaces and enums for the SaaS Management Platform analytics system.
 * Provides type-safe structures for collecting, processing, and analyzing various SaaS usage and cost metrics.
 * @version 1.0.0
 */

/**
 * Comprehensive enumeration of all supported metric types in the analytics system.
 * Used to categorize different types of measurements and analytics data points.
 */
export enum MetricType {
  LICENSE_USAGE = 'LICENSE_USAGE',
  API_CALLS = 'API_CALLS',
  STORAGE = 'STORAGE',
  ACTIVE_USERS = 'ACTIVE_USERS',
  COST = 'COST',
  FEATURE_USAGE = 'FEATURE_USAGE'
}

/**
 * Standardized units for metric measurements across the system.
 * Ensures consistency in data representation and analysis.
 */
export enum MetricUnit {
  COUNT = 'COUNT',
  PERCENTAGE = 'PERCENTAGE',
  BYTES = 'BYTES',
  CURRENCY_USD = 'CURRENCY_USD'
}

/**
 * Base interface for all analytics metrics with enhanced metadata support.
 * Provides the fundamental structure for any metric in the system.
 */
export interface IMetric {
  /**
   * The type of metric being measured
   */
  metricType: MetricType;

  /**
   * Numerical value of the metric
   */
  value: number;

  /**
   * Unit of measurement for the metric
   */
  unit: MetricUnit;

  /**
   * Additional contextual information about the metric
   * Allows for flexible extension of metric data without interface changes
   */
  metadata: Record<string, unknown>;
}

/**
 * Comprehensive interface for usage-specific metrics with enhanced tracking capabilities.
 * Extends the base IMetric interface with additional fields for detailed usage tracking.
 */
export interface IUsageMetric extends IMetric {
  /**
   * Unique identifier for the metric record
   */
  id: string;

  /**
   * ID of the subscription this metric is associated with
   */
  subscriptionId: string;

  /**
   * ID of the organization this metric belongs to
   */
  organizationId: string;

  /**
   * System or integration that generated this metric
   */
  source: string;

  /**
   * Timestamp when the metric was recorded
   */
  timestamp: Date;
}