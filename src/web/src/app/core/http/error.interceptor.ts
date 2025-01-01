import { Injectable } from '@angular/core'; // @angular/core ^17.0.0
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse 
} from '@angular/common/http'; // @angular/common/http ^17.0.0
import { Router } from '@angular/router'; // @angular/router ^17.0.0
import { 
  Observable, 
  throwError, 
  of, 
  Subject, 
  BehaviorSubject 
} from 'rxjs'; // rxjs ^7.8.0
import { 
  catchError, 
  switchMap, 
  retry, 
  retryWhen, 
  delay, 
  tap, 
  finalize 
} from 'rxjs/operators'; // rxjs/operators ^7.8.0

import { NotificationService } from '../services/notification.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private readonly maxRetries = 3;
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<void>(null);
  private retryAttemptsMap = new Map<string, number>();
  private readonly noRetryEndpoints = new Set(['/auth/logout', '/auth/refresh']);

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      retry({
        count: this.shouldRetry(request.url) ? this.maxRetries : 0,
        delay: (error, retryCount) => {
          if (error instanceof HttpErrorResponse) {
            if (error.status === 401) {
              return of(error);
            }
            // Exponential backoff
            return of(error).pipe(delay(Math.pow(2, retryCount) * 1000));
          }
          return throwError(() => error);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, request);
      }),
      finalize(() => {
        // Clean up retry attempts after request completion
        if (this.retryAttemptsMap.has(request.url)) {
          this.retryAttemptsMap.delete(request.url);
        }
      })
    );
  }

  private handleError(error: HttpErrorResponse, request: HttpRequest<any>): Observable<never> {
    // Track retry attempts
    const currentAttempts = this.retryAttemptsMap.get(request.url) || 0;
    this.retryAttemptsMap.set(request.url, currentAttempts + 1);

    switch (error.status) {
      case 401:
        return this.handle401Error(request, error);
      
      case 403:
        this.notificationService.showError('Access Denied', 'You do not have permission to perform this action');
        this.router.navigate(['/dashboard']);
        break;
      
      case 404:
        this.notificationService.showWarning('Resource Not Found', 'The requested resource could not be found');
        break;
      
      case 408:
      case 504:
        if (currentAttempts < this.maxRetries) {
          return throwError(() => error);
        }
        this.notificationService.showError('Request Timeout', 'The server is taking too long to respond');
        break;
      
      case 409:
        this.notificationService.showWarning('Conflict', 'The request conflicts with current state');
        break;
      
      case 429:
        const retryAfter = error.headers.get('Retry-After');
        this.notificationService.showWarning('Rate Limited', `Too many requests. Please try again in ${retryAfter || 'a few'} seconds`);
        break;
      
      case 500:
      case 501:
      case 502:
      case 503:
        this.notificationService.showError(
          'Server Error',
          'An unexpected error occurred. Our team has been notified.'
        );
        // Log server errors for monitoring
        console.error('Server Error:', {
          url: request.url,
          method: request.method,
          status: error.status,
          message: error.message,
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        if (!navigator.onLine) {
          this.notificationService.showWarning('No Internet', 'Please check your internet connection');
        } else {
          this.notificationService.showError(
            'Error',
            'An unexpected error occurred. Please try again later.'
          );
        }
    }

    return throwError(() => error);
  }

  private handle401Error(request: HttpRequest<any>, error: HttpErrorResponse): Observable<HttpEvent<any>> {
    if (!this.shouldRetry(request.url)) {
      return throwError(() => error);
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(null);
          return this.retryRequest(request, error);
        }),
        catchError(refreshError => {
          this.isRefreshing = false;
          this.authService.logout().subscribe();
          return throwError(() => refreshError);
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      switchMap(() => this.retryRequest(request, error))
    );
  }

  private retryRequest(request: HttpRequest<any>, error: HttpErrorResponse): Observable<HttpEvent<any>> {
    const retryAttempts = this.retryAttemptsMap.get(request.url) || 0;
    
    if (retryAttempts >= this.maxRetries) {
      this.notificationService.showError(
        'Authentication Failed',
        'Unable to authenticate your request. Please log in again.'
      );
      this.authService.logout().subscribe();
      return throwError(() => error);
    }

    return this.authService.isAuthenticated$.pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          return throwError(() => new Error('Not authenticated'));
        }
        return of(request);
      })
    );
  }

  private shouldRetry(url: string): boolean {
    return !this.noRetryEndpoints.has(url) && 
           !url.includes('/auth/') && 
           this.retryAttemptsMap.get(url) < this.maxRetries;
  }
}