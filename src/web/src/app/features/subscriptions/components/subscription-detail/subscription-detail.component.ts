import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core'; // v17.x
import { ActivatedRoute, Router } from '@angular/router'; // v17.x
import { Subject, takeUntil, interval, mergeMap } from 'rxjs'; // v7.x
import { MatDialog } from '@angular/material/dialog'; // v17.x

import { 
  Subscription, 
  SubscriptionStatus, 
  BillingCycle 
} from '../../../../shared/models/subscription.model';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { MetricType, IAnalyticsMetric } from '../../../../shared/models/analytics.model';
import { formatCurrency, formatPercentage } from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-subscription-detail',
  templateUrl: './subscription-detail.component.html',
  styleUrls: ['./subscription-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionDetailComponent implements OnInit, OnDestroy {
  // Public properties
  subscription: Subscription | null = null;
  analyticsData: IAnalyticsMetric[] = [];
  loading = true;
  error: string | null = null;
  readonly refreshInterval = 30000; // 30 seconds
  readonly MetricType = MetricType; // For template usage
  readonly SubscriptionStatus = SubscriptionStatus; // For template usage

  // Chart configurations
  costChartConfig = {
    type: 'line' as const,
    title: 'Cost Trends',
    refreshInterval: this.refreshInterval
  };

  usageChartConfig = {
    type: 'bar' as const,
    title: 'License Usage',
    refreshInterval: this.refreshInterval
  };

  // Private properties
  private readonly destroy$ = new Subject<void>();
  private readonly cache = new Map<string, any>();
  private readonly maxRetries = 3;
  private retryCount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private subscriptionService: SubscriptionService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeSubscriptionData();
    this.setupAnalyticsPolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cache.clear();
  }

  private initializeSubscriptionData(): void {
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (params) => {
        if (params['id']) {
          this.loadSubscriptionWithRetry(params['id']);
        } else {
          this.handleError('Subscription ID not found');
        }
      },
      error: (error) => this.handleError(error)
    });
  }

  private loadSubscriptionWithRetry(id: string): void {
    this.loading = true;
    this.subscriptionService.getSubscriptionById(id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (subscription) => {
        this.subscription = subscription;
        this.loading = false;
        this.retryCount = 0;
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.loadSubscriptionWithRetry(id), 1000 * this.retryCount);
        } else {
          this.handleError('Failed to load subscription details');
        }
      }
    });
  }

  private setupAnalyticsPolling(): void {
    this.route.params.pipe(
      takeUntil(this.destroy$),
      mergeMap(params => 
        interval(this.refreshInterval).pipe(
          mergeMap(() => this.subscriptionService.getSubscriptionAnalytics(params['id']))
        )
      )
    ).subscribe({
      next: (analytics) => {
        this.analyticsData = analytics as IAnalyticsMetric[];
        this.cdr.markForCheck();
      },
      error: (error) => this.handleError('Failed to load analytics data')
    });
  }

  // Public methods for template usage
  updateSubscription(update: Partial<Subscription>): void {
    if (!this.subscription?.id) return;

    this.subscriptionService.updateSubscription(this.subscription.id, update).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updated) => {
        this.subscription = updated;
        this.cdr.markForCheck();
      },
      error: (error) => this.handleError('Failed to update subscription')
    });
  }

  deleteSubscription(): void {
    if (!this.subscription?.id) return;

    const dialogRef = this.dialog.open(/* DeleteConfirmationDialog component */, {
      data: { subscriptionName: this.subscription.name }
    });

    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        this.subscriptionService.deleteSubscription(this.subscription!.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.router.navigate(['/subscriptions']);
          },
          error: (error) => this.handleError('Failed to delete subscription')
        });
      }
    });
  }

  // Utility methods for template usage
  formatCost(cost: number): string {
    return formatCurrency(cost);
  }

  formatUsage(used: number, total: number): string {
    return formatPercentage(used / total);
  }

  getStatusClass(status: SubscriptionStatus): string {
    const statusClasses = {
      [SubscriptionStatus.ACTIVE]: 'status-active',
      [SubscriptionStatus.INACTIVE]: 'status-inactive',
      [SubscriptionStatus.PENDING]: 'status-pending',
      [SubscriptionStatus.CANCELLED]: 'status-cancelled',
      [SubscriptionStatus.RENEWAL_REQUIRED]: 'status-warning'
    };
    return statusClasses[status] || '';
  }

  private handleError(message: string): void {
    this.error = message;
    this.loading = false;
    this.cdr.markForCheck();
    
    // Log error for monitoring
    console.error(`Subscription Detail Error: ${message}`);
  }
}