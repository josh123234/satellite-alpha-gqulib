import { Component, OnInit, OnDestroy, ErrorHandler } from '@angular/core'; // @angular/core ^17.0.0
import { 
  Observable, 
  Subscription, 
  BehaviorSubject, 
  catchError, 
  retry, 
  takeUntil 
} from 'rxjs'; // rxjs ^7.8.0

import { WebSocketService, ConnectionState } from './core/services/websocket.service';
import { NotificationService } from './core/services/notification.service';
import { 
  INotification, 
  NotificationPriority, 
  NotificationStatus 
} from './shared/models/notification.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  // Observables for template binding
  wsStatus$: Observable<ConnectionState>;
  notifications$: Observable<INotification[]>;
  unreadCount$: Observable<number>;

  // Private subjects and subscriptions
  private isDestroyed$ = new BehaviorSubject<boolean>(false);
  private subscriptions = new Subscription();
  private readonly maxRetryAttempts = 5;
  private retryAttempts = 0;

  // Connection state mapping for UI
  readonly ConnectionState = ConnectionState;
  readonly NotificationPriority = NotificationPriority;

  constructor(
    private wsService: WebSocketService,
    private notificationService: NotificationService,
    private errorHandler: ErrorHandler
  ) {
    // Initialize observables
    this.wsStatus$ = this.wsService.getConnectionState();
    this.notifications$ = this.notificationService.notifications$;
    this.unreadCount$ = this.notificationService.unreadCount$;
  }

  ngOnInit(): void {
    // Initialize WebSocket connection with retry logic
    this.initializeWebSocket();

    // Set up notification handling
    this.setupNotificationHandling();

    // Monitor connection status
    this.monitorConnectionStatus();
  }

  ngOnDestroy(): void {
    // Clean up resources
    this.isDestroyed$.next(true);
    this.isDestroyed$.complete();
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  /**
   * Initializes WebSocket connection with retry logic
   */
  private initializeWebSocket(): void {
    try {
      this.wsService.connect();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Sets up notification handling and filtering
   */
  private setupNotificationHandling(): void {
    const notificationSub = this.notifications$
      .pipe(takeUntil(this.isDestroyed$))
      .subscribe({
        next: (notifications) => {
          // Filter and sort notifications by priority
          const prioritizedNotifications = notifications
            .filter(n => n.status !== NotificationStatus.DELETED)
            .sort((a, b) => {
              const priorityOrder = Object.values(NotificationPriority);
              return priorityOrder.indexOf(b.priority) - priorityOrder.indexOf(a.priority);
            });

          // Handle urgent notifications
          const urgentNotifications = prioritizedNotifications
            .filter(n => n.isUrgent() && n.isUnread());
          
          if (urgentNotifications.length > 0) {
            this.handleUrgentNotifications(urgentNotifications);
          }
        },
        error: (error) => this.errorHandler.handleError(error)
      });

    this.subscriptions.add(notificationSub);
  }

  /**
   * Monitors WebSocket connection status
   */
  private monitorConnectionStatus(): void {
    const connectionSub = this.wsStatus$
      .pipe(
        takeUntil(this.isDestroyed$),
        catchError(error => {
          this.handleConnectionError(error);
          throw error;
        })
      )
      .subscribe({
        next: (status) => {
          if (status === ConnectionState.CONNECTED) {
            this.retryAttempts = 0;
          } else if (status === ConnectionState.ERROR) {
            this.handleConnectionError(new Error('WebSocket connection error'));
          }
        },
        error: (error) => this.errorHandler.handleError(error)
      });

    this.subscriptions.add(connectionSub);
  }

  /**
   * Handles WebSocket connection errors with retry logic
   */
  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);

    if (this.retryAttempts < this.maxRetryAttempts) {
      this.retryAttempts++;
      
      // Implement exponential backoff
      const backoffTime = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.retryAttempts}/${this.maxRetryAttempts})...`);
        this.initializeWebSocket();
      }, backoffTime);
    } else {
      this.errorHandler.handleError(new Error('Maximum WebSocket retry attempts reached'));
    }
  }

  /**
   * Handles urgent notifications that require immediate attention
   */
  private handleUrgentNotifications(notifications: INotification[]): void {
    notifications.forEach(notification => {
      // Check if notification requires user action
      if (notification.requiresAction()) {
        // Trigger system notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/assets/icons/urgent-notification.png',
            tag: notification.id
          });
        }
      }
    });
  }
}