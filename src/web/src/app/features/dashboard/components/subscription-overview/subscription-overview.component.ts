import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core'; // v17.x

import { 
  Subject, 
  takeUntil, 
  debounceTime, 
  distinctUntilChanged 
} from 'rxjs'; // v7.x

import { 
  Subscription, 
  SubscriptionStatus 
} from '../../../../shared/models/subscription.model';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { MetricType } from '../../../../shared/models/analytics.model';
import { 
  formatCurrency, 
  formatPercentage, 
  calculatePercentageChange 
} from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-subscription-overview',
  templateUrl: './subscription-overview.component.html',
  styleUrls: ['./subscription-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionOverviewComponent implements OnInit, OnDestroy {
  // Subscription data
  subscriptions: Subscription[] = [];
  totalSpend: number = 0;
  historicalSpend: number = 0;
  spendReduction: number = 0;
  activeSubscriptions: number = 0;
  licenseUtilization: number = 0;
  utilizationTrend: number[] = [];

  // Chart data
  spendChartData: any[] = [];
  licenseChartData: any[] = [];
  MetricType = MetricType;

  // Component state
  isLoading: boolean = true;
  refreshInterval: number = 300000; // 5 minutes
  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();

  constructor(
    private subscriptionService: SubscriptionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupRefreshMechanism();
    this.initializeSubscriptionUpdates();
    this.loadSubscriptionData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupRefreshMechanism(): void {
    // Setup debounced refresh mechanism
    this.refresh$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadSubscriptionData();
    });

    // Set up periodic refresh
    setInterval(() => {
      this.refresh$.next();
    }, this.refreshInterval);
  }

  private initializeSubscriptionUpdates(): void {
    // Subscribe to real-time subscription updates
    this.subscriptionService.subscriptions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(updatedSubscriptions => {
        this.subscriptions = updatedSubscriptions;
        this.calculateMetrics();
        this.updateChartData();
        this.cdr.markForCheck();
      });
  }

  private async loadSubscriptionData(): Promise<void> {
    try {
      this.isLoading = true;
      this.cdr.markForCheck();

      // Load current subscriptions
      await this.subscriptionService.getSubscriptions().toPromise();

      // Load subscription analytics for historical comparison
      const analytics = await this.subscriptionService
        .getSubscriptionAnalytics('all', this.refreshInterval)
        .toPromise();

      if (analytics) {
        this.historicalSpend = analytics.historicalCost || 0;
        this.utilizationTrend = analytics.utilizationTrend || [];
      }

      this.calculateMetrics();
      this.updateChartData();
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private calculateMetrics(): void {
    // Calculate total current spend
    this.totalSpend = this.subscriptions.reduce(
      (total, sub) => total + (sub.cost || 0), 
      0
    );

    // Calculate spend reduction percentage
    if (this.historicalSpend > 0) {
      this.spendReduction = calculatePercentageChange(
        this.historicalSpend, 
        this.totalSpend
      );
    }

    // Calculate active subscriptions
    this.activeSubscriptions = this.subscriptions.filter(
      sub => sub.status === SubscriptionStatus.ACTIVE
    ).length;

    // Calculate license utilization
    const totalLicenses = this.subscriptions.reduce(
      (total, sub) => total + (sub.totalLicenses || 0), 
      0
    );
    const usedLicenses = this.subscriptions.reduce(
      (total, sub) => total + (sub.usedLicenses || 0), 
      0
    );
    this.licenseUtilization = totalLicenses > 0 ? 
      usedLicenses / totalLicenses : 
      0;
  }

  private updateChartData(): void {
    // Update spend chart data
    this.spendChartData = this.subscriptions.map(sub => ({
      name: sub.name,
      value: sub.cost,
      type: MetricType.COST
    }));

    // Update license utilization chart data
    this.licenseChartData = this.subscriptions
      .filter(sub => sub.totalLicenses > 0)
      .map(sub => ({
        name: sub.name,
        value: sub.usedLicenses / sub.totalLicenses,
        type: MetricType.LICENSE_USAGE
      }));
  }

  // Public helper methods for template
  formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return formatPercentage(value);
  }

  getSpendTrend(): string {
    if (this.spendReduction < 0) {
      return 'trending_down';
    } else if (this.spendReduction > 0) {
      return 'trending_up';
    }
    return 'trending_flat';
  }

  getSpendTrendColor(): string {
    if (this.spendReduction < 0) {
      return 'text-success';
    } else if (this.spendReduction > 0) {
      return 'text-danger';
    }
    return 'text-warning';
  }

  getLicenseUtilizationStatus(): string {
    if (this.licenseUtilization >= 0.9) {
      return 'warning';
    } else if (this.licenseUtilization <= 0.5) {
      return 'danger';
    }
    return 'success';
  }
}