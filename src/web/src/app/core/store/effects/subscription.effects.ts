/**
 * @fileoverview NgRx effects for subscription management in the SaaS Management Platform
 * @version 1.0.0
 */

// Angular imports - v17.0.0
import { Injectable } from '@angular/core';

// NgRx imports - v17.0.0
import { Actions, createEffect, ofType } from '@ngrx/effects';

// RxJS imports - v7.8.0
import { of, throwError } from 'rxjs';
import { map, mergeMap, catchError, retry, tap, switchMap, concatMap } from 'rxjs/operators';

// Internal imports
import * as SubscriptionActions from '../actions/subscription.actions';
import { SubscriptionService } from '../../services/subscription.service';
import { Subscription } from '../../../shared/models/subscription.model';

@Injectable()
export class SubscriptionEffects {
  private isLoading = false;
  private subscriptionCache = new Map<string, Subscription>();

  /**
   * Effect to handle loading subscriptions with caching and retry logic
   */
  loadSubscriptions$ = createEffect(() => this.actions$.pipe(
    ofType(SubscriptionActions.loadSubscriptions),
    tap(() => this.isLoading = true),
    switchMap(() => this.subscriptionService.getSubscriptions().pipe(
      retry({
        count: 3,
        delay: (error, retryCount) => retryCount * 1000
      }),
      map(subscriptions => {
        // Update cache
        subscriptions.forEach(sub => this.subscriptionCache.set(sub.id, sub));
        return SubscriptionActions.loadSubscriptionsSuccess({ subscriptions });
      }),
      catchError(error => of(SubscriptionActions.loadSubscriptionsFailure({ error }))),
      tap(() => this.isLoading = false)
    ))
  ));

  /**
   * Effect to handle subscription creation with optimistic updates
   */
  createSubscription$ = createEffect(() => this.actions$.pipe(
    ofType(SubscriptionActions.createSubscription),
    concatMap(action => {
      // Optimistic update
      const optimisticId = crypto.randomUUID();
      const optimisticSubscription = {
        ...action.subscription,
        id: optimisticId,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Subscription;
      
      this.subscriptionCache.set(optimisticId, optimisticSubscription);

      return this.subscriptionService.createSubscription(action.subscription).pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => retryCount * 1000
        }),
        map(() => SubscriptionActions.loadSubscriptions()),
        catchError(error => {
          // Revert optimistic update
          this.subscriptionCache.delete(optimisticId);
          return of(SubscriptionActions.loadSubscriptionsFailure({ error }));
        })
      );
    })
  ));

  /**
   * Effect to handle subscription updates with concurrency handling
   */
  updateSubscription$ = createEffect(() => this.actions$.pipe(
    ofType(SubscriptionActions.updateSubscription),
    concatMap(action => {
      // Store previous state for rollback
      const previousState = this.subscriptionCache.get(action.id);
      
      // Optimistic update
      if (previousState) {
        this.subscriptionCache.set(action.id, {
          ...previousState,
          ...action.changes,
          updatedAt: new Date()
        });
      }

      return this.subscriptionService.updateSubscription(action.id, action.changes).pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => retryCount * 1000
        }),
        map(() => SubscriptionActions.loadSubscriptions()),
        catchError(error => {
          // Revert optimistic update
          if (previousState) {
            this.subscriptionCache.set(action.id, previousState);
          }
          return of(SubscriptionActions.loadSubscriptionsFailure({ error }));
        })
      );
    })
  ));

  /**
   * Effect to handle subscription deletion with cleanup
   */
  deleteSubscription$ = createEffect(() => this.actions$.pipe(
    ofType(SubscriptionActions.deleteSubscription),
    concatMap(action => {
      // Store previous state for rollback
      const previousState = this.subscriptionCache.get(action.id);
      
      // Optimistic delete
      this.subscriptionCache.delete(action.id);

      return this.subscriptionService.deleteSubscription(action.id).pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => retryCount * 1000
        }),
        map(() => SubscriptionActions.loadSubscriptions()),
        catchError(error => {
          // Revert optimistic delete
          if (previousState) {
            this.subscriptionCache.set(action.id, previousState);
          }
          return of(SubscriptionActions.loadSubscriptionsFailure({ error }));
        })
      );
    })
  ));

  constructor(
    private actions$: Actions,
    private subscriptionService: SubscriptionService
  ) {}
}