import { createAction, props } from '@ngrx/store'; // ^17.0.0
import { User } from '../../../shared/models/user.model';

// Action type prefix for authentication domain
const AUTH_ACTION_PREFIX = '[Auth]';

// Default session timeout in milliseconds (30 minutes)
const AUTH_TIMEOUT_DEFAULT = 30 * 60 * 1000;

/**
 * Login action creator
 * Initiates authentication process with credentials
 */
export const login = createAction(
  `${AUTH_ACTION_PREFIX} Login`,
  props<{
    credentials: {
      email: string;
      password: string;
      rememberMe: boolean;
    };
  }>()
);

/**
 * Login success action creator
 * Dispatched when authentication succeeds with user data and tokens
 */
export const loginSuccess = createAction(
  `${AUTH_ACTION_PREFIX} Login Success`,
  props<{
    user: User;
    token: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    timestamp: number;
  }>()
);

/**
 * Login failure action creator
 * Dispatched when authentication fails with error details
 */
export const loginFailure = createAction(
  `${AUTH_ACTION_PREFIX} Login Failure`,
  props<{
    error: {
      code: string;
      message: string;
      timestamp: number;
      attempts?: number;
    };
  }>()
);

/**
 * Logout action creator
 * Initiates user logout with tracking
 */
export const logout = createAction(
  `${AUTH_ACTION_PREFIX} Logout`,
  props<{
    reason: 'USER_INITIATED' | 'SESSION_TIMEOUT' | 'SECURITY_VIOLATION' | 'SYSTEM_INITIATED';
    timestamp: number;
  }>()
);

/**
 * Logout success action creator
 * Confirms successful logout completion
 */
export const logoutSuccess = createAction(
  `${AUTH_ACTION_PREFIX} Logout Success`,
  props<{
    timestamp: number;
  }>()
);

/**
 * Check authentication status action creator
 * Verifies current authentication state
 */
export const checkAuth = createAction(
  `${AUTH_ACTION_PREFIX} Check Auth`,
  props<{
    sessionTimeout?: number;
    timestamp: number;
  }>()
);

/**
 * Refresh token action creator
 * Initiates token refresh process
 */
export const refreshToken = createAction(
  `${AUTH_ACTION_PREFIX} Refresh Token`,
  props<{
    refreshToken: string;
    timestamp: number;
  }>()
);

/**
 * Refresh token success action creator
 * Handles successful token refresh
 */
export const refreshTokenSuccess = createAction(
  `${AUTH_ACTION_PREFIX} Refresh Token Success`,
  props<{
    token: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    timestamp: number;
  }>()
);

/**
 * Refresh token failure action creator
 * Handles failed token refresh
 */
export const refreshTokenFailure = createAction(
  `${AUTH_ACTION_PREFIX} Refresh Token Failure`,
  props<{
    error: {
      code: string;
      message: string;
      timestamp: number;
    };
  }>()
);

/**
 * Session timeout warning action creator
 * Alerts impending session expiration
 */
export const sessionTimeoutWarning = createAction(
  `${AUTH_ACTION_PREFIX} Session Timeout Warning`,
  props<{
    remainingTime: number;
    timestamp: number;
  }>()
);

/**
 * Update session timeout action creator
 * Modifies session timeout duration
 */
export const updateSessionTimeout = createAction(
  `${AUTH_ACTION_PREFIX} Update Session Timeout`,
  props<{
    timeout: number;
    timestamp: number;
  }>()
);

/**
 * Clear authentication errors action creator
 * Resets error state in authentication store
 */
export const clearAuthErrors = createAction(
  `${AUTH_ACTION_PREFIX} Clear Errors`,
  props<{
    timestamp: number;
  }>()
);