import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ElementRef 
} from '@angular/core'; // @angular/core ^17.0.0
import { 
  animate, 
  state, 
  style, 
  transition, 
  trigger, 
  AnimationEvent 
} from '@angular/animations'; // @angular/animations ^17.0.0

import { 
  INotification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus 
} from '../../models/notification.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('notificationState', [
      state('visible', style({ 
        opacity: 1, 
        transform: 'translateX(0)' 
      })),
      state('hidden', style({ 
        opacity: 0, 
        transform: 'translateX(100%)' 
      })),
      transition('visible => hidden', 
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ),
      transition('hidden => visible', 
        animate('200ms cubic-bezier(0.0, 0.0, 0.2, 1)')
      )
    ])
  ],
  host: {
    'role': 'alert',
    'aria-live': 'polite',
    '[class.notification]': 'true',
    '[attr.data-type]': 'notification?.type',
    '[attr.data-priority]': 'notification?.priority'
  }
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() notification: INotification;
  @Output() dismiss = new EventEmitter<void>();
  @Output() read = new EventEmitter<void>();

  animationState = 'visible';
  isAnimating = false;

  private readonly iconMap = new Map<NotificationType, string>([
    [NotificationType.SUBSCRIPTION_RENEWAL, 'calendar-alert'],
    [NotificationType.USAGE_THRESHOLD, 'chart-line'],
    [NotificationType.AI_INSIGHT, 'lightbulb'],
    [NotificationType.SYSTEM_ALERT, 'alert-circle'],
    [NotificationType.LICENSE_EXPIRY, 'key-alert'],
    [NotificationType.COST_ANOMALY, 'currency-usd-alert'],
    [NotificationType.SECURITY_ALERT, 'shield-alert'],
    [NotificationType.INTEGRATION_STATUS, 'connection']
  ]);

  constructor(
    private notificationService: NotificationService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Set initial ARIA attributes based on notification properties
    this.elementRef.nativeElement.setAttribute(
      'aria-label',
      `${this.notification.priority} priority ${this.notification.type} notification: ${this.notification.title}`
    );
  }

  ngOnDestroy(): void {
    // Cleanup any pending animations
    this.isAnimating = false;
  }

  /**
   * Returns the appropriate icon based on notification type and priority
   */
  getNotificationIcon(): string {
    const baseIcon = this.iconMap.get(this.notification.type) || 'bell';
    return this.notification.priority === NotificationPriority.URGENT ||
           this.notification.priority === NotificationPriority.CRITICAL
           ? `${baseIcon}-urgent`
           : baseIcon;
  }

  /**
   * Returns CSS classes based on notification priority and status
   */
  getNotificationClass(): string {
    const classes = ['notification'];
    
    // Add priority-based class
    classes.push(`notification--${this.notification.priority.toLowerCase()}`);
    
    // Add status-based class
    classes.push(`notification--${this.notification.status.toLowerCase()}`);
    
    // Add type-based class
    classes.push(`notification--${this.notification.type.toLowerCase()}`);
    
    return classes.join(' ');
  }

  /**
   * Handles marking notification as read with error handling
   */
  async onMarkAsRead(): Promise<void> {
    if (this.notification.status === NotificationStatus.READ) {
      return;
    }

    try {
      await this.notificationService
        .markAsRead([this.notification.id])
        .toPromise();
      this.read.emit();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Handles notification dismissal with animation
   */
  async onDismiss(): Promise<void> {
    if (this.isAnimating) {
      return;
    }

    this.isAnimating = true;
    this.animationState = 'hidden';

    try {
      await this.notificationService
        .deleteNotification(this.notification.id)
        .toPromise();
      this.dismiss.emit();
    } catch (error) {
      console.error('Error dismissing notification:', error);
      // Revert animation on error
      this.animationState = 'visible';
    } finally {
      this.isAnimating = false;
    }
  }

  /**
   * Handles animation completion events
   */
  onAnimationDone(event: AnimationEvent): void {
    if (event.toState === 'hidden') {
      this.dismiss.emit();
    }
    this.isAnimating = false;
  }

  /**
   * Returns whether the notification requires immediate attention
   */
  isUrgent(): boolean {
    return this.notification.priority === NotificationPriority.URGENT ||
           this.notification.priority === NotificationPriority.CRITICAL;
  }

  /**
   * Returns whether the notification has associated actions
   */
  hasActions(): boolean {
    return this.notification.metadata?.actionRequired === true;
  }

  /**
   * Returns the formatted timestamp for the notification
   */
  getFormattedTimestamp(): string {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(this.notification.createdAt));
  }
}