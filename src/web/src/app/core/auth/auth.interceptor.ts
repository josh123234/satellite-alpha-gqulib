import { Injectable } from '@angular/core'; // @angular/core@17.x
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse,
  HttpHeaders
} from '@angular/common/http'; // @angular/common/http@17.x
import { Observable, throwError, of, Subject, BehaviorSubject } from 'rxjs'; // rxjs@7.x
import { 
  catchError, 
  switchMap, 
  take, 
  retryWhen, 
  delay, 
  timeout, 
  finalize,
  tap
} from 'rxjs/operators'; // rxjs@7.x

import { AuthService } from './auth.service';

// Constants for configuration
const SKIP_AUTH_HEADER = 'X-Skip-Auth';
const AUTH_HEADER = 'Authorization';
const MAX_RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30000;
const REFRESH_TIMEOUT_MS = 5000;

/**
 * HTTP interceptor that handles authentication, token refresh, and request security
 * for all HTTP requests in the SaaS Management Platform.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshInProgress$ = new BehaviorSubject<boolean>(false);
  private refreshComplete$ = new Subject<void>();
  private requestQueue: HttpRequest<any>[] = [];

  constructor(private authService: AuthService) {}

  /**
   * Intercepts HTTP requests to add authentication and security headers
   * and handle token refresh flows
   */
  intercept(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Skip authentication for specific requests
    if (request.headers.has(SKIP_AUTH_HEADER)) {
      const headers = request.headers.delete(SKIP_AUTH_HEADER);
      return next.handle(request.clone({ headers }));
    }

    return this.authService.isAuthenticated$.pipe(
      take(1),
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          return next.handle(request);
        }

        return this.handleAuthenticatedRequest(request, next);
      })
    );
  }

  /**
   * Adds authentication token and security headers to request
   */
  private addAuthHeader(
    request: HttpRequest<any>, 
    token: string
  ): HttpRequest<any> {
    // Clone request and add security headers
    return request.clone({
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Request-ID': crypto.randomUUID(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
    });
  }

  /**
   * Handles authenticated requests with token refresh and retry logic
   */
  private handleAuthenticatedRequest(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = this.authService.getAuthToken();
    const authenticatedRequest = this.addAuthHeader(request, token);

    return next.handle(authenticatedRequest).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      retryWhen(errors => 
        errors.pipe(
          tap(error => {
            if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
              throw error;
            }
          }),
          delay(1000),
          take(MAX_RETRY_ATTEMPTS)
        )
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.handle401Error(authenticatedRequest, next);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Handles 401 Unauthorized errors with token refresh
   */
  private handle401Error(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.refreshInProgress$.value) {
      this.refreshInProgress$.next(true);
      this.requestQueue = [];

      return this.authService.refreshToken().pipe(
        timeout(REFRESH_TIMEOUT_MS),
        switchMap(() => {
          this.refreshInProgress$.next(false);
          this.refreshComplete$.next();
          return this.retryQueuedRequests(next);
        }),
        catchError(error => {
          this.refreshInProgress$.next(false);
          this.clearRequestQueue();
          return throwError(() => error);
        })
      );
    }

    return new Observable<HttpEvent<any>>(observer => {
      this.requestQueue.push(request);
      
      const subscription = this.refreshComplete$.pipe(
        take(1),
        switchMap(() => {
          const newRequest = this.addAuthHeader(
            request, 
            this.authService.getAuthToken()
          );
          return next.handle(newRequest);
        })
      ).subscribe({
        next: (event) => observer.next(event),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });

      return () => {
        subscription.unsubscribe();
        this.removeFromQueue(request);
      };
    });
  }

  /**
   * Retries queued requests after successful token refresh
   */
  private retryQueuedRequests(next: HttpHandler): Observable<HttpEvent<any>> {
    const requests = this.requestQueue;
    this.clearRequestQueue();

    return new Observable(observer => {
      requests.forEach(request => {
        const newRequest = this.addAuthHeader(
          request, 
          this.authService.getAuthToken()
        );
        next.handle(newRequest).subscribe({
          next: (event) => observer.next(event),
          error: (error) => observer.error(error)
        });
      });
    });
  }

  /**
   * Removes a request from the queue
   */
  private removeFromQueue(request: HttpRequest<any>): void {
    const index = this.requestQueue.indexOf(request);
    if (index > -1) {
      this.requestQueue.splice(index, 1);
    }
  }

  /**
   * Clears the request queue
   */
  private clearRequestQueue(): void {
    this.requestQueue = [];
  }
}