/**
 * Enumeration of all possible WebSocket event types in the system.
 * These events represent the different types of real-time updates that can occur.
 */
export enum SocketEventType {
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  USAGE_ALERT = 'usage.alert',
  AI_INSIGHT = 'ai.insight',
  USER_ACTION = 'user.action'
}

/**
 * Base interface for all WebSocket events.
 * Provides the common structure that all events must follow.
 */
export interface SocketEvent {
  /** The type of event being transmitted */
  type: SocketEventType;
  /** The event-specific payload data */
  payload: any;
  /** Timestamp when the event was generated */
  timestamp: Date;
  /** API version for backward compatibility */
  version: string;
}

/**
 * Interface for subscription update event payloads.
 * Used when subscription details are modified or updated.
 */
export interface SubscriptionUpdateEvent {
  /** Unique identifier of the subscription */
  subscriptionId: string;
  /** Type of action performed (e.g., 'created', 'updated', 'deleted') */
  action: string;
  /** Map of changed fields and their new values */
  changes: Record<string, any>;
  /** Previous state of the subscription before changes */
  previousState: Record<string, any>;
}

/**
 * Interface for usage alert event payloads.
 * Used to notify about usage thresholds and anomalies.
 */
export interface UsageAlertEvent {
  /** Unique identifier of the subscription */
  subscriptionId: string;
  /** Type of alert (e.g., 'threshold_exceeded', 'unusual_activity') */
  alertType: string;
  /** Threshold value that triggered the alert */
  threshold: number;
  /** Current value that exceeded the threshold */
  currentValue: number;
  /** Historical trend data for context */
  trend: Record<string, number>;
}

/**
 * Interface for AI insight event payloads.
 * Used to deliver AI-generated recommendations and insights.
 */
export interface AIInsightEvent {
  /** Unique identifier for the insight */
  insightId: string;
  /** Category of insight (e.g., 'cost_optimization', 'security_risk') */
  type: string;
  /** AI-generated recommendation text */
  recommendation: string;
  /** Potential impact of implementing the recommendation */
  impact: Record<string, any>;
  /** Confidence score of the AI recommendation (0-1) */
  confidence: number;
}

/**
 * Interface for user action event payloads.
 * Used to track and broadcast user interactions with the system.
 */
export interface UserActionEvent {
  /** Unique identifier of the user */
  userId: string;
  /** Type of action performed */
  action: string;
  /** Resource affected by the action */
  resource: string;
  /** Additional context about the action */
  metadata: Record<string, any>;
  /** Current user session identifier */
  sessionId: string;
}