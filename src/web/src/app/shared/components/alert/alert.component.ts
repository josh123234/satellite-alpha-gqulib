import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core'; // v17.0.0
import { 
  animate, 
  trigger, 
  state, 
  transition, 
  style 
} from '@angular/animations'; // v17.0.0
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NotificationType, NotificationPriority } from '../../../shared/models/notification.model';
import { truncateString } from '../../utils/string.utils';

// Alert animation configuration
const alertAnimations = trigger('alertState', [
  state('visible', style({
    opacity: 1,
    transform: 'translateY(0)'
  })),
  state('hidden', style({
    opacity: 0,
    transform: 'translateY(-100%)'
  })),
  transition('void => visible', [
    style({ opacity: 0, transform: 'translateY(-100%)' }),
    animate('200ms ease-out')
  ]),
  transition('visible => hidden', [
    animate('200ms ease-in')
  ])
]);

@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
  animations: [alertAnimations],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertComponent implements OnInit, OnDestroy {
  // Input properties with default values
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() type: NotificationType = NotificationType.SYSTEM_ALERT;
  @Input() priority: NotificationPriority = NotificationPriority.MEDIUM;
  @Input() dismissible: boolean = true;
  @Input() actionLabel: string = '';
  @Input() timeout: number = 0; // 0 means no auto-dismiss
  @Input() isAccessible: boolean = true;
  @Input() ariaLabel: string = '';

  // Output events
  @Output() dismissed = new EventEmitter<void>();
  @Output() action = new EventEmitter<any>();

  // Component state
  animationState: 'visible' | 'hidden' = 'visible';
  private destroy$ = new Subject<void>();
  private dismissTimer: any;
  private lastActionTime: number = 0;
  private readonly ACTION_THROTTLE = 1000; // 1 second throttle for actions

  // Alert icon mapping
  private readonly iconMap = {
    [NotificationType.SUBSCRIPTION_RENEWAL]: 'calendar',
    [NotificationType.USAGE_THRESHOLD]: 'chart-line',
    [NotificationType.AI_INSIGHT]: 'brain',
    [NotificationType.SYSTEM_ALERT]: 'info-circle',
    [NotificationType.LICENSE_EXPIRY]: 'key',
    [NotificationType.COST_ANOMALY]: 'dollar-sign',
    [NotificationType.SECURITY_ALERT]: 'shield-exclamation',
    [NotificationType.INTEGRATION_STATUS]: 'plug'
  };

  constructor() {
    // Initialize with default accessibility attributes if not provided
    if (!this.ariaLabel) {
      this.ariaLabel = 'Alert notification';
    }
  }

  ngOnInit(): void {
    this.setupAlert();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Handles the dismissal of the alert
   */
  dismiss(): void {
    if (this.animationState === 'hidden') {
      return; // Prevent multiple dismissals
    }

    this.animationState = 'hidden';
    this.clearDismissTimer();
    this.dismissed.emit();
  }

  /**
   * Handles action button clicks with throttling
   * @param event - The click event
   */
  handleAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - this.lastActionTime < this.ACTION_THROTTLE) {
      return; // Throttle rapid clicks
    }
    this.lastActionTime = now;

    this.action.emit({
      type: this.type,
      priority: this.priority,
      timestamp: now
    });

    if (this.dismissible) {
      this.dismiss();
    }
  }

  /**
   * Gets the appropriate icon for the alert type
   */
  getAlertIcon(): string {
    return this.iconMap[this.type] || 'info-circle';
  }

  /**
   * Gets the alert message with proper truncation
   */
  getFormattedMessage(): string {
    return truncateString(this.message, 200);
  }

  /**
   * Gets the appropriate CSS classes based on alert type and priority
   */
  getAlertClasses(): { [key: string]: boolean } {
    return {
      'alert': true,
      [`alert--${this.type.toLowerCase()}`]: true,
      [`alert--${this.priority.toLowerCase()}`]: true,
      'alert--dismissible': this.dismissible,
      'alert--with-action': !!this.actionLabel
    };
  }

  /**
   * Sets up the alert including auto-dismiss timer and accessibility
   * @private
   */
  private setupAlert(): void {
    // Set up auto-dismiss timer if configured
    if (this.timeout > 0) {
      this.dismissTimer = setTimeout(() => {
        this.dismiss();
      }, this.timeout);
    }

    // Set up accessibility attributes
    if (this.isAccessible) {
      this.setupAccessibility();
    }
  }

  /**
   * Configures accessibility attributes for the alert
   * @private
   */
  private setupAccessibility(): void {
    const roleMap = {
      [NotificationType.SECURITY_ALERT]: 'alert',
      [NotificationType.ERROR]: 'alert',
      [NotificationType.SYSTEM_ALERT]: 'status',
      [NotificationType.AI_INSIGHT]: 'status'
    };

    this.ariaLabel = this.ariaLabel || `${this.type} alert: ${this.title}`;
    const role = roleMap[this.type] || 'status';
    
    // These will be bound in the template
    this.accessibilityAttrs = {
      role,
      'aria-live': this.priority === NotificationPriority.URGENT ? 'assertive' : 'polite',
      'aria-atomic': 'true',
      'aria-label': this.ariaLabel
    };
  }

  /**
   * Cleans up component resources
   * @private
   */
  private cleanup(): void {
    this.clearDismissTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Clears the auto-dismiss timer
   * @private
   */
  private clearDismissTimer(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}