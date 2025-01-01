/**
 * @fileoverview NgRx reducer for subscription state management in SaaS Management Platform
 * @version 1.0.0
 */

// External imports - @ngrx/store v17.0.0, @ngrx/entity v17.0.0
import { createReducer, on } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

// Internal imports
import { Subscription } from '../../../shared/models/subscription.model';
import * as SubscriptionActions from '../actions/subscription.actions';

/**
 * Enhanced interface for subscription state management
 */
export interface SubscriptionState extends EntityState<Subscription> {
  selectedSubscriptionId: string | null;
  loading: boolean;
  analyticsLoading: boolean;
  error: { message: string; code: string } | null;
  lastUpdated: number;
  alertQueue: Array<{ id: string; message: string; type: string }>;
  optimisticUpdates: Map<string, Subscription>;
  version: number;
}

/**
 * Entity adapter configuration with custom sorting
 */
export const subscriptionAdapter: EntityAdapter<Subscription> = createEntityAdapter<Subscription>({
  selectId: (subscription: Subscription) => subscription.id,
  sortComparer: (a: Subscription, b: Subscription) => {
    // Sort by status (ACTIVE first) then by name
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return a.name.localeCompare(b.name);
  }
});

/**
 * Initial state configuration
 */
export const initialState: SubscriptionState = subscriptionAdapter.getInitialState({
  selectedSubscriptionId: null,
  loading: false,
  analyticsLoading: false,
  error: null,
  lastUpdated: 0,
  alertQueue: [],
  optimisticUpdates: new Map(),
  version: 1
});

/**
 * Enhanced subscription reducer with comprehensive state management
 */
export const subscriptionReducer = createReducer(
  initialState,

  // Load subscriptions
  on(SubscriptionActions.loadSubscriptions, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(SubscriptionActions.loadSubscriptionsSuccess, (state, { subscriptions }) => {
    const updated = subscriptionAdapter.setAll(subscriptions, {
      ...state,
      loading: false,
      lastUpdated: Date.now(),
      version: state.version + 1
    });
    return updated;
  }),

  on(SubscriptionActions.loadSubscriptionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: {
      message: error.message || 'Failed to load subscriptions',
      code: error.code || 'LOAD_ERROR'
    }
  })),

  // CRUD operations with optimistic updates
  on(SubscriptionActions.createSubscription, (state, { subscription }) => {
    const tempId = `temp-${Date.now()}`;
    const tempSubscription = { ...subscription, id: tempId };
    state.optimisticUpdates.set(tempId, tempSubscription);
    return subscriptionAdapter.addOne(tempSubscription, {
      ...state,
      lastUpdated: Date.now()
    });
  }),

  on(SubscriptionActions.updateSubscription, (state, { id, changes }) => {
    const original = state.entities[id];
    state.optimisticUpdates.set(id, original!);
    return subscriptionAdapter.updateOne(
      { id, changes },
      {
        ...state,
        lastUpdated: Date.now()
      }
    );
  }),

  // Real-time updates
  on(SubscriptionActions.subscriptionWebSocketUpdate, (state, { subscription }) => {
    return subscriptionAdapter.updateOne(
      {
        id: subscription.id,
        changes: subscription
      },
      {
        ...state,
        lastUpdated: Date.now(),
        version: state.version + 1
      }
    );
  }),

  // Analytics updates
  on(SubscriptionActions.subscriptionAnalyticsUpdate, (state, { subscriptionId, analytics }) => {
    return subscriptionAdapter.updateOne(
      {
        id: subscriptionId,
        changes: {
          usageMetrics: {
            ...state.entities[subscriptionId]?.usageMetrics,
            utilizationRate: analytics.utilizationRate,
            activeUsers: analytics.activeUsers,
            lastActive: analytics.lastActive
          }
        }
      },
      {
        ...state,
        analyticsLoading: false,
        lastUpdated: Date.now()
      }
    );
  }),

  // Alert management
  on(SubscriptionActions.subscriptionAlert, (state, { alert }) => ({
    ...state,
    alertQueue: [
      ...state.alertQueue,
      {
        id: alert.id,
        message: alert.message,
        type: alert.type
      }
    ].slice(-5) // Keep last 5 alerts
  })),

  // Error handling with rollback capability
  on(SubscriptionActions.updateSubscriptionFailure, (state, { error }) => {
    const rollbackState = { ...state };
    Array.from(state.optimisticUpdates.entries()).forEach(([id, original]) => {
      if (original) {
        rollbackState.entities[id] = original;
      }
    });
    return {
      ...subscriptionAdapter.setAll(Object.values(rollbackState.entities), rollbackState),
      error: {
        message: error.message || 'Update failed',
        code: error.code || 'UPDATE_ERROR'
      },
      optimisticUpdates: new Map(),
      lastUpdated: Date.now()
    };
  })
);

/**
 * Export entity adapter selectors
 */
export const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = subscriptionAdapter.getSelectors();