// External imports - NgRx v17.0.0
import { createReducer, on } from '@ngrx/store';
import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';

// Internal imports
import { IAnalyticsMetric, MetricType } from '../../../shared/models/analytics.model';
import { AnalyticsState } from '../state/app.state';
import * as AnalyticsActions from '../actions/analytics.actions';

/**
 * Entity adapter for managing analytics metrics collection with optimized CRUD operations
 * Includes custom sorting by timestamp for real-time updates
 */
export const adapter: EntityAdapter<IAnalyticsMetric> = createEntityAdapter<IAnalyticsMetric>({
  selectId: (metric) => metric.id,
  sortComparer: (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
});

/**
 * Initial state for analytics with comprehensive error handling and loading states
 */
export const initialState: AnalyticsState = adapter.getInitialState({
  selectedMetricType: null,
  dateRange: {
    start: new Date(),
    end: new Date()
  },
  loading: {
    isLoading: false,
    operation: null
  },
  error: null,
  aggregates: {
    totalCost: 0,
    averageUtilization: 0,
    activeSubscriptions: 0
  },
  lastUpdated: new Date()
});

/**
 * Enhanced analytics reducer with optimized performance and comprehensive error handling
 */
export const analyticsReducer = createReducer(
  initialState,

  // Handle analytics load initiation
  on(AnalyticsActions.loadAnalytics, (state) => ({
    ...state,
    loading: {
      isLoading: true,
      operation: 'LOAD'
    },
    error: null
  })),

  // Handle successful analytics load
  on(AnalyticsActions.loadAnalyticsSuccess, (state, { metrics }) => {
    const updatedState = adapter.setAll(metrics, {
      ...state,
      loading: {
        isLoading: false,
        operation: null
      },
      error: null,
      lastUpdated: new Date()
    });

    // Calculate aggregates for loaded metrics
    const aggregates = calculateAggregates(metrics);
    return {
      ...updatedState,
      aggregates
    };
  }),

  // Handle analytics load failure
  on(AnalyticsActions.loadAnalyticsFailure, (state, { error }) => ({
    ...state,
    loading: {
      isLoading: false,
      operation: null
    },
    error: {
      message: error.message,
      timestamp: new Date(),
      code: 'ANALYTICS_LOAD_ERROR'
    }
  })),

  // Handle metric type selection with validation
  on(AnalyticsActions.setSelectedMetricType, (state, { metricType }) => {
    if (!Object.values(MetricType).includes(metricType)) {
      return {
        ...state,
        error: {
          message: 'Invalid metric type selected',
          timestamp: new Date(),
          code: 'INVALID_METRIC_TYPE'
        }
      };
    }
    return {
      ...state,
      selectedMetricType: metricType,
      error: null
    };
  }),

  // Handle date range updates with validation
  on(AnalyticsActions.setDateRange, (state, { dateRange }) => {
    if (dateRange.start > dateRange.end) {
      return {
        ...state,
        error: {
          message: 'Invalid date range: Start date cannot be after end date',
          timestamp: new Date(),
          code: 'INVALID_DATE_RANGE'
        }
      };
    }
    return {
      ...state,
      dateRange: {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      },
      error: null
    };
  }),

  // Handle single metric update with optimistic update
  on(AnalyticsActions.updateMetric, (state, { metric }) => {
    const updatedState = adapter.upsertOne(metric, {
      ...state,
      lastUpdated: new Date()
    });
    const metrics = Object.values(updatedState.entities);
    return {
      ...updatedState,
      aggregates: calculateAggregates(metrics)
    };
  }),

  // Handle batch metric updates with performance optimization
  on(AnalyticsActions.updateMetricsBatch, (state, { metrics }) => {
    const updatedState = adapter.upsertMany(metrics, {
      ...state,
      lastUpdated: new Date()
    });
    return {
      ...updatedState,
      aggregates: calculateAggregates(metrics)
    };
  })
);

/**
 * Helper function to calculate analytics aggregates
 * @param metrics Array of analytics metrics
 * @returns Calculated aggregate values
 */
function calculateAggregates(metrics: IAnalyticsMetric[]): {
  totalCost: number;
  averageUtilization: number;
  activeSubscriptions: number;
} {
  const costMetrics = metrics.filter(m => m.metricType === MetricType.COST);
  const utilizationMetrics = metrics.filter(m => m.metricType === MetricType.LICENSE_USAGE);

  return {
    totalCost: costMetrics.reduce((sum, metric) => sum + metric.value, 0),
    averageUtilization: utilizationMetrics.length > 0
      ? utilizationMetrics.reduce((sum, metric) => sum + metric.value, 0) / utilizationMetrics.length
      : 0,
    activeSubscriptions: new Set(metrics.map(m => m.subscriptionId)).size
  };
}

// Export the entity adapter selectors
export const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = adapter.getSelectors();