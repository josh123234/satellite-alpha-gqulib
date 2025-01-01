import { Injectable } from '@angular/core'; // v17.0.0
import { Actions, createEffect, ofType } from '@ngrx/effects'; // v17.0.0
import { Observable, of, timer } from 'rxjs'; // v7.8.1
import { 
  catchError, 
  map, 
  switchMap, 
  withLatestFrom, 
  retry, 
  shareReplay, 
  debounceTime 
} from 'rxjs/operators'; // v7.8.1

import { 
  loadAnalytics,
  loadAnalyticsSuccess,
  loadAnalyticsFailure,
  setSelectedMetricType,
  setDateRange,
  updateMetric,
  loadAggregatedMetrics,
  loadUsageTrends,
  loadDepartmentCosts
} from '../actions/analytics.actions';
import { AnalyticsService } from '../../services/analytics.service';

@Injectable()
export class AnalyticsEffects {
  private readonly CACHE_DURATION = 300000; // 5 minutes
  private readonly MAX_RETRIES = 3;
  private readonly DEBOUNCE_TIME = 500; // 500ms for real-time updates

  constructor(
    private readonly actions$: Actions,
    private readonly analyticsService: AnalyticsService
  ) {}

  loadAnalytics$ = createEffect(() => 
    this.actions$.pipe(
      ofType(loadAnalytics),
      debounceTime(this.DEBOUNCE_TIME),
      switchMap(action => 
        this.analyticsService.getMetricsBySubscription(
          action.filters?.subscriptionId,
          action.filters?.metricType
        ).pipe(
          retry({
            count: this.MAX_RETRIES,
            delay: (error, retryCount) => 
              timer(Math.pow(2, retryCount) * 1000) // Exponential backoff
          }),
          shareReplay({ 
            bufferSize: 1, 
            refCount: true, 
            windowTime: this.CACHE_DURATION 
          }),
          map(metrics => loadAnalyticsSuccess({ metrics })),
          catchError(error => {
            console.error('Error loading analytics:', error);
            return of(loadAnalyticsFailure({ 
              error: {
                message: error.message,
                code: error.status,
                timestamp: new Date().toISOString()
              }
            }));
          })
        )
      )
    )
  );

  loadAggregatedMetrics$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadAggregatedMetrics),
      switchMap(action => 
        this.analyticsService.getAggregatedMetrics(
          action.subscriptionId,
          action.metricType,
          action.startDate,
          action.endDate
        ).pipe(
          retry({
            count: this.MAX_RETRIES,
            delay: (error, retryCount) => 
              timer(Math.pow(2, retryCount) * 1000)
          }),
          shareReplay({
            bufferSize: 1,
            refCount: true,
            windowTime: this.CACHE_DURATION
          }),
          map(aggregatedData => ({
            type: '[Analytics] Load Aggregated Metrics Success',
            payload: aggregatedData
          })),
          catchError(error => of({
            type: '[Analytics] Load Aggregated Metrics Failure',
            payload: {
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }))
        )
      )
    )
  );

  loadUsageTrends$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadUsageTrends),
      switchMap(action => 
        this.analyticsService.getUsageTrends(
          action.subscriptionId,
          action.metricType,
          action.timeframe
        ).pipe(
          retry({
            count: this.MAX_RETRIES,
            delay: (error, retryCount) => 
              timer(Math.pow(2, retryCount) * 1000)
          }),
          map(trends => ({
            type: '[Analytics] Load Usage Trends Success',
            payload: trends
          })),
          catchError(error => of({
            type: '[Analytics] Load Usage Trends Failure',
            payload: {
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }))
        )
      )
    )
  );

  loadDepartmentCosts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadDepartmentCosts),
      switchMap(action => 
        this.analyticsService.getCostAnalytics(
          action.startDate,
          action.endDate,
          action.departmentId
        ).pipe(
          retry({
            count: this.MAX_RETRIES,
            delay: (error, retryCount) => 
              timer(Math.pow(2, retryCount) * 1000)
          }),
          shareReplay({
            bufferSize: 1,
            refCount: true,
            windowTime: this.CACHE_DURATION
          }),
          map(costData => ({
            type: '[Analytics] Load Department Costs Success',
            payload: costData
          })),
          catchError(error => of({
            type: '[Analytics] Load Department Costs Failure',
            payload: {
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }))
        )
      )
    )
  );

  updateMetricEffect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateMetric),
      switchMap(action => 
        this.analyticsService.createMetric(action.metric).pipe(
          map(updatedMetric => ({
            type: '[Analytics] Update Metric Success',
            payload: updatedMetric
          })),
          catchError(error => of({
            type: '[Analytics] Update Metric Failure',
            payload: {
              error: error.message,
              metric: action.metric,
              timestamp: new Date().toISOString()
            }
          }))
        )
      )
    )
  );
}