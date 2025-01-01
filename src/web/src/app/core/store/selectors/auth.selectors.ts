/**
 * @fileoverview Authentication state selectors for the SaaS Management Platform
 * Implements memoized selectors for accessing auth state with type safety and performance optimization
 * @version 1.0.0
 */

import { createSelector } from '@ngrx/store'; // v17.0.0
import { AppState } from '../state/app.state';
import { User, UserRole } from '../../../shared/models/user.model';

/**
 * Base selector for accessing the auth state slice
 * Provides type-safe access to authentication state
 */
export const selectAuthState = (state: AppState) => state.auth;

/**
 * Memoized selector for retrieving the current authenticated user
 * Returns null if no user is authenticated
 */
export const selectCurrentUser = createSelector(
  selectAuthState,
  (authState) => authState.user
);

/**
 * Memoized selector for retrieving the authentication token
 * Returns null if no token exists
 */
export const selectAuthToken = createSelector(
  selectAuthState,
  (authState) => authState.token
);

/**
 * Memoized selector for checking if user is authenticated
 * Returns boolean indicating authentication status
 */
export const selectIsAuthenticated = createSelector(
  selectAuthToken,
  (token): boolean => !!token
);

/**
 * Memoized selector for retrieving user roles
 * Returns empty array if no user is authenticated
 */
export const selectUserRoles = createSelector(
  selectCurrentUser,
  (user): UserRole[] => user?.roles || []
);

/**
 * Memoized selector for retrieving user permissions
 * Returns empty array if no permissions exist
 */
export const selectUserPermissions = createSelector(
  selectAuthState,
  (authState) => authState.permissions.features || []
);

/**
 * Memoized selector for checking if user has specific role
 * @param role Role to check for
 * Returns boolean indicating if user has the specified role
 */
export const selectHasRole = (role: UserRole) => createSelector(
  selectUserRoles,
  (roles): boolean => roles.includes(role)
);

/**
 * Memoized selector for retrieving authentication loading state
 * Returns boolean indicating if authentication is in progress
 */
export const selectAuthLoading = createSelector(
  selectAuthState,
  (authState) => authState.loading
);

/**
 * Memoized selector for retrieving authentication error state
 * Returns error message or null if no error exists
 */
export const selectAuthError = createSelector(
  selectAuthState,
  (authState) => authState.error
);

/**
 * Memoized selector for retrieving session expiry
 * Returns null if no session exists
 */
export const selectSessionExpiry = createSelector(
  selectAuthState,
  (authState) => authState.sessionExpiry
);

/**
 * Memoized selector for checking if session is expired
 * Returns boolean indicating if current session is expired
 */
export const selectIsSessionExpired = createSelector(
  selectSessionExpiry,
  (expiry): boolean => expiry ? new Date() > new Date(expiry) : false
);

/**
 * Memoized selector for retrieving last activity timestamp
 * Returns null if no activity has been recorded
 */
export const selectLastActivity = createSelector(
  selectAuthState,
  (authState) => authState.lastActivity
);

/**
 * Memoized selector for checking if user is admin
 * Returns boolean indicating if user has admin role
 */
export const selectIsAdmin = createSelector(
  selectUserRoles,
  (roles): boolean => roles.includes(UserRole.ADMIN)
);

/**
 * Memoized selector for retrieving user's full name
 * Returns empty string if no user is authenticated
 */
export const selectUserFullName = createSelector(
  selectCurrentUser,
  (user): string => user ? `${user.firstName} ${user.lastName}` : ''
);