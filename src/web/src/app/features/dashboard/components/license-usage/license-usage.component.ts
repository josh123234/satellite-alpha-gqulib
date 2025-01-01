import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectorRef 
} from '@angular/core'; // v17.x

import { 
  Subject, 
  takeUntil, 
  catchError, 
  retry 
} from 'rxjs'; // v7.x

import { Subscription } from '../../../../shared/models/subscription.model';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { MetricType } from '../../../../shared/models/analytics.model';
import { formatCurrency, formatPercentage } from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-license-usage',
  templateUrl: './license-usage.component.html',
  styleUrls: ['./license-usage.component.scss']
})
export class LicenseUsageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly pollInterval = 300000; // 5 minutes

  // Component state
  public subscriptions: Subscription[] = [];
  public isLoading = false;
  public error: Error | null = null;

  // Chart configuration
  public chartData: any;
  public chartType = 'doughnut';
  public chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const label = context.label;
            return `${label}: ${formatPercentage(value / 100)}`;
          }
        }
      }
    },
    cutout: '70%',
    animation: {
      animateScale: true,
      animateRotate: true
    }
  };

  // Analytics metrics
  public totalLicenses = 0;
  public usedLicenses = 0;
  public utilizationRate = 0;
  public potentialSavings = 0;

  constructor(
    private subscriptionService: SubscriptionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.setupRealTimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSubscriptions(): void {
    this.isLoading = true;

    this.subscriptionService.getSubscriptions()
      .pipe(
        retry(3),
        catchError(error => {
          this.error = error;
          this.isLoading = false;
          throw error;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(subscriptions => {
        this.subscriptions = subscriptions;
        this.updateMetrics();
        this.updateChartData();
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  private setupRealTimeUpdates(): void {
    this.subscriptionService.subscriptions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(subscriptions => {
        this.subscriptions = subscriptions;
        this.updateMetrics();
        this.updateChartData();
        this.cdr.markForCheck();
      });
  }

  private updateMetrics(): void {
    this.totalLicenses = this.subscriptions.reduce((sum, sub) => sum + sub.totalLicenses, 0);
    this.usedLicenses = this.subscriptions.reduce((sum, sub) => sum + sub.usedLicenses, 0);
    this.utilizationRate = this.totalLicenses > 0 ? 
      (this.usedLicenses / this.totalLicenses) * 100 : 0;

    this.calculatePotentialSavings();
  }

  private calculatePotentialSavings(): void {
    const unusedLicenses = this.totalLicenses - this.usedLicenses;
    this.potentialSavings = this.subscriptions.reduce((total, sub) => {
      const subUnusedLicenses = sub.totalLicenses - sub.usedLicenses;
      const costPerLicense = sub.cost / sub.totalLicenses;
      return total + (subUnusedLicenses * costPerLicense);
    }, 0);
  }

  private updateChartData(): void {
    const unusedLicenses = this.totalLicenses - this.usedLicenses;
    
    this.chartData = {
      labels: ['Used Licenses', 'Unused Licenses'],
      datasets: [{
        data: [this.usedLicenses, unusedLicenses],
        backgroundColor: ['#2563EB', '#E5E7EB'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  }

  public getUtilizationClass(): string {
    if (this.utilizationRate >= 90) return 'text-green-600';
    if (this.utilizationRate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  public formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  public formatPercentage(value: number): string {
    return formatPercentage(value / 100);
  }

  public refreshData(): void {
    this.initializeSubscriptions();
  }

  public trackBySubscriptionId(index: number, subscription: Subscription): string {
    return subscription.id;
  }
}