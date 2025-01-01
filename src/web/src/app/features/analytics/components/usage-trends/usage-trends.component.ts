import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core'; // v17.x

import { 
  Subject, 
  BehaviorSubject, 
  Observable, 
  interval, 
  takeUntil, 
  catchError, 
  retry 
} from 'rxjs'; // v7.x

import { ChartType, ChartOptions } from 'chart.js'; // v4.x

import { 
  IAnalyticsMetric, 
  IUsageTrend, 
  MetricType, 
  IMetricDataPoint 
} from '../../../../shared/models/analytics.model';

import { AnalyticsService } from '../../../../core/services/analytics.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { formatMetricValue } from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-usage-trends',
  templateUrl: './usage-trends.component.html',
  styleUrls: ['./usage-trends.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsageTrendsComponent implements OnInit, OnDestroy {
  @Input() subscriptionId!: string;
  @Input() metricType: MetricType = MetricType.LICENSE_USAGE;

  // Observables and Subjects
  public usageTrend$: Observable<IUsageTrend>;
  private destroy$ = new Subject<void>();
  private loading$ = new BehaviorSubject<boolean>(false);

  // Chart Configuration
  public chartType: ChartType = 'line';
  public chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return formatMetricValue(value, this.getMetricUnit());
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatMetricValue(value, this.getMetricUnit())
        }
      }
    }
  };

  // Component State
  public errorMessage: string = '';
  private readonly refreshInterval = 300000; // 5 minutes
  private readonly retryAttempts = 3;
  private readonly timeframe = 24; // 24 hours of data

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.validateInputs();
    this.initializeUsageTrends();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validateInputs(): void {
    if (!this.subscriptionId) {
      throw new Error('subscriptionId is required for UsageTrendsComponent');
    }
    if (!Object.values(MetricType).includes(this.metricType)) {
      throw new Error(`Invalid metricType: ${this.metricType}`);
    }
  }

  private initializeUsageTrends(): void {
    this.loading$.next(true);
    this.usageTrend$ = this.loadUsageTrends().pipe(
      retry(this.retryAttempts),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    );
  }

  private loadUsageTrends(): Observable<IUsageTrend> {
    return this.analyticsService.getUsageTrends(
      this.subscriptionId,
      this.metricType,
      this.timeframe
    ).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error);
        return [];
      }),
      finalize(() => {
        this.loading$.next(false);
        this.cdr.markForCheck();
      })
    );
  }

  private setupAutoRefresh(): void {
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeUsageTrends();
      });
  }

  private handleError(error: any): void {
    this.errorMessage = error?.message || 'An error occurred while loading usage trends';
    this.loading$.next(false);
    this.cdr.markForCheck();
    console.error('UsageTrends Error:', error);
  }

  private getMetricUnit(): string {
    const units: Record<MetricType, string> = {
      [MetricType.LICENSE_USAGE]: '%',
      [MetricType.API_CALLS]: 'calls',
      [MetricType.STORAGE]: 'GB',
      [MetricType.ACTIVE_USERS]: 'users',
      [MetricType.COST]: 'USD'
    };
    return units[this.metricType] || '';
  }

  public get isLoading(): boolean {
    return this.loading$.value;
  }

  public get chartTitle(): string {
    return `${this.metricType.replace('_', ' ')} Trends`;
  }

  public refreshData(): void {
    this.initializeUsageTrends();
  }

  public getAccessibilityLabel(): string {
    return `Usage trends chart for ${this.metricType.toLowerCase()} metrics`;
  }
}