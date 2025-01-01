import { Component, OnInit, OnDestroy } from '@angular/core'; // v17.x
import { Store, select } from '@ngrx/store'; // v17.x
import { Subject, interval, takeUntil, catchError } from 'rxjs'; // v7.x

import { ICostAnalytics, IDepartmentCost } from '../../../../shared/models/analytics.model';
import { AnalyticsService } from '../../../../core/services/analytics.service';

@Component({
  selector: 'app-cost-summary',
  templateUrl: './cost-summary.component.html',
  styleUrls: ['./cost-summary.component.scss']
})
export class CostSummaryComponent implements OnInit, OnDestroy {
  // Public properties for template binding
  costData: ICostAnalytics | null = null;
  loading = true;
  hasError = false;

  // Private properties
  private readonly destroy$ = new Subject<void>();
  private refreshInterval = 30000; // 30 seconds default refresh

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly store: Store
  ) {}

  ngOnInit(): void {
    // Initial data load
    this.loadCostData();

    // Set up real-time updates
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadCostData();
      });

    // Subscribe to loading state from store
    this.store.pipe(
      select(state => state.analytics.loading),
      takeUntil(this.destroy$)
    ).subscribe(loading => {
      this.loading = loading;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Loads cost analytics data with error handling
   * @private
   */
  private loadCostData(): void {
    this.loading = true;
    this.hasError = false;

    // Calculate date range for analytics (current month vs previous year)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    this.analyticsService.getCostAnalytics(startDate, endDate)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading cost data:', error);
          this.hasError = true;
          this.loading = false;
          return [];
        })
      )
      .subscribe(data => {
        if (data) {
          this.costData = data;
        }
        this.loading = false;
      });
  }

  /**
   * Formats currency values for display
   * @param value - The numeric value to format
   * @returns Formatted currency string
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Formats percentage values with appropriate sign
   * @param value - The numeric value to format
   * @returns Formatted percentage string
   */
  formatPercentage(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  /**
   * Calculates the percentage of total cost for a department
   * @param departmentCost - The department cost data
   * @returns Calculated percentage
   */
  calculatePercentage(departmentCost: IDepartmentCost): number {
    if (!this.costData || !this.costData.totalSpend || !departmentCost.cost) {
      return 0;
    }
    return (departmentCost.cost / this.costData.totalSpend) * 100;
  }

  /**
   * Determines CSS class based on year-over-year change
   * @returns CSS class name
   */
  getChangeClass(): string {
    if (!this.costData || !this.costData.yearOverYearChange) {
      return 'neutral';
    }
    return this.costData.yearOverYearChange > 0 ? 'increase' : 'decrease';
  }

  /**
   * Checks if data should be refreshed based on last update
   * @returns Boolean indicating if refresh is needed
   */
  shouldRefreshData(): boolean {
    if (!this.costData) {
      return true;
    }
    const lastUpdate = new Date(this.costData.lastUpdated);
    const now = new Date();
    return now.getTime() - lastUpdate.getTime() > this.refreshInterval;
  }
}