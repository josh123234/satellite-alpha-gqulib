import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core';
import { Subject, BehaviorSubject, takeUntil, interval } from 'rxjs';
import { ChartType, ChartConfiguration } from 'chart.js';

import { 
  ICostAnalytics, 
  IDepartmentCost, 
  ITopExpense, 
  ICostReduction 
} from '../../../../shared/models/analytics.model';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { formatCurrency, formatPercentage } from '../../../../shared/utils/number.utils';

@Component({
  selector: 'app-cost-analysis',
  templateUrl: './cost-analysis.component.html',
  styleUrls: ['./cost-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CostAnalysisComponent implements OnInit, OnDestroy {
  // Public properties for template binding
  costData: ICostAnalytics | null = null;
  reductionProgress: ICostReduction | null = null;
  selectedTimeRange: string = '12m';
  hasError: boolean = false;
  errorMessage: string = '';
  isLoading$ = new BehaviorSubject<boolean>(false);

  // Chart configurations
  departmentChartConfig: ChartConfiguration = {
    type: 'doughnut',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: { usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              return `${context.label}: ${formatCurrency(value)}`;
            }
          }
        }
      }
    }
  };

  trendChartConfig: ChartConfiguration = {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => formatCurrency(value)
          }
        }
      },
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context: any) => {
              return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  };

  private readonly destroy$ = new Subject<void>();
  private readonly refreshInterval = 300000; // 5 minutes

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupDataRefresh();
    this.loadCostAnalytics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTimeRangeChange(range: string): void {
    this.selectedTimeRange = range;
    this.loadCostAnalytics();
  }

  private setupDataRefresh(): void {
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadCostAnalytics());
  }

  private loadCostAnalytics(): void {
    this.isLoading$.next(true);
    this.hasError = false;

    const endDate = new Date();
    const startDate = this.calculateStartDate();

    this.analyticsService.getCostAnalytics(startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.costData = data;
          this.updateCharts();
          this.isLoading$.next(false);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError(error);
          this.isLoading$.next(false);
          this.cdr.markForCheck();
        }
      });
  }

  private calculateStartDate(): Date {
    const date = new Date();
    switch (this.selectedTimeRange) {
      case '1m':
        date.setMonth(date.getMonth() - 1);
        break;
      case '3m':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6m':
        date.setMonth(date.getMonth() - 6);
        break;
      case '12m':
      default:
        date.setFullYear(date.getFullYear() - 1);
    }
    return date;
  }

  private updateCharts(): void {
    if (!this.costData) return;

    this.updateDepartmentChart();
    this.updateTrendChart();
  }

  private updateDepartmentChart(): void {
    if (!this.costData?.departmentBreakdown) return;

    const { labels, data, colors } = this.processDepartmentData();
    
    this.departmentChartConfig.data = {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 1
      }]
    };
  }

  private updateTrendChart(): void {
    if (!this.costData?.monthlyTrend) return;

    const labels = this.costData.monthlyTrend.map(item => 
      new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    );

    this.trendChartConfig.data = {
      labels,
      datasets: [{
        label: 'Monthly Cost',
        data: this.costData.monthlyTrend.map(item => item.cost),
        borderColor: '#2563EB',
        backgroundColor: '#2563EB33',
        fill: true,
        tension: 0.4
      }]
    };
  }

  private processDepartmentData() {
    const departments = this.costData!.departmentBreakdown;
    return {
      labels: departments.map(d => d.name),
      data: departments.map(d => d.cost),
      colors: [
        '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE',
        '#60A5FA', '#3B82F6', '#2563EB'
      ].slice(0, departments.length)
    };
  }

  private handleError(error: any): void {
    this.hasError = true;
    this.errorMessage = error.message || 'An error occurred while loading cost analytics';
    this.costData = null;
    console.error('Cost Analysis Error:', error);
  }
}