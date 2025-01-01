/**
 * @fileoverview NgRx selectors for subscription state management in SaaS Management Platform
 * @version 1.0.0
 */

// External imports - @ngrx/store v17.0.0
import { createSelector } from '@ngrx/store';

// Internal imports
import { AppState } from '../state/app.state';
import { subscriptionAdapter } from '../reducers/subscription.reducer';
import { Subscription, SubscriptionStatus } from '../../../shared/models/subscription.model';
import { IAnalyticsMetric } from '../../../shared/models/analytics.model';

/**
 * Feature selector for subscription state
 */
export const selectSubscriptionState = (state: AppState) => state.subscriptions;

/**
 * Entity adapter selectors
 */
const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = subscriptionAdapter.getSelectors();

/**
 * Select all subscriptions from state
 */
export const selectAllSubscriptions = createSelector(
  selectSubscriptionState,
  selectAll
);

/**
 * Select subscription entities dictionary
 */
export const selectSubscriptionEntities = createSelector(
  selectSubscriptionState,
  selectEntities
);

/**
 * Select currently selected subscription ID
 */
export const selectSelectedSubscriptionId = createSelector(
  selectSubscriptionState,
  state => state.selectedSubscriptionId
);

/**
 * Select currently selected subscription with analytics data
 */
export const selectSelectedSubscription = createSelector(
  selectSubscriptionEntities,
  selectSelectedSubscriptionId,
  (entities, selectedId) => selectedId ? entities[selectedId] : null
);

/**
 * Select loading state
 */
export const selectSubscriptionLoading = createSelector(
  selectSubscriptionState,
  state => state.loading
);

/**
 * Select error state
 */
export const selectSubscriptionError = createSelector(
  selectSubscriptionState,
  state => state.error
);

/**
 * Select analytics loading state
 */
export const selectSubscriptionAnalyticsLoading = createSelector(
  selectSubscriptionState,
  state => state.analyticsLoading
);

/**
 * Select subscription alert queue
 */
export const selectSubscriptionAlertQueue = createSelector(
  selectSubscriptionState,
  state => state.alertQueue
);

/**
 * Select last updated timestamp
 */
export const selectSubscriptionLastUpdated = createSelector(
  selectSubscriptionState,
  state => new Date(state.lastUpdated)
);

/**
 * Select active subscriptions sorted by renewal date
 */
export const selectActiveSubscriptions = createSelector(
  selectAllSubscriptions,
  (subscriptions) => subscriptions
    .filter(sub => sub.status === SubscriptionStatus.ACTIVE)
    .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
);

/**
 * Select subscriptions by status with memoization
 * @param status Subscription status to filter by
 */
export const selectSubscriptionsByStatus = createSelector(
  selectAllSubscriptions,
  (subscriptions: Subscription[], props: { status: SubscriptionStatus }) =>
    subscriptions
      .filter(sub => sub.status === props.status)
      .sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Select subscriptions with high utilization (>80%)
 */
export const selectHighUtilizationSubscriptions = createSelector(
  selectAllSubscriptions,
  (subscriptions) => subscriptions
    .filter(sub => sub.usageMetrics.utilizationRate > 80)
    .sort((a, b) => b.usageMetrics.utilizationRate - a.usageMetrics.utilizationRate)
);

/**
 * Select subscriptions requiring renewal in next 30 days
 */
export const selectUpcomingRenewals = createSelector(
  selectAllSubscriptions,
  (subscriptions) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return subscriptions
      .filter(sub => {
        const renewalDate = new Date(sub.renewalDate);
        return renewalDate <= thirtyDaysFromNow && sub.status === SubscriptionStatus.ACTIVE;
      })
      .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());
  }
);

/**
 * Select total monthly cost of all active subscriptions
 */
export const selectTotalMonthlyCost = createSelector(
  selectActiveSubscriptions,
  (subscriptions) => subscriptions.reduce((total, sub) => total + sub.cost, 0)
);

/**
 * Select subscription version for change detection
 */
export const selectSubscriptionVersion = createSelector(
  selectSubscriptionState,
  state => state.version
);

/**
 * Select optimistic updates map for tracking pending changes
 */
export const selectOptimisticUpdates = createSelector(
  selectSubscriptionState,
  state => state.optimisticUpdates
);

/**
 * Select subscriptions with pending alerts
 */
export const selectSubscriptionsWithAlerts = createSelector(
  selectAllSubscriptions,
  selectSubscriptionAlertQueue,
  (subscriptions, alerts) => subscriptions
    .filter(sub => alerts.some(alert => alert.id === sub.id))
    .map(sub => ({
      ...sub,
      alerts: alerts.filter(alert => alert.id === sub.id)
    }))
);