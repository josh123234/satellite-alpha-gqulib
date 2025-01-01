/**
 * @fileoverview NgRx actions for subscription management in the SaaS Management Platform
 * @version 1.0.0
 */

// External imports - @ngrx/store v17.0.0
import { createAction, props } from '@ngrx/store';

// Internal imports
import { Subscription, SubscriptionStatus } from '../../../shared/models/subscription.model';

/**
 * Action type constants for subscription management
 */
export const subscriptionActionTypes = {
  // Load Operations
  LOAD_SUBSCRIPTIONS: '[Subscription] Load Subscriptions',
  LOAD_SUBSCRIPTIONS_SUCCESS: '[Subscription] Load Subscriptions Success',
  LOAD_SUBSCRIPTIONS_FAILURE: '[Subscription] Load Subscriptions Failure',
  
  // CRUD Operations
  CREATE_SUBSCRIPTION: '[Subscription] Create Subscription',
  CREATE_SUBSCRIPTION_SUCCESS: '[Subscription] Create Subscription Success',
  CREATE_SUBSCRIPTION_FAILURE: '[Subscription] Create Subscription Failure',
  
  UPDATE_SUBSCRIPTION: '[Subscription] Update Subscription',
  UPDATE_SUBSCRIPTION_SUCCESS: '[Subscription] Update Subscription Success',
  UPDATE_SUBSCRIPTION_FAILURE: '[Subscription] Update Subscription Failure',
  
  DELETE_SUBSCRIPTION: '[Subscription] Delete Subscription',
  DELETE_SUBSCRIPTION_SUCCESS: '[Subscription] Delete Subscription Success',
  DELETE_SUBSCRIPTION_FAILURE: '[Subscription] Delete Subscription Failure',
  
  // Real-time Updates
  SUBSCRIPTION_WEBSOCKET_UPDATE: '[Subscription] WebSocket Update',
  SUBSCRIPTION_STATUS_CHANGE: '[Subscription] Status Change',
  SUBSCRIPTION_ANALYTICS_UPDATE: '[Subscription] Analytics Update',
  
  // Alerts and Notifications
  SUBSCRIPTION_ALERT: '[Subscription] Alert',
  SUBSCRIPTION_RENEWAL_NOTIFICATION: '[Subscription] Renewal Notification',
  
  // Usage Tracking
  UPDATE_USAGE_METRICS: '[Subscription] Update Usage Metrics',
  UPDATE_LICENSE_COUNT: '[Subscription] Update License Count'
};

/**
 * Load Subscription Actions
 */
export const loadSubscriptions = createAction(
  subscriptionActionTypes.LOAD_SUBSCRIPTIONS
);

export const loadSubscriptionsSuccess = createAction(
  subscriptionActionTypes.LOAD_SUBSCRIPTIONS_SUCCESS,
  props<{ subscriptions: Subscription[] }>()
);

export const loadSubscriptionsFailure = createAction(
  subscriptionActionTypes.LOAD_SUBSCRIPTIONS_FAILURE,
  props<{ error: any }>()
);

/**
 * CRUD Operation Actions
 */
export const createSubscription = createAction(
  subscriptionActionTypes.CREATE_SUBSCRIPTION,
  props<{ subscription: Omit<Subscription, 'id'> }>()
);

export const createSubscriptionSuccess = createAction(
  subscriptionActionTypes.CREATE_SUBSCRIPTION_SUCCESS,
  props<{ subscription: Subscription }>()
);

export const createSubscriptionFailure = createAction(
  subscriptionActionTypes.CREATE_SUBSCRIPTION_FAILURE,
  props<{ error: any }>()
);

export const updateSubscription = createAction(
  subscriptionActionTypes.UPDATE_SUBSCRIPTION,
  props<{ id: string; changes: Partial<Subscription> }>()
);

export const updateSubscriptionSuccess = createAction(
  subscriptionActionTypes.UPDATE_SUBSCRIPTION_SUCCESS,
  props<{ subscription: Subscription }>()
);

export const updateSubscriptionFailure = createAction(
  subscriptionActionTypes.UPDATE_SUBSCRIPTION_FAILURE,
  props<{ error: any }>()
);

export const deleteSubscription = createAction(
  subscriptionActionTypes.DELETE_SUBSCRIPTION,
  props<{ id: string }>()
);

export const deleteSubscriptionSuccess = createAction(
  subscriptionActionTypes.DELETE_SUBSCRIPTION_SUCCESS,
  props<{ id: string }>()
);

export const deleteSubscriptionFailure = createAction(
  subscriptionActionTypes.DELETE_SUBSCRIPTION_FAILURE,
  props<{ error: any }>()
);

/**
 * Real-time Update Actions
 */
export const subscriptionWebSocketUpdate = createAction(
  subscriptionActionTypes.SUBSCRIPTION_WEBSOCKET_UPDATE,
  props<{ subscription: Partial<Subscription> }>()
);

export const subscriptionStatusChange = createAction(
  subscriptionActionTypes.SUBSCRIPTION_STATUS_CHANGE,
  props<{ id: string; status: SubscriptionStatus }>()
);

export const subscriptionAnalyticsUpdate = createAction(
  subscriptionActionTypes.SUBSCRIPTION_ANALYTICS_UPDATE,
  props<{
    subscriptionId: string;
    analytics: {
      utilizationRate: number;
      activeUsers: number;
      lastActive: Date;
    }
  }>()
);

/**
 * Alert and Notification Actions
 */
export const subscriptionAlert = createAction(
  subscriptionActionTypes.SUBSCRIPTION_ALERT,
  props<{
    alert: {
      id: string;
      type: 'warning' | 'error' | 'info';
      message: string;
      subscriptionId?: string;
    }
  }>()
);

export const subscriptionRenewalNotification = createAction(
  subscriptionActionTypes.SUBSCRIPTION_RENEWAL_NOTIFICATION,
  props<{
    subscriptionId: string;
    renewalDate: Date;
    cost: number;
  }>()
);

/**
 * Usage Tracking Actions
 */
export const updateUsageMetrics = createAction(
  subscriptionActionTypes.UPDATE_USAGE_METRICS,
  props<{
    subscriptionId: string;
    metrics: {
      utilizationRate: number;
      activeUsers: number;
      lastActive: Date;
    }
  }>()
);

export const updateLicenseCount = createAction(
  subscriptionActionTypes.UPDATE_LICENSE_COUNT,
  props<{
    subscriptionId: string;
    totalLicenses: number;
    usedLicenses: number;
  }>()
);