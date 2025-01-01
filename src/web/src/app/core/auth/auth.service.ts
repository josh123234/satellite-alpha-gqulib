import { Injectable } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular'; // ^2.2.0
import { Observable, BehaviorSubject, of, timer } from 'rxjs'; // ^7.8.0
import { map, tap, catchError, switchMap, timeout, finalize } from 'rxjs/operators'; // ^7.8.0
import { Router } from '@angular/router';

import { User, UserRole, UserStatus } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';

/**
 * Enhanced authentication service implementing secure Auth0 integration
 * with advanced security features including MFA, session management,
 * and audit logging.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly currentUser = new BehaviorSubject<User | null>(null);
  private readonly authState = new BehaviorSubject<boolean>(false);
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly TOKEN_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private loginAttempts = 0;
  private sessionTimer: any;
  private tokenRefreshTimer: any;

  public readonly currentUser$ = this.currentUser.asObservable();
  public readonly isAuthenticated$ = this.authState.asObservable();

  constructor(
    private auth0Service: Auth0Service,
    private router: Router
  ) {
    this.initializeAuthState();
    this.setupTokenRefresh();
  }

  /**
   * Initiates secure Auth0 login process with MFA support
   * @param options - Optional login configuration
   * @returns Observable indicating login completion
   */
  public login(options?: any): Observable<void> {
    if (this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      console.error('Maximum login attempts exceeded');
      return of(void 0);
    }

    this.loginAttempts++;

    return new Observable(observer => {
      this.auth0Service.loginWithRedirect({
        ...options,
        appState: { target: window.location.pathname },
        prompt: 'login'
      });

      this.auth0Service.user$
        .pipe(
          timeout(30000),
          switchMap(auth0User => {
            if (!auth0User) {
              throw new Error('Authentication failed');
            }

            const user: User = {
              id: auth0User.sub as any,
              email: auth0User.email!,
              firstName: auth0User.given_name!,
              lastName: auth0User.family_name!,
              roles: (auth0User['https://saas-platform/roles'] || [UserRole.USER]) as UserRole[],
              status: UserStatus.ACTIVE,
              organizationId: auth0User['https://saas-platform/org_id'] as any,
              department: auth0User['https://saas-platform/department'] || '',
              lastLoginAt: new Date(),
              createdAt: new Date(auth0User.created_at!),
              updatedAt: new Date()
            };

            this.currentUser.next(user);
            this.authState.next(true);
            this.loginAttempts = 0;
            this.startSessionTimer();
            
            return of(void 0);
          })
        )
        .subscribe({
          next: () => observer.complete(),
          error: (error) => {
            console.error('Login error:', error);
            observer.error(error);
          }
        });
    });
  }

  /**
   * Securely logs out user and cleans up session
   * @returns Observable indicating logout completion
   */
  public logout(): Observable<void> {
    return new Observable(observer => {
      this.clearSession();
      this.auth0Service.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });
      observer.complete();
    });
  }

  /**
   * Checks if user has required permission for specific resource
   * @param permission - Required permission
   * @param resource - Target resource
   * @returns Observable<boolean> indicating permission status
   */
  public checkPermission(permission: string, resource: string): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => {
        if (!user) return false;

        const hasRole = user.roles.some(role => {
          switch (role) {
            case UserRole.ADMIN:
              return true;
            case UserRole.FINANCE_MANAGER:
              return permission.startsWith('finance:');
            case UserRole.DEPARTMENT_MANAGER:
              return permission.startsWith('department:') && 
                     resource.includes(user.department);
            case UserRole.USER:
              return permission.startsWith('user:');
            default:
              return false;
          }
        });

        this.logAccessAttempt(permission, resource, hasRole);
        return hasRole;
      })
    );
  }

  /**
   * Handles secure token refresh process
   * @returns Observable indicating refresh completion
   */
  public refreshToken(): Observable<void> {
    return new Observable(observer => {
      this.auth0Service.getAccessTokenSilently()
        .pipe(
          timeout(5000),
          catchError(error => {
            console.error('Token refresh failed:', error);
            this.handleAuthError(error);
            return of(null);
          })
        )
        .subscribe({
          next: token => {
            if (token) {
              this.resetSessionTimer();
              observer.complete();
            } else {
              observer.error(new Error('Token refresh failed'));
            }
          },
          error: error => observer.error(error)
        });
    });
  }

  private initializeAuthState(): void {
    this.auth0Service.isAuthenticated$.subscribe(
      isAuthenticated => {
        this.authState.next(isAuthenticated);
        if (!isAuthenticated) {
          this.clearSession();
        }
      }
    );
  }

  private setupTokenRefresh(): void {
    timer(this.TOKEN_REFRESH_INTERVAL, this.TOKEN_REFRESH_INTERVAL)
      .pipe(
        switchMap(() => this.refreshToken())
      )
      .subscribe();
  }

  private startSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    this.sessionTimer = setTimeout(() => {
      this.logout().subscribe();
    }, this.SESSION_TIMEOUT);
  }

  private resetSessionTimer(): void {
    this.startSessionTimer();
  }

  private clearSession(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    this.currentUser.next(null);
    this.authState.next(false);
  }

  private handleAuthError(error: any): void {
    console.error('Authentication error:', error);
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private logAccessAttempt(permission: string, resource: string, granted: boolean): void {
    const user = this.currentUser.getValue();
    console.log('Access attempt:', {
      userId: user?.id,
      email: user?.email,
      permission,
      resource,
      granted,
      timestamp: new Date().toISOString()
    });
  }
}