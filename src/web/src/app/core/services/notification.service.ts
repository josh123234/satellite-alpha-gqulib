import { Injectable } from '@angular/core'; // @angular/core ^17.0.0
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // @angular/common/http ^17.0.0
import { 
  BehaviorSubject, 
  Observable, 
  map, 
  tap, 
  catchError, 
  retry, 
  timer, 
  switchMap, 
  distinctUntilChanged 
} from 'rxjs'; // rxjs ^7.8.0

import { 
  INotification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus, 
  Notification 
} from '../../shared/models/notification.model';
import { WebSocketService } from './websocket.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notifications$ = new BehaviorSubject<INotification[]>([]);
  private readonly unreadCount$ = new BehaviorSubject<number>(0);
  private readonly connectionStatus$ = new BehaviorSubject<NotificationStatus>(NotificationStatus.UNREAD);
  private readonly apiUrl: string;
  private readonly notificationConfig: any;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private readonly cleanupInterval = 1800000; // 30 minutes

  constructor(
    private http: HttpClient,
    private wsService: WebSocketService
  ) {
    this.apiUrl = `${environment.apiUrl}/notifications`;
    this.notificationConfig = environment.notificationConfig;

    // Initialize WebSocket listeners
    this.setupWebSocketListeners();
    
    // Initialize notification cleanup
    this.setupNotificationCleanup();
    
    // Load initial notifications
    this.loadInitialNotifications();
  }

  /**
   * Retrieves notifications with filtering and pagination
   */
  getNotifications(
    filters?: { type?: NotificationType; priority?: NotificationPriority; status?: NotificationStatus },
    pagination?: { page: number; limit: number }
  ): Observable<INotification[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }

    if (pagination) {
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
    }

    return this.http.get<INotification[]>(`${this.apiUrl}?${params.toString()}`).pipe(
      retry({ count: this.maxRetries, delay: this.retryDelay }),
      map(notifications => notifications.map(n => new Notification(n))),
      tap(notifications => {
        this.notifications$.next(notifications);
        this.updateUnreadCount(notifications);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Marks notifications as read with optimistic updates
   */
  markAsRead(notificationIds: string[]): Observable<INotification[]> {
    const previousNotifications = this.notifications$.getValue();
    
    // Optimistic update
    const updatedNotifications = previousNotifications.map(notification => 
      notificationIds.includes(notification.id) 
        ? { ...notification, status: NotificationStatus.READ }
        : notification
    );

    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount(updatedNotifications);

    return this.http.patch<INotification[]>(`${this.apiUrl}/read`, { ids: notificationIds }).pipe(
      retry({ count: this.maxRetries, delay: this.retryDelay }),
      tap(notifications => {
        this.notifications$.next(notifications);
        this.updateUnreadCount(notifications);
      }),
      catchError(error => {
        // Rollback on error
        this.notifications$.next(previousNotifications);
        this.updateUnreadCount(previousNotifications);
        return this.handleError(error);
      })
    );
  }

  /**
   * Handles real-time notifications with priority handling
   */
  private handleRealTimeNotification(notification: INotification): void {
    try {
      const newNotification = new Notification({
        ...notification,
        createdAt: new Date()
      });

      const currentNotifications = this.notifications$.getValue();
      let updatedNotifications = [...currentNotifications, newNotification];

      // Sort by priority and date
      updatedNotifications.sort((a, b) => {
        const priorityOrder = Object.values(NotificationPriority);
        const priorityDiff = priorityOrder.indexOf(b.priority) - priorityOrder.indexOf(a.priority);
        return priorityDiff !== 0 ? priorityDiff : b.createdAt.getTime() - a.createdAt.getTime();
      });

      this.notifications$.next(updatedNotifications);
      this.updateUnreadCount(updatedNotifications);

      // Trigger system notification for urgent priorities
      if (newNotification.isUrgent()) {
        this.showSystemNotification(newNotification);
      }
    } catch (error) {
      console.error('Error handling real-time notification:', error);
    }
  }

  /**
   * Sets up WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    this.wsService.getEvents().pipe(
      distinctUntilChanged((prev, curr) => prev.type === curr.type && prev.payload === curr.payload)
    ).subscribe(event => {
      switch (event.type) {
        case 'usage.alert':
          this.handleRealTimeNotification(new Notification({
            type: NotificationType.USAGE_THRESHOLD,
            priority: NotificationPriority.HIGH,
            title: 'Usage Alert',
            message: event.payload.message,
            metadata: event.payload
          }));
          break;
        case 'ai.insight':
          this.handleRealTimeNotification(new Notification({
            type: NotificationType.AI_INSIGHT,
            priority: NotificationPriority.MEDIUM,
            title: 'AI Insight',
            message: event.payload.recommendation,
            metadata: event.payload
          }));
          break;
        case 'subscription.updated':
          this.handleRealTimeNotification(new Notification({
            type: NotificationType.SUBSCRIPTION_RENEWAL,
            priority: NotificationPriority.MEDIUM,
            title: 'Subscription Update',
            message: event.payload.message,
            metadata: event.payload
          }));
          break;
      }
    });
  }

  /**
   * Updates the unread notification count
   */
  private updateUnreadCount(notifications: INotification[]): void {
    const unreadCount = notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
    this.unreadCount$.next(unreadCount);
  }

  /**
   * Shows system notification for urgent messages
   */
  private showSystemNotification(notification: INotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/icons/notification.png'
      });
    }
  }

  /**
   * Sets up periodic cleanup of expired notifications
   */
  private setupNotificationCleanup(): void {
    timer(0, this.cleanupInterval).subscribe(() => {
      const currentNotifications = this.notifications$.getValue();
      const activeNotifications = currentNotifications.filter(n => !n.isExpired());
      
      if (activeNotifications.length !== currentNotifications.length) {
        this.notifications$.next(activeNotifications);
        this.updateUnreadCount(activeNotifications);
      }
    });
  }

  /**
   * Loads initial notifications with retry logic
   */
  private loadInitialNotifications(): void {
    this.getNotifications(
      { status: NotificationStatus.UNREAD },
      { page: 1, limit: 50 }
    ).subscribe();
  }

  /**
   * Handles HTTP errors with proper logging
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Notification service error:', error);
    throw error;
  }
}