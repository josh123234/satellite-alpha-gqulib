// External imports - @ngrx/store v17.0.0
import { createAction, props } from '@ngrx/store';

// Internal imports
import { AIInsightDTO } from '../../../shared/models/analytics.model';

/**
 * Action type constants for AI-related state management
 */
export const AI_ACTION_TYPES = {
  REQUEST_INSIGHT: '[AI] Request Insight',
  LOAD_INSIGHTS: '[AI] Load Insights',
  LOAD_INSIGHTS_SUCCESS: '[AI] Load Insights Success',
  LOAD_INSIGHTS_FAILURE: '[AI] Load Insights Failure',
  DISMISS_INSIGHT: '[AI] Dismiss Insight',
  REALTIME_INSIGHT_UPDATE: '[AI] Real-time Insight Update'
} as const;

/**
 * Action to request generation of new AI insights
 * Triggers AI analysis based on specified type and optional context
 */
export const requestAIInsight = createAction(
  AI_ACTION_TYPES.REQUEST_INSIGHT,
  props<{
    type: InsightType;
    context?: string;
  }>()
);

/**
 * Action to load existing AI insights with optional filtering
 * Supports filtering by type, date range, and other criteria
 */
export const loadAIInsights = createAction(
  AI_ACTION_TYPES.LOAD_INSIGHTS,
  props<{
    type?: InsightType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }>()
);

/**
 * Action for successful AI insights load
 * Includes loaded insights array and timestamp of retrieval
 */
export const loadAIInsightsSuccess = createAction(
  AI_ACTION_TYPES.LOAD_INSIGHTS_SUCCESS,
  props<{
    insights: AIInsightDTO[];
    timestamp: Date;
    total?: number;
  }>()
);

/**
 * Action for failed AI insights load
 * Includes error details for error handling and display
 */
export const loadAIInsightsFailure = createAction(
  AI_ACTION_TYPES.LOAD_INSIGHTS_FAILURE,
  props<{
    error: {
      code: string;
      message: string;
      details?: any;
    }
  }>()
);

/**
 * Action to dismiss an AI insight
 * Includes optional reason for analytics and improvement
 */
export const dismissAIInsight = createAction(
  AI_ACTION_TYPES.DISMISS_INSIGHT,
  props<{
    insightId: string;
    reason?: string;
    timestamp: Date;
  }>()
);

/**
 * Action for handling real-time insight updates via WebSocket
 * Supports immediate state updates for new AI-generated insights
 */
export const realTimeInsightUpdate = createAction(
  AI_ACTION_TYPES.REALTIME_INSIGHT_UPDATE,
  props<{
    insight: AIInsightDTO;
    source: string;
    timestamp: Date;
  }>()
);

/**
 * Type definition for supported insight types
 * Aligned with backend AI analysis capabilities
 */
export enum InsightType {
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  LICENSE_UTILIZATION = 'LICENSE_UTILIZATION',
  USAGE_PATTERN = 'USAGE_PATTERN',
  SECURITY_RISK = 'SECURITY_RISK',
  RENEWAL_RECOMMENDATION = 'RENEWAL_RECOMMENDATION'
}