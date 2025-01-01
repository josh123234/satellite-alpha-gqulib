import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy 
} from '@angular/core';
import { Store } from '@ngrx/store'; // v17.0.0
import { 
  Subject, 
  takeUntil, 
  BehaviorSubject, 
  catchError, 
  retry 
} from 'rxjs'; // v7.x

import { AIService, IAIInsightResponse, AIErrorType } from '../../core/services/ai.service';
import { WebSocketService, ConnectionState } from '../../../../core/services/websocket.service';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface.component';
import { InsightCardComponent } from './components/insight-card/insight-card.component';

/**
 * Enhanced AI Assistant component that provides intelligent insights,
 * recommendations, and interactive chat capabilities with improved
 * real-time communication and error handling.
 * @version 1.0.0
 */
@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AIAssistantComponent implements OnInit, OnDestroy {
  // Observables for component state management
  public readonly insights$ = new BehaviorSubject<IAIInsightResponse[]>([]);
  public readonly isLoading$ = new BehaviorSubject<boolean>(false);
  public readonly connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
  public readonly errorState$ = new BehaviorSubject<{
    type: string;
    message: string;
    timestamp: Date;
  } | null>(null);

  // Queue for handling messages during connection interruptions
  private readonly messageQueue: Array<{
    type: string;
    payload: any;
    timestamp: Date;
  }> = [];

  // Subject for managing component lifecycle
  private readonly destroy$ = new Subject<void>();

  // Configuration constants
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(
    private aiService: AIService,
    private store: Store,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.initializeWebSocket();
    this.setupInsightsSubscription();
    this.setupErrorHandling();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Initializes WebSocket connection with error handling and reconnection logic
   */
  private initializeWebSocket(): void {
    this.wsService.connect();

    this.wsService.getConnectionState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.connectionState$.next(state);
        if (state === ConnectionState.CONNECTED) {
          this.processMessageQueue();
        }
      });
  }

  /**
   * Sets up subscription to AI insights with error handling and caching
   */
  private setupInsightsSubscription(): void {
    this.aiService.insights$
      .pipe(
        takeUntil(this.destroy$),
        retry({
          count: this.RETRY_ATTEMPTS,
          delay: this.RETRY_DELAY
        }),
        catchError(error => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe(insights => {
        this.insights$.next(insights);
        this.isLoading$.next(false);
      });
  }

  /**
   * Handles user actions on insights with optimistic updates
   * @param insight The insight being acted upon
   */
  public handleInsightAction(insight: IAIInsightResponse): void {
    if (!insight) return;

    this.isLoading$.next(true);

    // Optimistic update
    const currentInsights = this.insights$.value;
    const updatedInsights = currentInsights.filter(i => i.id !== insight.id);
    this.insights$.next(updatedInsights);

    // Generate new recommendations
    this.aiService.generateRecommendations(insight.id, {
      confidence: 0.8,
      timeframe: 30
    })
    .pipe(
      retry({
        count: this.RETRY_ATTEMPTS,
        delay: this.RETRY_DELAY
      }),
      catchError(error => {
        this.handleError(error);
        // Rollback optimistic update
        this.insights$.next(currentInsights);
        return [];
      })
    )
    .subscribe(newInsight => {
      if (newInsight) {
        this.insights$.next([...updatedInsights, newInsight]);
      }
      this.isLoading$.next(false);
    });
  }

  /**
   * Handles WebSocket connection errors with automatic recovery
   * @param error The error that occurred
   */
  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);
    
    this.errorState$.next({
      type: 'CONNECTION_ERROR',
      message: 'Connection lost. Attempting to reconnect...',
      timestamp: new Date()
    });

    // Implement exponential backoff for reconnection
    let retryAttempt = 0;
    const maxRetries = this.RETRY_ATTEMPTS;
    const baseDelay = this.RETRY_DELAY;

    const attemptReconnection = () => {
      if (retryAttempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, retryAttempt), 10000);
        retryAttempt++;
        
        setTimeout(() => {
          this.wsService.connect();
        }, delay);
      } else {
        this.errorState$.next({
          type: 'FATAL_ERROR',
          message: 'Unable to establish connection. Please refresh the page.',
          timestamp: new Date()
        });
      }
    };

    attemptReconnection();
  }

  /**
   * Processes queued messages after reconnection
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.wsService.send({
          type: message.type,
          payload: message.payload,
          timestamp: new Date(),
          version: '1.0'
        });
      }
    }
  }

  /**
   * Handles errors with appropriate user feedback
   * @param error The error to handle
   */
  private handleError(error: any): void {
    console.error('AI Assistant error:', error);

    let errorMessage = 'An unexpected error occurred';
    let errorType = 'UNKNOWN_ERROR';

    if (error?.type === AIErrorType.VALIDATION) {
      errorType = 'VALIDATION_ERROR';
      errorMessage = 'Invalid input provided';
    } else if (error?.type === AIErrorType.API) {
      errorType = 'API_ERROR';
      errorMessage = 'Unable to process request';
    } else if (error?.type === AIErrorType.RATE_LIMIT) {
      errorType = 'RATE_LIMIT_ERROR';
      errorMessage = 'Too many requests. Please try again later';
    }

    this.errorState$.next({
      type: errorType,
      message: errorMessage,
      timestamp: new Date()
    });

    this.isLoading$.next(false);
  }

  /**
   * Performs cleanup on component destruction
   */
  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
    this.messageQueue.length = 0;
    this.insights$.complete();
    this.isLoading$.complete();
    this.connectionState$.complete();
    this.errorState$.complete();
  }
}