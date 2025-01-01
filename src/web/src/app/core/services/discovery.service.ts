import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, catchError, retry, takeUntil, finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { Subscription, SubscriptionStatus } from '../../shared/models/subscription.model';

/**
 * Service responsible for handling SaaS subscription discovery and management operations
 * @version 1.0.0
 */
@Injectable({
  providedIn: 'root'
})
export class DiscoveryService {
  private readonly apiUrl: string;
  private readonly destroy$ = new Subject<void>();
  private readonly loading$ = new BehaviorSubject<boolean>(false);
  private readonly wsUrl: string;
  private readonly defaultHeaders: HttpHeaders;

  /**
   * Creates an instance of DiscoveryService
   * @param http - Angular HttpClient for making HTTP requests
   */
  constructor(private readonly http: HttpClient) {
    this.apiUrl = `${environment.apiUrl}/subscriptions`;
    this.wsUrl = environment.wsUrl;
    this.defaultHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  /**
   * Retrieves a paginated list of discovered subscriptions with optional filtering
   * @param params - Query parameters for pagination and filtering
   * @returns Observable of paginated subscription data
   */
  getSubscriptions(params?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    search?: string;
  }): Observable<{ data: Subscription[]; total: number; page: number }> {
    this.loading$.next(true);

    const httpParams = new HttpParams()
      .set('page', params?.page?.toString() || '1')
      .set('limit', params?.limit?.toString() || '10')
      .set('status', params?.status || '')
      .set('search', params?.search || '');

    return this.http
      .get<{ data: Subscription[]; total: number; page: number }>(
        this.apiUrl,
        {
          headers: this.defaultHeaders,
          params: httpParams
        }
      )
      .pipe(
        retry(3),
        map(response => ({
          data: response.data,
          total: response.total,
          page: response.page
        })),
        catchError(this.handleError),
        takeUntil(this.destroy$),
        finalize(() => this.loading$.next(false))
      );
  }

  /**
   * Initiates automated discovery scan for new SaaS subscriptions
   * @returns Observable of scan progress and discovered subscriptions
   */
  scanForNewSubscriptions(): Observable<{
    status: string;
    progress: number;
    discoveries: Subscription[];
  }> {
    this.loading$.next(true);

    // Initialize WebSocket connection for progress tracking
    const ws = new WebSocket(`${this.wsUrl}/discovery-progress`);
    
    return new Observable(observer => {
      // Start discovery scan
      this.http
        .post<{ scanId: string }>(
          `${this.apiUrl}/scan`,
          {},
          { headers: this.defaultHeaders }
        )
        .pipe(
          takeUntil(this.destroy$),
          catchError(this.handleError)
        )
        .subscribe({
          next: ({ scanId }) => {
            // Handle WebSocket messages for progress updates
            ws.onmessage = (event) => {
              const progress = JSON.parse(event.data);
              if (progress.scanId === scanId) {
                observer.next({
                  status: progress.status,
                  progress: progress.progress,
                  discoveries: progress.discoveries || []
                });

                if (progress.status === 'completed') {
                  ws.close();
                  observer.complete();
                }
              }
            };

            ws.onerror = (error) => {
              observer.error(error);
              ws.close();
            };
          },
          error: (error) => {
            observer.error(error);
            ws.close();
          }
        });

      // Cleanup function
      return () => {
        ws.close();
        this.loading$.next(false);
      };
    });
  }

  /**
   * Gets the current loading state
   * @returns Observable of loading state
   */
  get isLoading(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  /**
   * Cleanup method to be called on service destruction
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles HTTP errors and transforms them into user-friendly format
   * @param error - The HTTP error response
   * @returns Observable error
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    console.error(errorMessage);
    return new Observable(observer => observer.error(errorMessage));
  }
}