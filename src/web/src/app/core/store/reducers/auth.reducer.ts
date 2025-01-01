import { createReducer, on } from '@ngrx/store'; // ^17.0.0
import { User } from '../../../shared/models/user.model';
import { AuthState } from '../state/app.state';
import * as AuthActions from '../actions/auth.actions';

/**
 * Interface for enhanced authentication error tracking
 */
interface AuthError {
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Initial authentication state with strict security defaults
 */
const initialState: AuthState = {
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
 * Enhanced authentication reducer with comprehensive security features
 */
export const authReducer = createReducer(
  initialState,

  // Handle login initiation
  on(AuthActions.login, (state): AuthState => ({
    ...state,
    loading: true,
    error: null
  })),

  // Handle successful login with security validations
  on(AuthActions.loginSuccess, (state, { user, token, timestamp }): AuthState => {
    // Validate user object and token
    if (!user?.id || !token?.accessToken) {
      return {
        ...state,
        loading: false,
        error: {
          code: 'AUTH_001',
          message: 'Invalid authentication response',
          timestamp: new Date(timestamp)
        }
      };
    }

    return {
      ...state,
      user,
      token: token.accessToken,
      loading: false,
      error: null,
      lastActivity: new Date(timestamp),
      sessionExpiry: new Date(timestamp + token.expiresIn * 1000),
      permissions: {
        roles: user.roles || [],
        features: [] // Initialize empty features array
      }
    };
  }),

  // Handle login failures with detailed error tracking
  on(AuthActions.loginFailure, (state, { error }): AuthState => ({
    ...state,
    loading: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date(error.timestamp),
      details: { attempts: error.attempts }
    },
    user: null,
    token: null
  })),

  // Handle logout with secure state clearing
  on(AuthActions.logout, (state, { reason, timestamp }): AuthState => ({
    ...initialState,
    error: reason === 'SESSION_TIMEOUT' ? {
      code: 'AUTH_002',
      message: 'Session timeout',
      timestamp: new Date(timestamp)
    } : null
  })),

  // Handle successful logout
  on(AuthActions.logoutSuccess, (): AuthState => ({
    ...initialState
  })),

  // Handle session timeout warning
  on(AuthActions.sessionTimeoutWarning, (state, { remainingTime, timestamp }): AuthState => ({
    ...state,
    sessionExpiry: new Date(timestamp + remainingTime)
  })),

  // Update session timeout
  on(AuthActions.updateSessionTimeout, (state, { timeout, timestamp }): AuthState => ({
    ...state,
    sessionExpiry: new Date(timestamp + timeout)
  })),

  // Handle successful token refresh
  on(AuthActions.refreshTokenSuccess, (state, { token, timestamp }): AuthState => ({
    ...state,
    token: token.accessToken,
    lastActivity: new Date(timestamp),
    sessionExpiry: new Date(timestamp + token.expiresIn * 1000),
    error: null
  })),

  // Handle token refresh failure
  on(AuthActions.refreshTokenFailure, (state, { error }): AuthState => ({
    ...state,
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date(error.timestamp)
    },
    token: null
  })),

  // Clear authentication errors
  on(AuthActions.clearAuthErrors, (state): AuthState => ({
    ...state,
    error: null
  }))
);

export default authReducer;