import { Injectable } from '@angular/core';
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse 
} from '@angular/common/http'; // @angular/common/http@17.x
import { Observable, throwError, of } from 'rxjs'; // rxjs@7.x
import { 
  switchMap, 
  catchError, 
  retry, 
  timeout, 
  finalize 
} from 'rxjs/operators'; // rxjs@7.x

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * HTTP interceptor that handles API request manipulation, authentication,
 * and token refresh for the SaaS Management Platform.
 * 
 * Implements secure request handling with:
 * - API URL prefixing
 * - JWT token injection
 * - Token refresh on 401 errors
 * - Request retry logic
 * - Timeout handling
 * - Error transformation
 */
@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private refreshingUrls = new Set<string>();

  constructor(private authService: AuthService) {}

  /**
   * Intercepts HTTP requests to add API URL prefix, authentication token,
   * and handle token refresh scenarios.
   * 
   * @param request - The outgoing HTTP request
   * @param next - The HTTP handler for request execution
   * @returns Observable of the HTTP event stream
   */
  intercept(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Skip interception for non-API requests
    if (!this.isApiRequest(request)) {
      return next.handle(request);
    }

    // Add API URL prefix and auth token
    let modifiedRequest = this.addApiPrefix(request);
    modifiedRequest = this.addAuthHeader(modifiedRequest);

    return next.handle(modifiedRequest).pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.MAX_RETRY_ATTEMPTS,
        delay: this.getRetryDelay
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !request.url.includes('/auth/refresh')) {
          return this.handleTokenRefresh(request, next);
        }
        return throwError(() => this.transformError(error));
      }),
      finalize(() => {
        // Clean up any refresh tracking for this URL
        this.refreshingUrls.delete(request.url);
      })
    );
  }

  /**
   * Adds the API base URL prefix to the request if not already present.
   * 
   * @param request - The original HTTP request
   * @returns Modified request with API prefix
   */
  private addApiPrefix(request: HttpRequest<any>): HttpRequest<any> {
    if (!request.url.startsWith('http')) {
      return request.clone({
        url: `${environment.apiUrl}${request.url}`
      });
    }
    return request;
  }

  /**
   * Adds the authentication token to request headers.
   * 
   * @param request - The HTTP request to modify
   * @returns Request with added authentication header
   */
  private addAuthHeader(request: HttpRequest<any>): HttpRequest<any> {
    const token = this.authService.getToken();
    if (!token) {
      return request;
    }

    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'X-Request-ID': this.generateRequestId(),
        'X-Client-Version': '1.0.0'
      }
    });
  }

  /**
   * Handles token refresh when a request fails with 401 unauthorized.
   * Implements request queuing to prevent multiple simultaneous refresh attempts.
   * 
   * @param request - The failed HTTP request
   * @param next - The HTTP handler for retry
   * @returns Observable of the retried request
   */
  private handleTokenRefresh(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (this.refreshingUrls.has(request.url)) {
      return of().pipe(
        timeout(5000),
        switchMap(() => this.retryRequestWithNewToken(request, next))
      );
    }

    this.refreshingUrls.add(request.url);

    return this.authService.refreshToken().pipe(
      switchMap(() => this.retryRequestWithNewToken(request, next)),
      catchError(error => {
        this.refreshingUrls.delete(request.url);
        return throwError(() => error);
      })
    );
  }

  /**
   * Retries the original request with a new authentication token.
   * 
   * @param request - The original HTTP request
   * @param next - The HTTP handler
   * @returns Observable of the retried request
   */
  private retryRequestWithNewToken(
    request: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(this.addAuthHeader(request));
  }

  /**
   * Determines if a request is targeting the API and should be intercepted.
   * 
   * @param request - The HTTP request to check
   * @returns Boolean indicating if request is for API
   */
  private isApiRequest(request: HttpRequest<any>): boolean {
    return !request.url.startsWith('assets/') && 
           !request.url.includes('auth0.com');
  }

  /**
   * Generates an exponential backoff delay for request retries.
   * 
   * @param retryCount - The current retry attempt number
   * @returns Delay in milliseconds before next retry
   */
  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  /**
   * Generates a unique request ID for tracking.
   * 
   * @returns Unique request identifier string
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Transforms HTTP errors into standardized error format.
   * 
   * @param error - The HTTP error response
   * @returns Transformed error object
   */
  private transformError(error: HttpErrorResponse): any {
    return {
      code: error.status,
      message: error.error?.message || error.message,
      timestamp: new Date().toISOString(),
      path: error.url,
      requestId: error.headers?.get('X-Request-ID')
    };
  }
}