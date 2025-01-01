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
  ChartType, 
  ChartConfiguration 
} from 'chart.js'; // v4.x

import { 
  ICostAnalytics, 
  IDepartmentCost, 
  IYoYComparison 
} from '../../../../shared/models/analytics.model';

import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { formatCurrency, formatPercentage, calculatePercentageChange } from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-department-breakdown',
  templateUrl: './department-breakdown.component.html',
  styleUrls: ['./department-breakdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentBreakdownComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly dataRefreshInterval = 300000; // 5 minutes
  private refreshTimer: any;

  // Data properties
  costData: ICostAnalytics | null = null;
  departmentBreakdown: IDepartmentCost[] = [];
  yearOverYearData: IYoYComparison | null = null;
  
  // Chart configuration
  chartType: ChartType = 'bar';
  chartConfig: ChartConfiguration | null = null;
  
  // UI state
  isLoading = false;
  errorMessage: string | null = null;
  
  // Accessibility
  readonly ariaLabels = {
    chart: 'Department cost breakdown chart',
    loading: 'Loading department cost data',
    error: 'Error loading department cost data'
  };

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.setupDataRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  private initializeComponent(): void {
    this.isLoading = true;
    this.loadCostAnalytics();
  }

  private setupDataRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.loadCostAnalytics();
    }, this.dataRefreshInterval);
  }

  private loadCostAnalytics(): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    this.analyticsService.getCostAnalytics(startDate, endDate)
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe({
        next: (data: ICostAnalytics) => {
          this.costData = data;
          this.departmentBreakdown = data.departmentBreakdown;
          this.yearOverYearData = data.yearOverYearChange;
          this.updateChartConfiguration();
          this.isLoading = false;
          this.errorMessage = null;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = 'Failed to load cost analytics data';
          this.isLoading = false;
          console.error('Cost analytics error:', error);
          this.cdr.markForCheck();
        }
      });
  }

  private updateChartConfiguration(): void {
    if (!this.departmentBreakdown?.length) return;

    const labels = this.departmentBreakdown.map(dept => dept.name);
    const costs = this.departmentBreakdown.map(dept => dept.cost);
    const percentages = this.calculatePercentages(costs);

    this.chartConfig = {
      type: this.chartType,
      data: {
        labels,
        datasets: [{
          data: costs,
          backgroundColor: this.generateColors(costs.length),
          borderColor: 'rgba(255, 255, 255, 0.8)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              generateLabels: (chart) => {
                return labels.map((label, i) => ({
                  text: `${label} (${formatPercentage(percentages[i])})`,
                  fillStyle: this.generateColors(costs.length)[i],
                  strokeStyle: 'rgba(255, 255, 255, 0.8)',
                  lineWidth: 1,
                  hidden: false
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const percent = percentages[context.dataIndex];
                return `${labels[context.dataIndex]}: ${formatCurrency(value)} (${formatPercentage(percent)})`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value as number)
            }
          }
        }
      }
    };
  }

  private calculatePercentages(costs: number[]): number[] {
    const total = costs.reduce((sum, cost) => sum + cost, 0);
    return costs.map(cost => cost / total);
  }

  private generateColors(count: number): string[] {
    const baseColors = [
      '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE',
      '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD'
    ];
    return baseColors.slice(0, count);
  }

  // Public methods for template access
  getYoYChangeClass(change: number): string {
    return change >= 0 ? 'positive-change' : 'negative-change';
  }

  formatCurrencyValue(value: number): string {
    return formatCurrency(value);
  }

  formatPercentageValue(value: number): string {
    return formatPercentage(value);
  }
}