// External imports
import { Injectable } from '@angular/core'; // @angular/core v17.x
import { Actions, createEffect, ofType } from '@ngrx/effects'; // @ngrx/effects v17.x
import { Observable, of, timer, Subject } from 'rxjs'; // rxjs v7.x
import { 
  catchError, 
  map, 
  mergeMap, 
  switchMap, 
  debounceTime, 
  retry, 
  takeUntil, 
  tap 
} from 'rxjs/operators'; // rxjs/operators v7.x

// Internal imports
import { 
  requestAIInsight, 
  loadAIInsights, 
  loadAIInsightsSuccess, 
  loadAIInsightsFailure, 
  dismissAIInsight,
  realTimeInsightUpdate,
  InsightType
} from '../actions/ai.actions';
import { AiService, IAIInsightRequest, AIErrorType } from '../../services/ai.service';

@Injectable()
export class AIEffects {
  private readonly destroy$ = new Subject<void>();
  private readonly DEBOUNCE_TIME = 300;
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly actions$: Actions,
    private readonly aiService: AiService
  ) {}

  /**
   * Effect to handle loading AI insights with caching and error handling
   */
  loadAIInsights$ = createEffect(() => 
    this.actions$.pipe(
      ofType(loadAIInsights),
      debounceTime(this.DEBOUNCE_TIME),
      mergeMap(action => {
        const request: IAIInsightRequest = {
          type: action.type || InsightType.COST_OPTIMIZATION,
          subscriptionId: action.subscriptionId,
          timeframe: action.endDate ? 
            Math.ceil((action.endDate.getTime() - action.startDate?.getTime() || 0) / (1000 * 60 * 60 * 24)) : 
            30,
          filters: {
            startDate: action.startDate,
            endDate: action.endDate,
            limit: action.limit,
            offset: action.offset
          }
        };

        return this.aiService.getInsights(request).pipe(
          retry(this.MAX_RETRIES),
          map(insights => loadAIInsightsSuccess({
            insights,
            timestamp: new Date(),
            total: insights.length
          })),
          catchError(error => of(loadAIInsightsFailure({
            error: {
              code: error.type || AIErrorType.API,
              message: error.message || 'Failed to load AI insights',
              details: error
            }
          })))
        );
      }),
      takeUntil(this.destroy$)
    )
  );

  /**
   * Effect to handle requesting new AI insights with real-time updates
   */
  requestAIInsight$ = createEffect(() =>
    this.actions$.pipe(
      ofType(requestAIInsight),
      switchMap(action => {
        const request: IAIInsightRequest = {
          type: action.type,
          subscriptionId: action.context || 'global',
          timeframe: 30,
          forceRefresh: true,
          options: {
            confidence: 0.8,
            maxRecommendations: 5,
            includeMetadata: true
          }
        };

        // Setup WebSocket connection for real-time updates
        const wsSubscription = this.aiService.connectWebSocket().pipe(
          tap(wsUpdate => {
            if (wsUpdate.type === action.type) {
              this.actions$.dispatch(realTimeInsightUpdate({
                insight: wsUpdate,
                source: 'websocket',
                timestamp: new Date()
              }));
            }
          })
        );

        return this.aiService.generateRecommendations(
          request.subscriptionId,
          request.options
        ).pipe(
          map(insight => loadAIInsightsSuccess({
            insights: [insight],
            timestamp: new Date(),
            total: 1
          })),
          catchError(error => of(loadAIInsightsFailure({
            error: {
              code: error.type || AIErrorType.API,
              message: error.message || 'Failed to generate AI insight',
              details: error
            }
          }))),
          takeUntil(wsSubscription)
        );
      }),
      takeUntil(this.destroy$)
    )
  );

  /**
   * Effect to handle dismissing AI insights with state synchronization
   */
  dismissAIInsight$ = createEffect(() =>
    this.actions$.pipe(
      ofType(dismissAIInsight),
      mergeMap(action => {
        // Optimistic update
        const currentInsights = this.aiService.insights$.getValue();
        const updatedInsights = currentInsights.filter(
          insight => insight.id !== action.insightId
        );

        return this.aiService.getInsights({
          type: 'DISMISSED',
          subscriptionId: action.insightId,
          timeframe: 1,
          filters: {
            reason: action.reason
          }
        }).pipe(
          map(() => loadAIInsightsSuccess({
            insights: updatedInsights,
            timestamp: action.timestamp,
            total: updatedInsights.length
          })),
          catchError(error => {
            // Rollback on failure
            return of(loadAIInsightsFailure({
              error: {
                code: error.type || AIErrorType.API,
                message: 'Failed to dismiss insight',
                details: error
              }
            }));
          })
        );
      }),
      takeUntil(this.destroy$)
    )
  );

  /**
   * Cleanup subscriptions on destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}