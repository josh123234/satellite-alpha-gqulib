/**
 * @fileoverview NgRx selectors for AI state management in the SaaS Management Platform
 * Provides memoized, type-safe selectors for accessing AI insights and related state
 * @version 1.0.0
 */

// External imports - @ngrx/store v17.0.0
import { createFeatureSelector, createSelector } from '@ngrx/store';

// Internal imports
import { AppState } from '../state/app.state';
import { AIState, aiAdapter } from '../reducers/ai.reducer';

/**
 * Feature selector for accessing the AI state slice
 * Provides type-safe access to AI feature state
 */
export const selectAIState = createFeatureSelector<AIState>('ai');

/**
 * Entity adapter selectors for optimized entity operations
 * Leverages NgRx Entity adapter's built-in selectors
 */
const {
  selectIds: selectAIInsightIds,
  selectEntities: selectAIInsightEntities,
  selectAll: selectAllAIInsights,
  selectTotal: selectTotalAIInsights,
} = aiAdapter.getSelectors(selectAIState);

/**
 * Selector for AI loading state
 * Supports real-time updates via WebSocket integration
 */
export const selectAILoading = createSelector(
  selectAIState,
  (state: AIState): boolean => state.loading
);

/**
 * Enhanced error state selector with null safety
 * Provides detailed error information for error handling
 */
export const selectAIError = createSelector(
  selectAIState,
  (state: AIState) => state.error
);

/**
 * Selector for last update timestamp
 * Tracks real-time updates and data freshness
 */
export const selectLastUpdated = createSelector(
  selectAIState,
  (state: AIState): Date | null => state.lastUpdated
);

/**
 * Optimized selector for currently selected AI insight
 * Implements null safety and entity lookup optimization
 */
export const selectSelectedAIInsight = createSelector(
  selectAIState,
  selectAIInsightEntities,
  (state: AIState) => {
    return state.selectedInsightId 
      ? selectAIInsightEntities[state.selectedInsightId] 
      : null;
  }
);

/**
 * Selector for total number of AI insights
 * Useful for pagination and analytics
 */
export const selectAIInsightCount = createSelector(
  selectAIState,
  selectTotalAIInsights
);

/**
 * Selector for checking if there are any insights available
 * Optimized for frequent UI checks
 */
export const selectHasInsights = createSelector(
  selectTotalAIInsights,
  (total: number): boolean => total > 0
);

/**
 * Selector for AI insights with loading and error state
 * Provides comprehensive state for UI components
 */
export const selectAIInsightsState = createSelector(
  selectAllAIInsights,
  selectAILoading,
  selectAIError,
  selectLastUpdated,
  (insights, loading, error, lastUpdated) => ({
    insights,
    loading,
    error,
    lastUpdated
  })
);

/**
 * Selector for filtered AI insights based on type
 * Supports dynamic filtering of insights
 */
export const selectInsightsByType = (insightType: string) => createSelector(
  selectAllAIInsights,
  (insights) => insights.filter(insight => insight.type === insightType)
);

/**
 * Selector for recent AI insights within specified time window
 * Supports real-time updates and temporal filtering
 */
export const selectRecentInsights = (timeWindowMs: number) => createSelector(
  selectAllAIInsights,
  selectLastUpdated,
  (insights, lastUpdated) => {
    if (!lastUpdated) return [];
    const cutoffTime = new Date(lastUpdated.getTime() - timeWindowMs);
    return insights.filter(insight => insight.timestamp >= cutoffTime);
  }
);

/**
 * Selector for critical AI insights requiring immediate attention
 * Prioritizes high-impact insights for user attention
 */
export const selectCriticalInsights = createSelector(
  selectAllAIInsights,
  (insights) => insights.filter(insight => 
    insight.priority === 'HIGH' && 
    !insight.dismissed
  )
);

/**
 * Selector for AI insights performance metrics
 * Provides analytics data for monitoring and optimization
 */
export const selectAIPerformanceMetrics = createSelector(
  selectAllAIInsights,
  selectLastUpdated,
  (insights, lastUpdated) => ({
    totalInsights: insights.length,
    averageConfidence: insights.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / insights.length,
    lastUpdateTime: lastUpdated,
    criticalInsightsCount: insights.filter(i => i.priority === 'HIGH').length
  })
);