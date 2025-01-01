/**
 * @fileoverview Root state interface and initial state for NgRx store
 * Implements comprehensive state management for the SaaS Management Platform
 * @version 1.0.0
 */

import { EntityState } from '@ngrx/entity'; // v17.0.0
import { Subscription, SubscriptionStatus } from '../../../shared/models/subscription.model';
import { IAnalyticsMetric, MetricType } from '../../../shared/models/analytics.model';
import { INotification, NotificationStatus } from '../../../shared/models/notification.model';
import { User, UserRole } from '../../../shared/models/user.model';

/**
 * Interface for subscription state slice
 */
export interface SubscriptionState extends EntityState<Subscription> {
  selectedSubscriptionId: string | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  filters: {
    status: SubscriptionStatus[];
    searchTerm: string;
    sortBy: string;
    sortDirection: 'asc' | 'desc';
  };
}

/**
 * Interface for analytics state slice
 */
export interface AnalyticsState extends EntityState<IAnalyticsMetric> {
  selectedMetricType: MetricType | null;
  dateRange: {
    start: Date;
    end: Date;
  };
  loading: boolean;
  error: string | null;
  aggregates: {
    totalCost: number;
    averageUtilization: number;
    activeSubscriptions: number;
  };
}

/**
 * Interface for notification state slice
 */
export interface NotificationState extends EntityState<INotification> {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  filters: {
    status: NotificationStatus[];
    priority: string[];
  };
}

/**
 * Interface for authentication state slice
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  lastActivity: Date | null;
  sessionExpiry: Date | null;
  permissions: {
    roles: UserRole[];
    features: string[];
  };
}

/**
 * Root state interface for the entire application
 */
export interface AppState {
  readonly subscriptions: SubscriptionState;
  readonly analytics: AnalyticsState;
  readonly notifications: NotificationState;
  readonly auth: AuthState;
}

/**
 * Initial state for subscriptions slice
 */
const initialSubscriptionState: SubscriptionState = {
  ids: [],
  entities: {},
  selectedSubscriptionId: null,
  loading: false,
  error: null,
  lastSync: null,
  filters: {
    status: [],
    searchTerm: '',
    sortBy: 'name',
    sortDirection: 'asc'
  }
};

/**
 * Initial state for analytics slice
 */
const initialAnalyticsState: AnalyticsState = {
  ids: [],
  entities: {},
  selectedMetricType: null,
  dateRange: {
    start: new Date(),
    end: new Date()
  },
  loading: false,
  error: null,
  aggregates: {
    totalCost: 0,
    averageUtilization: 0,
    activeSubscriptions: 0
  }
};

/**
 * Initial state for notifications slice
 */
const initialNotificationState: NotificationState = {
  ids: [],
  entities: {},
  unreadCount: 0,
  loading: false,
  error: null,
  lastUpdate: null,
  filters: {
    status: [NotificationStatus.UNREAD],
    priority: []
  }
};

/**
 * Initial state for authentication slice
 */
const initialAuthState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  lastActivity: null,
  sessionExpiry: null,
  permissions: {
    roles: [],
    features: []
  }
};

/**
 * Initial root state for the entire application
 */
export const initialState: AppState = {
  subscriptions: initialSubscriptionState,
  analytics: initialAnalyticsState,
  notifications: initialNotificationState,
  auth: initialAuthState
};