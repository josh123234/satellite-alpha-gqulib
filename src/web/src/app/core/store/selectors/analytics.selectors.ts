/**
 * @fileoverview Analytics state selectors for the SaaS Management Platform
 * Implements memoized selectors for analytics metrics, cost analysis, and usage trends
 * with strict type safety and performance optimization.
 * @version 1.0.0
 */

import { createSelector } from '@ngrx/store'; // v17.0.0
import { Dictionary } from '@ngrx/entity'; // v17.0.0
import { AppState } from '../state/app.state';
import { IAnalyticsMetric, MetricType } from '../../../shared/models/analytics.model';

/**
 * Base selector to access analytics state slice
 */
export const selectAnalyticsState = (state: AppState) => state.analytics;

/**
 * Memoized selector to retrieve all analytics metrics sorted by timestamp
 */
export const selectAllMetrics = createSelector(
  selectAnalyticsState,
  (state) => {
    const metrics = Object.values(state.entities as Dictionary<IAnalyticsMetric>);
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
);

/**
 * Memoized selector factory for filtering metrics by type
 * @param metricType - Type of metrics to filter
 */
export const selectMetricsByType = (metricType: MetricType) => createSelector(
  selectAllMetrics,
  (metrics): IAnalyticsMetric[] => 
    metrics.filter(metric => metric.metricType === metricType)
);

/**
 * Memoized selector for currently selected metric type
 */
export const selectSelectedMetricType = createSelector(
  selectAnalyticsState,
  (state) => state.selectedMetricType
);

/**
 * Memoized selector for analytics date range
 */
export const selectDateRange = createSelector(
  selectAnalyticsState,
  (state) => ({
    start: state.dateRange.start,
    end: state.dateRange.end
  })
);

/**
 * Memoized selector for analytics loading state
 */
export const selectAnalyticsLoading = createSelector(
  selectAnalyticsState,
  (state) => state.loading
);

/**
 * Memoized selector for analytics error state
 */
export const selectAnalyticsError = createSelector(
  selectAnalyticsState,
  (state) => state.error
);

/**
 * Memoized selector for analytics aggregates
 */
export const selectAnalyticsAggregates = createSelector(
  selectAnalyticsState,
  (state) => state.aggregates
);

/**
 * Memoized selector for filtered metrics within selected date range
 */
export const selectMetricsInDateRange = createSelector(
  selectAllMetrics,
  selectDateRange,
  (metrics, dateRange): IAnalyticsMetric[] => 
    metrics.filter(metric => 
      metric.timestamp >= dateRange.start && 
      metric.timestamp <= dateRange.end
    )
);

/**
 * Memoized selector for cost metrics with department breakdown
 */
export const selectCostMetricsByDepartment = createSelector(
  selectMetricsByType(MetricType.COST),
  (costMetrics): Record<string, number> => {
    const departmentCosts: Record<string, number> = {};
    costMetrics.forEach(metric => {
      const department = (metric as any).department || 'Unassigned';
      departmentCosts[department] = (departmentCosts[department] || 0) + metric.value;
    });
    return departmentCosts;
  }
);

/**
 * Memoized selector for usage efficiency metrics
 */
export const selectUsageEfficiencyMetrics = createSelector(
  selectMetricsByType(MetricType.LICENSE_USAGE),
  (usageMetrics): { efficiency: number; underutilized: number } => {
    const totalMetrics = usageMetrics.length;
    if (!totalMetrics) {
      return { efficiency: 0, underutilized: 0 };
    }

    const underutilizedThreshold = 0.3; // 30% usage threshold
    const underutilizedCount = usageMetrics.filter(
      metric => metric.value < underutilizedThreshold
    ).length;

    return {
      efficiency: (totalMetrics - underutilizedCount) / totalMetrics,
      underutilized: underutilizedCount
    };
  }
);

/**
 * Memoized selector for trend analysis over time periods
 */
export const selectMetricTrends = createSelector(
  selectMetricsInDateRange,
  selectSelectedMetricType,
  (metrics, selectedType): { trend: number; change: number } => {
    if (!metrics.length || !selectedType) {
      return { trend: 0, change: 0 };
    }

    const filteredMetrics = metrics.filter(m => m.metricType === selectedType);
    if (filteredMetrics.length < 2) {
      return { trend: 0, change: 0 };
    }

    const latest = filteredMetrics[0].value;
    const previous = filteredMetrics[filteredMetrics.length - 1].value;
    const change = latest - previous;
    const trend = (change / previous) * 100;

    return { trend, change };
  }
);