import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core';
import { 
  Subscription, 
  BehaviorSubject, 
  debounceTime, 
  distinctUntilChanged 
} from 'rxjs';

import { 
  INotification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus 
} from '../../../../shared/models/notification.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-recent-activity',
  templateUrl: './recent-activity.component.html',
  styleUrls: ['./recent-activity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentActivityComponent implements OnInit, OnDestroy {
  // Public properties for template binding
  activities: INotification[] = [];
  maxActivities = 5;
  isLoading$ = new BehaviorSubject<boolean>(true);
  hasError$ = new BehaviorSubject<boolean>(false);
  isConnectionActive = false;

  // Enum references for template usage
  readonly NotificationType = NotificationType;
  readonly NotificationPriority = NotificationPriority;
  readonly NotificationStatus = NotificationStatus;

  // Private subscriptions
  private notificationSubscription: Subscription;
  private readonly DEBOUNCE_TIME = 300;

  constructor(
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Monitor WebSocket connection status
    this.notificationService.connectionStatus$.pipe(
      distinctUntilChanged()
    ).subscribe(
      isConnected => {
        this.isConnectionActive = isConnected;
        this.cdr.markForCheck();
      }
    );

    // Subscribe to notifications with debounce for performance
    this.notificationSubscription = this.notificationService.notifications$
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        distinctUntilChanged((prev, curr) => 
          JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe({
        next: (notifications) => {
          this.handleNotificationsUpdate(notifications);
        },
        error: (error) => {
          console.error('Error receiving notifications:', error);
          this.hasError$.next(true);
          this.isLoading$.next(false);
          this.cdr.markForCheck();
        }
      });

    // Initialize accessibility features
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    this.isLoading$.complete();
    this.hasError$.complete();
  }

  /**
   * Formats activity date with timezone consideration
   * @param date Date to format
   * @returns Formatted date string
   */
  formatActivityDate(date: Date): string {
    return formatDate(date, 'MMM dd, yyyy HH:mm');
  }

  /**
   * Gets appropriate icon class based on notification type and priority
   * @param type Notification type
   * @param priority Notification priority
   * @returns Icon class name with accessibility attributes
   */
  getActivityIcon(type: NotificationType, priority: NotificationPriority): string {
    const baseClass = 'activity-icon';
    let iconClass = '';

    switch (type) {
      case NotificationType.SUBSCRIPTION_RENEWAL:
        iconClass = 'calendar';
        break;
      case NotificationType.USAGE_THRESHOLD:
        iconClass = 'chart-line';
        break;
      case NotificationType.AI_INSIGHT:
        iconClass = 'lightbulb';
        break;
      case NotificationType.COST_ANOMALY:
        iconClass = 'exclamation-triangle';
        break;
      case NotificationType.SECURITY_ALERT:
        iconClass = 'shield-exclamation';
        break;
      default:
        iconClass = 'info-circle';
    }

    // Add priority-based styling
    const priorityClass = priority === NotificationPriority.URGENT || 
                         priority === NotificationPriority.CRITICAL 
                         ? 'urgent' 
                         : priority.toLowerCase();

    return `${baseClass} ${iconClass} ${priorityClass}`;
  }

  /**
   * Marks a notification as read with optimistic UI update
   * @param notificationId ID of the notification to mark as read
   */
  async markActivityRead(notificationId: string): Promise<void> {
    try {
      // Optimistic update
      const updatedActivities = this.activities.map(activity => 
        activity.id === notificationId
          ? { ...activity, status: NotificationStatus.READ }
          : activity
      );

      this.activities = updatedActivities;
      this.cdr.markForCheck();

      // Persist change
      await this.notificationService.markAsRead([notificationId]).toPromise();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update on error
      this.hasError$.next(true);
      this.cdr.markForCheck();
    }
  }

  /**
   * Handles updates to the notifications list
   * @param notifications Updated list of notifications
   */
  private handleNotificationsUpdate(notifications: INotification[]): void {
    this.activities = notifications
      // Sort by priority and date
      .sort((a, b) => {
        const priorityOrder = Object.values(NotificationPriority);
        const priorityDiff = priorityOrder.indexOf(b.priority) - 
                           priorityOrder.indexOf(a.priority);
        return priorityDiff !== 0 
          ? priorityDiff 
          : b.createdAt.getTime() - a.createdAt.getTime();
      })
      // Limit to maximum number of activities
      .slice(0, this.maxActivities);

    this.isLoading$.next(false);
    this.hasError$.next(false);
    this.cdr.markForCheck();
  }

  /**
   * Sets up accessibility features for the component
   */
  private setupAccessibility(): void {
    // Set up live region for screen readers
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.classList.add('sr-only');
    document.body.appendChild(liveRegion);

    // Clean up on component destroy
    this.notificationSubscription.add(() => {
      document.body.removeChild(liveRegion);
    });
  }
}