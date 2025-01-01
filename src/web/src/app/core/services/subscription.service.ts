/**
 * @fileoverview Angular service for managing SaaS subscriptions with comprehensive CRUD operations,
 * analytics, and state management.
 * @version 1.0.0
 */

// Angular imports
import { Injectable } from '@angular/core'; // v17.x
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // v17.x

// RxJS imports
import { Observable, BehaviorSubject, throwError, timer, of } from 'rxjs'; // v7.x
import { 
  map, 
  catchError, 
  tap, 
  retry, 
  debounceTime, 
  switchMap, 
  shareReplay 
} from 'rxjs/operators'; // v7.x

// Internal imports
import { 
  Subscription, 
  SubscriptionStatus, 
  BillingCycle, 
  SubscriptionAnalytics 
} from '@app/shared/models/subscription.model';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly apiUrl = `${environment.apiUrl}/subscriptions`;
  private readonly subscriptionsSubject = new BehaviorSubject<Subscription[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<Error | null>(null);
  private readonly analyticsCache = new Map<string, Observable<SubscriptionAnalytics>>();

  // Observable streams
  public readonly subscriptions$ = this.subscriptionsSubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Retrieves all subscriptions with error handling and loading state management
   */
  public getSubscriptions(): Observable<Subscription[]> {
    this.loadingSubject.next(true);

    return this.http.get<Subscription[]>(this.apiUrl).pipe(
      retry(3),
      map(subscriptions => subscriptions.map(this.transformSubscription)),
      tap(subscriptions => this.subscriptionsSubject.next(subscriptions)),
      catchError(this.handleError),
      tap(() => this.loadingSubject.next(false)),
      shareReplay(1)
    );
  }

  /**
   * Retrieves a specific subscription by ID
   */
  public getSubscriptionById(id: string): Observable<Subscription> {
    this.loadingSubject.next(true);

    return this.http.get<Subscription>(`${this.apiUrl}/${id}`).pipe(
      retry(2),
      map(this.transformSubscription),
      catchError(this.handleError),
      tap(() => this.loadingSubject.next(false)),
      shareReplay(1)
    );
  }

  /**
   * Creates a new subscription with optimistic updates
   */
  public createSubscription(subscription: Partial<Subscription>): Observable<Subscription> {
    const optimisticSubscription = this.createOptimisticSubscription(subscription);
    const currentSubscriptions = this.subscriptionsSubject.getValue();

    // Optimistic update
    this.subscriptionsSubject.next([...currentSubscriptions, optimisticSubscription]);

    return this.http.post<Subscription>(this.apiUrl, subscription).pipe(
      map(this.transformSubscription),
      tap(createdSubscription => {
        const updatedSubscriptions = currentSubscriptions.map(sub => 
          sub.id === optimisticSubscription.id ? createdSubscription : sub
        );
        this.subscriptionsSubject.next(updatedSubscriptions);
      }),
      catchError(error => {
        // Rollback optimistic update
        this.subscriptionsSubject.next(currentSubscriptions);
        return this.handleError(error);
      })
    );
  }

  /**
   * Updates an existing subscription with optimistic updates
   */
  public updateSubscription(id: string, update: Partial<Subscription>): Observable<Subscription> {
    const currentSubscriptions = this.subscriptionsSubject.getValue();
    const subscriptionIndex = currentSubscriptions.findIndex(sub => sub.id === id);

    if (subscriptionIndex === -1) {
      return throwError(() => new Error('Subscription not found'));
    }

    // Optimistic update
    const updatedSubscription = { ...currentSubscriptions[subscriptionIndex], ...update };
    const optimisticSubscriptions = [...currentSubscriptions];
    optimisticSubscriptions[subscriptionIndex] = updatedSubscription;
    this.subscriptionsSubject.next(optimisticSubscriptions);

    return this.http.put<Subscription>(`${this.apiUrl}/${id}`, update).pipe(
      map(this.transformSubscription),
      catchError(error => {
        // Rollback optimistic update
        this.subscriptionsSubject.next(currentSubscriptions);
        return this.handleError(error);
      })
    );
  }

  /**
   * Deletes a subscription with optimistic updates
   */
  public deleteSubscription(id: string): Observable<void> {
    const currentSubscriptions = this.subscriptionsSubject.getValue();
    
    // Optimistic delete
    this.subscriptionsSubject.next(currentSubscriptions.filter(sub => sub.id !== id));

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        // Rollback optimistic delete
        this.subscriptionsSubject.next(currentSubscriptions);
        return this.handleError(error);
      })
    );
  }

  /**
   * Retrieves subscription analytics with caching and optional polling
   */
  public getSubscriptionAnalytics(id: string, pollInterval?: number): Observable<SubscriptionAnalytics> {
    const cacheKey = `analytics_${id}`;
    const cached = this.analyticsCache.get(cacheKey);

    if (cached && !pollInterval) {
      return cached;
    }

    const analytics$ = this.http.get<SubscriptionAnalytics>(`${this.apiUrl}/${id}/analytics`).pipe(
      retry(2),
      shareReplay(1)
    );

    if (pollInterval) {
      const polledAnalytics$ = timer(0, pollInterval).pipe(
        debounceTime(300),
        switchMap(() => analytics$),
        shareReplay(1)
      );
      this.analyticsCache.set(cacheKey, polledAnalytics$);
      return polledAnalytics$;
    }

    this.analyticsCache.set(cacheKey, analytics$);
    return analytics$;
  }

  /**
   * Transforms raw subscription data to ensure type safety and data consistency
   */
  private transformSubscription(subscription: any): Subscription {
    return {
      ...subscription,
      renewalDate: new Date(subscription.renewalDate),
      createdAt: new Date(subscription.createdAt),
      updatedAt: new Date(subscription.updatedAt),
      status: subscription.status as SubscriptionStatus,
      billingCycle: subscription.billingCycle as BillingCycle
    };
  }

  /**
   * Creates an optimistic subscription object for immediate UI updates
   */
  private createOptimisticSubscription(partial: Partial<Subscription>): Subscription {
    return {
      id: crypto.randomUUID(),
      organizationId: partial.organizationId!,
      name: partial.name || '',
      description: partial.description || '',
      provider: partial.provider || '',
      cost: partial.cost || 0,
      billingCycle: partial.billingCycle || BillingCycle.MONTHLY,
      renewalDate: partial.renewalDate || new Date(),
      status: partial.status || SubscriptionStatus.PENDING,
      totalLicenses: partial.totalLicenses || 0,
      usedLicenses: partial.usedLicenses || 0,
      metadata: partial.metadata || { tags: [], customFields: {}, integrationData: {} },
      contractDetails: partial.contractDetails || {
        contractId: '',
        terms: '',
        startDate: new Date(),
        endDate: new Date()
      },
      usageMetrics: partial.usageMetrics || {
        lastActive: new Date(),
        utilizationRate: 0,
        activeUsers: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Handles HTTP errors and updates error state
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      errorMessage = `Server error: ${error.status} - ${error.message}`;
    }

    this.errorSubject.next(new Error(errorMessage));
    return throwError(() => new Error(errorMessage));
  }
}