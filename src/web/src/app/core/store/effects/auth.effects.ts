import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of, timer } from 'rxjs';
import { catchError, map, switchMap, tap, timeout, retryWhen, delay } from 'rxjs/operators';

import { AuthService } from '../../auth/auth.service';
import {
  login,
  loginSuccess,
  loginFailure,
  logout,
  logoutSuccess,
  checkAuth,
  refreshToken,
  refreshTokenSuccess,
  refreshTokenFailure,
  sessionTimeoutWarning,
  updateSessionTimeout,
  clearAuthErrors
} from '../actions/auth.actions';

/**
 * Implements secure NgRx effects for handling authentication-related side effects
 * in the SaaS Management Platform. Manages authentication flow, token handling,
 * user session state, and security audit logging.
 */
@Injectable()
export class AuthEffects {
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff delays

  /**
   * Effect that handles secure login process with rate limiting and error handling
   */
  login$ = createEffect(() => 
    this.actions$.pipe(
      ofType(login),
      switchMap(action => {
        const timestamp = Date.now();
        
        return this.authService.login(action.credentials).pipe(
          timeout(10000), // 10 second timeout
          map(response => loginSuccess({
            user: response.user,
            token: response.token,
            timestamp
          })),
          catchError(error => {
            console.error('Login error:', error);
            return of(loginFailure({
              error: {
                code: error.code || 'AUTH_ERROR',
                message: error.message || 'Authentication failed',
                timestamp,
                attempts: error.attempts
              }
            }));
          }),
          retryWhen(errors => 
            errors.pipe(
              delay(attempt => {
                if (attempt >= this.MAX_LOGIN_ATTEMPTS) {
                  throw new Error('Maximum login attempts exceeded');
                }
                return this.RETRY_DELAYS[attempt] || 5000;
              })
            )
          )
        );
      })
    )
  );

  /**
   * Effect that handles secure logout process with cleanup
   */
  logout$ = createEffect(() => 
    this.actions$.pipe(
      ofType(logout),
      switchMap(action => {
        const timestamp = Date.now();
        
        return this.authService.logout().pipe(
          map(() => logoutSuccess({ timestamp })),
          tap(() => {
            // Clear sensitive data from storage
            localStorage.removeItem('auth_state');
            sessionStorage.clear();
            
            // Log security audit event
            console.log('Security audit: Logout completed', {
              reason: action.reason,
              timestamp
            });
          }),
          catchError(error => {
            console.error('Logout error:', error);
            // Force logout on error to ensure security
            return of(logoutSuccess({ timestamp }));
          })
        );
      })
    )
  );

  /**
   * Effect that validates authentication state and handles token refresh
   */
  checkAuth$ = createEffect(() => 
    this.actions$.pipe(
      ofType(checkAuth),
      switchMap(action => {
        const timestamp = Date.now();
        const sessionTimeout = action.sessionTimeout || this.SESSION_TIMEOUT_MS;

        return this.authService.checkAuthState().pipe(
          map(authState => {
            if (!authState.isValid) {
              return logout({
                reason: 'SESSION_TIMEOUT',
                timestamp
              });
            }

            // Check if token needs refresh
            const tokenExpiry = authState.token.expiresIn * 1000;
            if (timestamp + this.TOKEN_REFRESH_BUFFER > tokenExpiry) {
              return refreshToken({
                refreshToken: authState.token.refreshToken,
                timestamp
              });
            }

            // Set session timeout warning
            const remainingTime = tokenExpiry - timestamp;
            if (remainingTime < sessionTimeout / 4) {
              this.store.dispatch(sessionTimeoutWarning({
                remainingTime,
                timestamp
              }));
            }

            return loginSuccess({
              user: authState.user,
              token: authState.token,
              timestamp
            });
          }),
          catchError(error => {
            console.error('Auth check error:', error);
            return of(logout({
              reason: 'SECURITY_VIOLATION',
              timestamp
            }));
          })
        );
      })
    )
  );

  /**
   * Effect that handles secure token refresh process
   */
  refreshToken$ = createEffect(() => 
    this.actions$.pipe(
      ofType(refreshToken),
      switchMap(action => {
        const timestamp = Date.now();

        return this.authService.refreshToken().pipe(
          timeout(5000), // 5 second timeout
          map(response => refreshTokenSuccess({
            token: response.token,
            timestamp
          })),
          catchError(error => {
            console.error('Token refresh error:', error);
            return of(refreshTokenFailure({
              error: {
                code: error.code || 'REFRESH_ERROR',
                message: error.message || 'Token refresh failed',
                timestamp
              }
            }));
          })
        );
      })
    )
  );

  /**
   * Effect that handles session timeout updates
   */
  updateTimeout$ = createEffect(() => 
    this.actions$.pipe(
      ofType(updateSessionTimeout),
      tap(action => {
        // Update session timeout in service
        this.authService.updateSessionTimeout(action.timeout);
        
        // Log configuration change
        console.log('Security audit: Session timeout updated', {
          newTimeout: action.timeout,
          timestamp: action.timestamp
        });
      })
    ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private store: Store
  ) {}
}