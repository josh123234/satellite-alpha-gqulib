// External imports
import { UUID } from 'crypto'; // v20.0.0+

/**
 * Enumeration of supported metric types for analytics data
 * @enum {string}
 */
export enum MetricType {
    LICENSE_USAGE = 'LICENSE_USAGE',
    API_CALLS = 'API_CALLS',
    STORAGE = 'STORAGE',
    ACTIVE_USERS = 'ACTIVE_USERS',
    COST = 'COST'
}

/**
 * Core interface for analytics metrics data with readonly properties for immutability
 * @interface
 */
export interface IAnalyticsMetric {
    readonly id: UUID;
    readonly subscriptionId: UUID;
    readonly metricType: MetricType;
    readonly value: number;
    readonly unit: string;
    readonly timestamp: Date;
}

/**
 * Interface for metric validation rules
 * @interface
 */
export interface IMetricValidation {
    readonly minValue: number;
    readonly maxValue: number;
    readonly allowedUnits: string[];
    readonly allowNegative: boolean;
}

/**
 * Type guard for ensuring valid metric types
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid MetricType
 */
export const isMetricType = (value: unknown): value is MetricType => {
    return Object.values(MetricType).includes(value as MetricType);
};

/**
 * Type definition for metric formatting functions
 */
export type MetricFormatter = (value: number, unit: string) => string;

/**
 * Enhanced class implementing IAnalyticsMetric with validation and utility methods
 * @class
 */
export class AnalyticsMetric implements IAnalyticsMetric {
    private readonly _id: UUID;
    private readonly _subscriptionId: UUID;
    private readonly _metricType: MetricType;
    private readonly _value: number;
    private readonly _unit: string;
    private readonly _timestamp: Date;

    /**
     * Default validation rules for metrics
     * @private
     * @static
     */
    private static readonly DEFAULT_VALIDATION: IMetricValidation = {
        minValue: 0,
        maxValue: Number.MAX_SAFE_INTEGER,
        allowedUnits: ['count', 'bytes', 'seconds', 'currency'],
        allowNegative: false
    };

    /**
     * Creates a new AnalyticsMetric instance with validation
     * @param data - Analytics metric data
     * @throws {Error} If validation fails
     */
    constructor(data: IAnalyticsMetric) {
        // Validate input data completeness
        if (!data || !data.id || !data.subscriptionId || !data.metricType) {
            throw new Error('Required metric data fields missing');
        }

        // Verify metric type using type guard
        if (!isMetricType(data.metricType)) {
            throw new Error('Invalid metric type');
        }

        // Validate value and timestamp
        if (!this.validateMetric(data, AnalyticsMetric.DEFAULT_VALIDATION)) {
            throw new Error('Metric validation failed');
        }

        // Initialize immutable properties
        this._id = data.id;
        this._subscriptionId = data.subscriptionId;
        this._metricType = data.metricType;
        this._value = data.value;
        this._unit = data.unit;
        this._timestamp = new Date(data.timestamp);
    }

    // Implement readonly interface properties
    get id(): UUID { return this._id; }
    get subscriptionId(): UUID { return this._subscriptionId; }
    get metricType(): MetricType { return this._metricType; }
    get value(): number { return this._value; }
    get unit(): string { return this._unit; }
    get timestamp(): Date { return new Date(this._timestamp); }

    /**
     * Validates metric data against defined rules
     * @param data - Metric data to validate
     * @param rules - Validation rules to apply
     * @returns Boolean indicating validation success
     */
    public validateMetric(data: IAnalyticsMetric, rules: IMetricValidation): boolean {
        // Check value ranges
        if (data.value < rules.minValue || data.value > rules.maxValue) {
            return false;
        }

        // Check if negative values are allowed
        if (!rules.allowNegative && data.value < 0) {
            return false;
        }

        // Validate unit
        if (!rules.allowedUnits.includes(data.unit)) {
            return false;
        }

        // Verify timestamp
        const timestamp = new Date(data.timestamp);
        if (isNaN(timestamp.getTime())) {
            return false;
        }

        return true;
    }

    /**
     * Serializes metric data for storage or transmission
     * @returns JSON string representation of metric data
     */
    public serialize(): string {
        const serializable = {
            id: this._id,
            subscriptionId: this._subscriptionId,
            metricType: this._metricType,
            value: this._value,
            unit: this._unit,
            timestamp: this._timestamp.toISOString()
        };
        return JSON.stringify(serializable);
    }

    /**
     * Creates a formatted string representation of the metric value
     * @returns Formatted metric string
     */
    public toString(): string {
        switch (this._metricType) {
            case MetricType.COST:
                return `${this._value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
            case MetricType.STORAGE:
                return `${this._value.toLocaleString()} ${this._unit}`;
            default:
                return `${this._value.toLocaleString()} ${this._unit}`;
        }
    }
}