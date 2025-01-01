import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, takeUntil, forkJoin, catchError, retry, BehaviorSubject } from 'rxjs';
import { 
    IAnalyticsMetric, 
    ICostAnalytics, 
    IUsageTrend, 
    MetricType, 
    ILoadingState 
} from '../../shared/models/analytics.model';
import { 
    Subscription, 
    SubscriptionStatus, 
    ISubscriptionAlert 
} from '../../shared/models/subscription.model';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
    // BehaviorSubjects for reactive state management
    costAnalytics$ = new BehaviorSubject<ICostAnalytics | null>(null);
    activeSubscriptions$ = new BehaviorSubject<Subscription[]>([]);
    usageTrends$ = new BehaviorSubject<IUsageTrend[]>([]);
    loadingState$ = new BehaviorSubject<ILoadingState>({
        isLoading: false,
        error: null
    });

    // Constants for configuration
    private readonly REFRESH_INTERVAL = 30000; // 30 seconds
    private readonly RETRY_ATTEMPTS = 3;
    private readonly TREND_TIMEFRAME = 24; // 24 hours for trends
    private refreshTimer: number | null = null;
    private readonly destroy$ = new Subject<void>();

    constructor(
        private analyticsService: AnalyticsService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.initializeDashboard();
        this.setupRealTimeUpdates();
        this.setupRefreshInterval();
    }

    private initializeDashboard(): void {
        this.loadingState$.next({ isLoading: true, error: null });
        this.loadDashboardData();
    }

    private loadDashboardData(): void {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month

        forkJoin({
            costAnalytics: this.analyticsService.getCostAnalytics(startDate, endDate).pipe(
                retry(this.RETRY_ATTEMPTS),
                catchError(error => {
                    console.error('Cost analytics error:', error);
                    return [];
                })
            ),
            usageTrends: this.analyticsService.getUsageTrends(
                'all', // Special identifier for all subscriptions
                MetricType.LICENSE_USAGE,
                this.TREND_TIMEFRAME
            ).pipe(
                retry(this.RETRY_ATTEMPTS),
                catchError(error => {
                    console.error('Usage trends error:', error);
                    return [];
                })
            )
        }).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (data) => {
                this.updateDashboardData(data);
                this.loadingState$.next({ isLoading: false, error: null });
                this.cdr.detectChanges();
            },
            error: (error) => {
                this.handleError(error);
            }
        });
    }

    private updateDashboardData(data: any): void {
        if (data.costAnalytics) {
            this.costAnalytics$.next(data.costAnalytics);
        }
        if (data.usageTrends) {
            this.usageTrends$.next(Array.isArray(data.usageTrends) ? data.usageTrends : [data.usageTrends]);
        }
    }

    private setupRealTimeUpdates(): void {
        // Subscribe to real-time metric updates
        this.analyticsService.subscribeToMetricUpdates()
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Real-time updates error:', error);
                    return [];
                })
            )
            .subscribe(update => {
                this.handleRealTimeUpdate(update);
                this.cdr.detectChanges();
            });
    }

    private handleRealTimeUpdate(update: IAnalyticsMetric): void {
        // Update relevant metrics based on the update type
        switch (update.metricType) {
            case MetricType.COST:
                this.updateCostAnalytics(update);
                break;
            case MetricType.LICENSE_USAGE:
                this.updateUsageTrends(update);
                break;
            default:
                console.warn('Unhandled metric type:', update.metricType);
        }
    }

    private updateCostAnalytics(update: IAnalyticsMetric): void {
        const currentAnalytics = this.costAnalytics$.value;
        if (currentAnalytics) {
            // Deep clone and update the relevant metric
            const updatedAnalytics = {
                ...currentAnalytics,
                totalSpend: update.value
            };
            this.costAnalytics$.next(updatedAnalytics);
        }
    }

    private updateUsageTrends(update: IAnalyticsMetric): void {
        const currentTrends = this.usageTrends$.value;
        const updatedTrends = currentTrends.map(trend => 
            trend.subscriptionId === update.subscriptionId
                ? { ...trend, currentUsage: update.value }
                : trend
        );
        this.usageTrends$.next(updatedTrends);
    }

    private setupRefreshInterval(): void {
        this.refreshTimer = window.setInterval(() => {
            this.loadDashboardData();
        }, this.REFRESH_INTERVAL);
    }

    private handleError(error: any): void {
        console.error('Dashboard error:', error);
        this.loadingState$.next({
            isLoading: false,
            error: 'Failed to load dashboard data. Please try again later.'
        });
        this.cdr.detectChanges();
    }

    ngOnDestroy(): void {
        // Clean up resources
        if (this.refreshTimer) {
            window.clearInterval(this.refreshTimer);
        }
        this.destroy$.next();
        this.destroy$.complete();
        
        // Complete all BehaviorSubjects
        this.costAnalytics$.complete();
        this.activeSubscriptions$.complete();
        this.usageTrends$.complete();
        this.loadingState$.complete();
    }
}