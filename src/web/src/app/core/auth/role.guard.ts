import { Injectable } from '@angular/core'; // ^17.0.0
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router'; // ^17.0.0
import { Observable, of } from 'rxjs'; // ^7.8.0
import { map, take, timeout, catchError } from 'rxjs/operators'; // ^7.8.0

import { AuthService } from './auth.service';
import { User, UserRole } from '../../shared/models/user.model';

/**
 * Enhanced route guard implementing role-based access control (RBAC)
 * with comprehensive security features including timeout handling,
 * audit logging, and detailed error tracking.
 */
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  // Timeout for role verification in milliseconds
  private readonly ROLE_CHECK_TIMEOUT = 5000;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Verifies if the current user has the required roles to access the requested route
   * Implements comprehensive role checking with timeout and error handling
   * 
   * @param route - Contains the route configuration and data
   * @param state - Current router state
   * @returns Observable<boolean> indicating if access is granted
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Extract required roles from route data
    const requiredRoles = route.data['roles'] as UserRole[];

    // Validate required roles configuration
    if (!requiredRoles || !Array.isArray(requiredRoles) || requiredRoles.length === 0) {
      console.error('RoleGuard: No required roles specified for route', state.url);
      this.router.navigate(['/unauthorized']);
      return of(false);
    }

    // Verify each role is valid
    const invalidRoles = requiredRoles.filter(role => !Object.values(UserRole).includes(role));
    if (invalidRoles.length > 0) {
      console.error('RoleGuard: Invalid roles specified:', invalidRoles);
      this.router.navigate(['/unauthorized']);
      return of(false);
    }

    return this.authService.currentUser$.pipe(
      take(1),
      timeout(this.ROLE_CHECK_TIMEOUT),
      map((user: User | null) => {
        // Handle case where no user is authenticated
        if (!user) {
          console.warn('RoleGuard: No authenticated user found');
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: state.url }
          });
          return false;
        }

        // Log access attempt for audit trail
        this.logAccessAttempt(user, requiredRoles, state.url);

        // Check if user has any of the required roles
        const hasRequiredRole = requiredRoles.some(role => 
          user.roles.includes(role) || 
          // Admin role has access to everything
          user.roles.includes(UserRole.ADMIN)
        );

        if (!hasRequiredRole) {
          console.warn('RoleGuard: User lacks required roles', {
            userId: user.id,
            userRoles: user.roles,
            requiredRoles,
            url: state.url
          });
          this.router.navigate(['/unauthorized']);
        }

        return hasRequiredRole;
      }),
      catchError(error => {
        // Handle timeout and other errors
        console.error('RoleGuard: Error during role verification', {
          error,
          url: state.url,
          timestamp: new Date().toISOString()
        });
        
        // Navigate to error page for timeout, otherwise to login
        if (error.name === 'TimeoutError') {
          this.router.navigate(['/error'], {
            queryParams: { 
              code: 'TIMEOUT',
              message: 'Role verification timed out'
            }
          });
        } else {
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: state.url }
          });
        }
        
        return of(false);
      })
    );
  }

  /**
   * Logs access attempts for security audit trail
   * 
   * @param user - Current user attempting access
   * @param requiredRoles - Roles required for access
   * @param url - Requested URL
   */
  private logAccessAttempt(user: User, requiredRoles: UserRole[], url: string): void {
    const hasAccess = requiredRoles.some(role => 
      user.roles.includes(role) || 
      user.roles.includes(UserRole.ADMIN)
    );

    const accessAttempt = {
      userId: user.id,
      userRoles: user.roles,
      requiredRoles,
      url,
      granted: hasAccess,
      timestamp: new Date().toISOString()
    };

    // Log access attempt through auth service
    this.authService.logAccessAttempt(
      'route:access',
      url,
      hasAccess
    );

    // Additional console logging for development/debugging
    if (!hasAccess) {
      console.warn('RoleGuard: Access denied', accessAttempt);
    }
  }
}