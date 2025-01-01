import { Injectable } from '@angular/core'; // v17.x
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router'; // v17.x
import { Store } from '@ngrx/store'; // v17.x
import { Observable, of, throwError } from 'rxjs'; // v7.x
import { tap, map, take, catchError, timeout } from 'rxjs/operators'; // v7.x

import { AuthService } from './auth.service';
import { selectIsAuthenticated } from '../store/selectors/auth.selectors';

/**
 * Enhanced route guard implementing comprehensive security measures for the SaaS Management Platform.
 * Provides robust authentication checks, session validation, and security event logging.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_ATTEMPTS = 10;
  private attemptCount = 0;
  private windowStart = Date.now();

  constructor(
    private router: Router,
    private store: Store,
    private authService: AuthService
  ) {}

  /**
   * Enhanced route guard with comprehensive security checks
   * @param route - Route being accessed
   * @param state - Router state snapshot
   * @returns Observable resolving to access decision or redirect
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Reset rate limiting window if expired
    if (Date.now() - this.windowStart > this.RATE_LIMIT_WINDOW) {
      this.attemptCount = 0;
      this.windowStart = Date.now();
    }

    // Check rate limiting
    if (this.attemptCount >= this.MAX_ATTEMPTS) {
      console.error('Rate limit exceeded for route guard checks');
      return of(this.router.createUrlTree(['/error'], { 
        queryParams: { 
          code: 'RATE_LIMIT_EXCEEDED',
          returnUrl: state.url 
        }
      }));
    }
    this.attemptCount++;

    return this.store.select(selectIsAuthenticated).pipe(
      take(1),
      timeout(5000), // Timeout for security checks
      map(isAuthenticated => {
        if (!isAuthenticated) {
          // Store attempted URL for post-login redirect
          const sanitizedUrl = this.sanitizeUrl(state.url);
          return this.router.createUrlTree(['/login'], { 
            queryParams: { returnUrl: sanitizedUrl }
          });
        }

        return true;
      }),
      tap(async (result) => {
        // Validate session state
        const sessionValid = await this.authService.validateSession().toPromise();
        if (!sessionValid) {
          throw new Error('Invalid session state');
        }

        // Check role-based access if required
        if (route.data?.['roles']) {
          const hasAccess = await this.authService.checkRoleAccess(route.data['roles']).toPromise();
          if (!hasAccess) {
            throw new Error('Insufficient permissions');
          }
        }

        // Log access attempt
        this.logAccessAttempt(route, state, result === true);
      }),
      catchError(error => {
        console.error('Auth guard error:', error);
        
        // Handle specific error cases
        if (error.message === 'Invalid session state') {
          this.authService.logout().subscribe();
          return of(this.router.createUrlTree(['/login']));
        }
        
        if (error.message === 'Insufficient permissions') {
          return of(this.router.createUrlTree(['/unauthorized']));
        }

        // Default error handling
        return of(this.router.createUrlTree(['/error']));
      })
    );
  }

  /**
   * Enhanced child route guard with security checks
   * @param childRoute - Child route being accessed
   * @param state - Router state snapshot
   * @returns Observable resolving to access decision or redirect
   */
  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.canActivate(childRoute, state);
  }

  /**
   * Sanitizes URL for safe storage and redirection
   * @param url - URL to sanitize
   * @returns Sanitized URL string
   * @private
   */
  private sanitizeUrl(url: string): string {
    // Remove potential harmful characters and limit length
    return url
      .replace(/[^\w\s-/?.=&]/g, '')
      .substring(0, 256);
  }

  /**
   * Logs route access attempts for security auditing
   * @param route - Attempted route
   * @param state - Router state
   * @param granted - Whether access was granted
   * @private
   */
  private logAccessAttempt(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
    granted: boolean
  ): void {
    const timestamp = new Date().toISOString();
    const routeData = {
      path: state.url,
      roles: route.data?.['roles'] || [],
      timestamp,
      granted,
      attemptCount: this.attemptCount
    };

    console.log('Route access attempt:', routeData);
  }
}