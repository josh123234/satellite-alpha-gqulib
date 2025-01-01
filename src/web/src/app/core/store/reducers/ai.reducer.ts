// External imports
import { createReducer, on } from '@ngrx/store'; // v17.0.0
import { EntityState, createEntityAdapter } from '@ngrx/entity'; // v17.0.0

// Internal imports
import { AIInsightDTO } from '../../../shared/models/analytics.model';
import {
  requestAIInsight,
  loadAIInsights,
  loadAIInsightsSuccess,
  loadAIInsightsFailure,
  dismissAIInsight,
  realTimeInsightUpdate,
  InsightType
} from '../actions/ai.actions';

/**
 * Interface for enhanced error state tracking
 */
export interface ErrorState {
  code: string;
  message: string;
  timestamp: Date;
}

/**
 * Interface for AI feature state with real-time capabilities
 */
export interface AIState extends EntityState<AIInsightDTO> {
  loading: boolean;
  error: ErrorState | null;
  selectedInsightId: string | null;
  lastUpdated: Date | null;
}

/**
 * Entity adapter for optimized AI insight management
 * Configured with custom ID selector and timestamp-based sorting
 */
export const aiAdapter = createEntityAdapter<AIInsightDTO>({
  selectId: (insight) => insight.id,
  sortComparer: (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
});

/**
 * Initial state configuration for AI feature
 */
export const initialState: AIState = aiAdapter.getInitialState({
  loading: false,
  error: null,
  selectedInsightId: null,
  lastUpdated: null
});

/**
 * Enhanced NgRx reducer for AI state management with real-time support
 */
export const aiReducer = createReducer(
  initialState,

  // Handle AI insight request initiation
  on(requestAIInsight, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  // Handle loading of AI insights
  on(loadAIInsights, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  // Handle successful insights load
  on(loadAIInsightsSuccess, (state, { insights, timestamp }) => {
    const updatedState = aiAdapter.setAll(insights, {
      ...state,
      loading: false,
      error: null,
      lastUpdated: timestamp
    });
    return updatedState;
  }),

  // Handle insights load failure with enhanced error tracking
  on(loadAIInsightsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date()
    }
  })),

  // Handle insight dismissal with optimistic update
  on(dismissAIInsight, (state, { insightId }) => {
    return aiAdapter.removeOne(insightId, {
      ...state,
      lastUpdated: new Date()
    });
  }),

  // Handle real-time insight updates via WebSocket
  on(realTimeInsightUpdate, (state, { insight, timestamp }) => {
    // Upsert to handle both new insights and updates
    const updatedState = aiAdapter.upsertOne(insight, {
      ...state,
      lastUpdated: timestamp
    });
    return updatedState;
  })
);

// Export entity adapter selectors for use in feature selectors
export const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = aiAdapter.getSelectors();