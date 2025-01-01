import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, catchError, retry } from 'rxjs';

import { AnalyticsService } from '../../core/services/analytics.service';
import { 
  IAnalyticsMetric, 
  ICostAnalytics, 
  IUsageTrend, 
  MetricType, 
  IWebSocketMessage 
} from '../../shared/models/analytics.model';
import { 
  selectAllMetrics, 
  selectMetricsByType, 
  selectDateRange, 
  selectAnalyticsLoading, 
  selectDepartmentFilter 
} from '../../core/store/selectors/analytics.selectors';
import { AppState } from '../../core/store/state/app.state';

/**
 * Component responsible for displaying and managing analytics data including
 * real-time cost analysis, usage metrics, and department breakdowns
 */
@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly wsError$ = new Subject<void>();
  private readonly WS_RETRY_DELAY = 5000;
  private readonly METRICS_REFRESH_INTERVAL = 30000;
  private metricsSocket: WebSocket;

  // Observable streams
  costAnalytics$ = this.store.pipe(select(selectMetricsByType(MetricType.COST)));
  metrics$ = this.store.pipe(select(selectAllMetrics));
  loading$ = this.store.pipe(select(selectAnalyticsLoading));
  dateRange$ = this.store.pipe(select(selectDateRange));

  // Date range filters
  startDate: Date;
  endDate: Date;
  selectedDepartment: string | null = null;

  constructor(
    private store: Store<AppState>,
    private analyticsService: AnalyticsService
  ) {
    const now = new Date();
    this.endDate = now;
    this.startDate = new Date(now.setMonth(now.getMonth() - 1));
  }

  ngOnInit(): void {
    this.initializeWebSocket();
    this.setupDataRefresh();
    this.loadAnalytics();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsError$.complete();
    if (this.metricsSocket) {
      this.metricsSocket.close();
    }
  }

  /**
   * Initializes WebSocket connection for real-time metrics updates
   * @private
   */
  private initializeWebSocket(): void {
    this.metricsSocket = this.analyticsService.connectToMetricsStream();
    
    this.metricsSocket.onmessage = (event: MessageEvent) => {
      try {
        const message: IWebSocketMessage = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    this.metricsSocket.onerror = () => {
      this.wsError$.next();
    };

    this.metricsSocket.onclose = () => {
      setTimeout(() => this.initializeWebSocket(), this.WS_RETRY_DELAY);
    };
  }

  /**
   * Sets up periodic data refresh and WebSocket reconnection
   * @private
   */
  private setupDataRefresh(): void {
    // Periodic metrics refresh
    this.store.pipe(
      select(selectDateRange),
      debounceTime(this.METRICS_REFRESH_INTERVAL),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadAnalytics());

    // WebSocket error handling with retry
    this.wsError$.pipe(
      retry(3),
      takeUntil(this.destroy$)
    ).subscribe(() => this.initializeWebSocket());
  }

  /**
   * Sets up store subscriptions for analytics data
   * @private
   */
  private setupSubscriptions(): void {
    // Department filter subscription
    this.store.pipe(
      select(selectDepartmentFilter),
      takeUntil(this.destroy$)
    ).subscribe(department => {
      this.selectedDepartment = department;
      this.loadAnalytics();
    });
  }

  /**
   * Loads analytics data with error handling and retries
   */
  public loadAnalytics(): void {
    // Load cost analytics
    this.analyticsService.getCostAnalytics(
      this.startDate,
      this.endDate,
      this.selectedDepartment
    ).pipe(
      retry(3),
      catchError(error => {
        console.error('Cost analytics loading error:', error);
        return [];
      }),
      takeUntil(this.destroy$)
    ).subscribe();

    // Load usage trends
    this.analyticsService.getUsageTrends(
      'all',
      MetricType.LICENSE_USAGE,
      24
    ).pipe(
      retry(3),
      catchError(error => {
        console.error('Usage trends loading error:', error);
        return [];
      }),
      takeUntil(this.destroy$)
    ).subscribe();

    // Load aggregated metrics
    this.analyticsService.getAggregatedMetrics(
      'all',
      MetricType.COST,
      this.startDate,
      this.endDate
    ).pipe(
      retry(3),
      catchError(error => {
        console.error('Aggregated metrics loading error:', error);
        return [];
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  /**
   * Updates the analytics date range and reloads data
   * @param start - Start date
   * @param end - End date
   */
  public updateDateRange(start: Date, end: Date): void {
    if (start > end) {
      console.error('Invalid date range');
      return;
    }

    this.startDate = start;
    this.endDate = end;
    this.loadAnalytics();

    // Update WebSocket filter parameters
    const filterUpdate = {
      type: 'UPDATE_FILTER',
      payload: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    };
    this.metricsSocket.send(JSON.stringify(filterUpdate));
  }

  /**
   * Exports analytics data in specified format
   * @param format - Export format (csv, pdf, excel)
   */
  public exportAnalytics(format: string): void {
    const supportedFormats = ['csv', 'pdf', 'excel'];
    if (!supportedFormats.includes(format)) {
      console.error('Unsupported export format');
      return;
    }

    this.metrics$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(metrics => {
      const exportData = metrics.map(metric => ({
        timestamp: metric.timestamp,
        type: metric.metricType,
        value: metric.value,
        unit: metric.unit
      }));

      // Implement export logic based on format
      switch (format) {
        case 'csv':
          this.exportToCsv(exportData);
          break;
        case 'pdf':
          this.exportToPdf(exportData);
          break;
        case 'excel':
          this.exportToExcel(exportData);
          break;
      }
    });
  }

  /**
   * Handles incoming WebSocket messages
   * @param message - WebSocket message
   */
  public handleWebSocketMessage(message: IWebSocketMessage): void {
    if (!message || !message.type) {
      return;
    }

    switch (message.type) {
      case 'METRIC_UPDATE':
        this.handleMetricUpdate(message.payload);
        break;
      case 'ALERT':
        this.handleAlert(message.payload);
        break;
      case 'ERROR':
        console.error('WebSocket error:', message.payload);
        break;
    }
  }

  /**
   * Handles metric updates from WebSocket
   * @private
   * @param payload - Metric update payload
   */
  private handleMetricUpdate(payload: any): void {
    if (!payload || !payload.metrics) {
      return;
    }

    // Update store with new metrics
    this.store.dispatch({
      type: '[Analytics] Update Metrics',
      payload: payload.metrics
    });
  }

  /**
   * Handles alert messages from WebSocket
   * @private
   * @param payload - Alert payload
   */
  private handleAlert(payload: any): void {
    if (!payload || !payload.message) {
      return;
    }

    // Dispatch alert to notification system
    this.store.dispatch({
      type: '[Analytics] New Alert',
      payload: payload
    });
  }

  /**
   * Exports data to CSV format
   * @private
   * @param data - Data to export
   */
  private exportToCsv(data: any[]): void {
    // CSV export implementation
  }

  /**
   * Exports data to PDF format
   * @private
   * @param data - Data to export
   */
  private exportToPdf(data: any[]): void {
    // PDF export implementation
  }

  /**
   * Exports data to Excel format
   * @private
   * @param data - Data to export
   */
  private exportToExcel(data: any[]): void {
    // Excel export implementation
  }
}