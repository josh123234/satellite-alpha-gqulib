import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ViewChild, 
  ChangeDetectorRef,
  ChangeDetectionStrategy 
} from '@angular/core'; // v17.x

import { 
  Chart, 
  ChartConfiguration, 
  ChartType, 
  ChartOptions,
  registerables 
} from 'chart.js'; // v4.x

import { 
  Subject, 
  takeUntil, 
  debounceTime, 
  distinctUntilChanged 
} from 'rxjs'; // v7.x

import { IAnalyticsMetric, MetricType } from '../../models/analytics.model';
import { 
  formatMetricValue, 
  formatPercentage, 
  formatCurrency 
} from '../../utils/number.utils';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() data: IAnalyticsMetric[] = [];
  @Input() type: ChartType = 'line';
  @Input() title: string = '';
  @Input() showLegend: boolean = true;
  @Input() locale: string = 'en-US';
  @Input() isInteractive: boolean = true;

  private chart?: Chart;
  private destroy$ = new Subject<void>();
  private dataUpdate$ = new Subject<IAnalyticsMetric[]>();
  private chartOptions: ChartOptions;

  constructor(private cdr: ChangeDetectorRef) {
    this.chartOptions = this.getDefaultChartOptions();
  }

  ngOnInit(): void {
    this.setupDataSubscription();
    this.initializeChart();
    this.setupResizeHandler();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private setupDataSubscription(): void {
    this.dataUpdate$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(250),
        distinctUntilChanged((prev, curr) => 
          JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe(data => {
        this.updateChart(data);
      });
  }

  private initializeChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config = this.formatChartData(this.data);
    this.chart = new Chart(ctx, {
      ...config,
      options: {
        ...this.chartOptions,
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        }
      }
    });

    // Set ARIA attributes for accessibility
    this.chartCanvas.nativeElement.setAttribute('role', 'img');
    this.chartCanvas.nativeElement.setAttribute('aria-label', this.title);
  }

  private setupResizeHandler(): void {
    const resizeObserver = new ResizeObserver(() => {
      if (this.chart) {
        this.chart.resize();
      }
    });

    resizeObserver.observe(this.chartCanvas.nativeElement);
    this.destroy$.subscribe(() => resizeObserver.disconnect());
  }

  private updateChart(newData: IAnalyticsMetric[]): void {
    if (!this.chart) return;

    const config = this.formatChartData(newData);
    this.chart.data = config.data;
    this.chart.update('active');
    this.cdr.markForCheck();
  }

  private formatChartData(data: IAnalyticsMetric[]): ChartConfiguration {
    const datasets = this.processDatasets(data);
    const labels = this.generateLabels(data);

    return {
      type: this.type,
      data: {
        labels,
        datasets
      }
    };
  }

  private processDatasets(data: IAnalyticsMetric[]): any[] {
    const groupedData = this.groupDataByMetricType(data);
    
    return Object.entries(groupedData).map(([metricType, values]) => ({
      label: this.formatLabel(metricType as MetricType),
      data: values.map(v => v.value),
      borderColor: this.getColorForMetricType(metricType as MetricType),
      backgroundColor: this.getBackgroundColorForMetricType(metricType as MetricType),
      fill: this.type === 'area',
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5
    }));
  }

  private groupDataByMetricType(data: IAnalyticsMetric[]): Record<string, IAnalyticsMetric[]> {
    return data.reduce((acc, curr) => {
      const key = curr.metricType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {} as Record<string, IAnalyticsMetric[]>);
  }

  private generateLabels(data: IAnalyticsMetric[]): string[] {
    return [...new Set(data.map(d => 
      new Date(d.timestamp).toLocaleDateString(this.locale)
    ))];
  }

  private getDefaultChartOptions(): ChartOptions {
    return {
      plugins: {
        legend: {
          display: this.showLegend,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          enabled: this.isInteractive,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => this.formatTooltipLabel(context)
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => this.formatAxisLabel(value)
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }

  private formatTooltipLabel(context: any): string {
    const value = context.raw;
    const metricType = context.dataset.label;

    switch (metricType) {
      case MetricType.COST:
        return formatCurrency(value, this.locale);
      case MetricType.LICENSE_USAGE:
        return formatPercentage(value);
      default:
        return formatMetricValue(value);
    }
  }

  private formatAxisLabel(value: any): string {
    if (typeof value !== 'number') return '';
    return formatMetricValue(value);
  }

  private formatLabel(metricType: MetricType): string {
    const labels: Record<MetricType, string> = {
      [MetricType.LICENSE_USAGE]: 'License Usage',
      [MetricType.API_CALLS]: 'API Calls',
      [MetricType.STORAGE]: 'Storage',
      [MetricType.ACTIVE_USERS]: 'Active Users',
      [MetricType.COST]: 'Cost'
    };
    return labels[metricType] || metricType;
  }

  private getColorForMetricType(metricType: MetricType): string {
    const colors: Record<MetricType, string> = {
      [MetricType.LICENSE_USAGE]: '#2563EB',
      [MetricType.API_CALLS]: '#3B82F6',
      [MetricType.STORAGE]: '#60A5FA',
      [MetricType.ACTIVE_USERS]: '#93C5FD',
      [MetricType.COST]: '#EF4444'
    };
    return colors[metricType] || '#CBD5E1';
  }

  private getBackgroundColorForMetricType(metricType: MetricType): string {
    const color = this.getColorForMetricType(metricType);
    return `${color}33`; // 20% opacity
  }
}