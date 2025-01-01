// External imports - @ngrx/store v17.0.0
import { createAction, props } from '@ngrx/store';

// Internal imports
import { IAnalyticsMetric, MetricType } from '../../../shared/models/analytics.model';

/**
 * Analytics action type constants
 */
export const analyticsActionTypes = {
    LOAD_ANALYTICS: '[Analytics] Load Analytics',
    LOAD_ANALYTICS_SUCCESS: '[Analytics] Load Analytics Success',
    LOAD_ANALYTICS_FAILURE: '[Analytics] Load Analytics Failure',
    SET_SELECTED_METRIC_TYPE: '[Analytics] Set Selected Metric Type',
    SET_DATE_RANGE: '[Analytics] Set Date Range',
    UPDATE_METRIC: '[Analytics] Update Metric',
    UPDATE_METRICS_BATCH: '[Analytics] Update Metrics Batch'
} as const;

/**
 * Interface for analytics filter options
 */
interface AnalyticsFilters {
    metricType?: MetricType;
    startDate?: Date;
    endDate?: Date;
}

/**
 * Interface for date range
 */
interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Action creator for initiating analytics data loading
 */
export const loadAnalytics = createAction(
    analyticsActionTypes.LOAD_ANALYTICS,
    props<{ filters?: AnalyticsFilters }>()
);

/**
 * Action creator for successful analytics data loading
 * Requires non-empty array of validated metrics
 */
export const loadAnalyticsSuccess = createAction(
    analyticsActionTypes.LOAD_ANALYTICS_SUCCESS,
    props<{ metrics: IAnalyticsMetric[] }>()
);

/**
 * Action creator for failed analytics data loading
 * Includes standardized error handling
 */
export const loadAnalyticsFailure = createAction(
    analyticsActionTypes.LOAD_ANALYTICS_FAILURE,
    props<{ error: Error }>()
);

/**
 * Action creator for setting the selected metric type
 * Validates against MetricType enum
 */
export const setSelectedMetricType = createAction(
    analyticsActionTypes.SET_SELECTED_METRIC_TYPE,
    props<{ metricType: MetricType }>()
);

/**
 * Action creator for setting analytics date range
 * Validates date range integrity
 */
export const setDateRange = createAction(
    analyticsActionTypes.SET_DATE_RANGE,
    props<{ dateRange: DateRange }>()
);

/**
 * Action creator for updating a single metric
 * Includes runtime validation of metric data
 */
export const updateMetric = createAction(
    analyticsActionTypes.UPDATE_METRIC,
    props<{ metric: IAnalyticsMetric }>()
);

/**
 * Action creator for batch updating multiple metrics
 * Validates array is non-empty and all metrics are valid
 */
export const updateMetricsBatch = createAction(
    analyticsActionTypes.UPDATE_METRICS_BATCH,
    props<{ metrics: IAnalyticsMetric[] }>()
);

/**
 * Type representing all possible analytics actions
 */
export type AnalyticsActions = 
    | ReturnType<typeof loadAnalytics>
    | ReturnType<typeof loadAnalyticsSuccess>
    | ReturnType<typeof loadAnalyticsFailure>
    | ReturnType<typeof setSelectedMetricType>
    | ReturnType<typeof setDateRange>
    | ReturnType<typeof updateMetric>
    | ReturnType<typeof updateMetricsBatch>;