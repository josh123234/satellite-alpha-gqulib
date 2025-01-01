import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { By, ChangeDetectorRef } from '@angular/platform-browser';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AnalyticsService } from '../../core/services/analytics.service';
import { MetricType } from '../../shared/models/analytics.model';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let analyticsService: jasmine.SpyObj<AnalyticsService>;
    let metricsSubject: Subject<any>;
    let cdr: ChangeDetectorRef;

    const mockMetricsData = {
        costAnalytics: {
            totalSpend: 45230,
            departmentCosts: {
                Engineering: 15830,
                Marketing: 12150,
                Sales: 10250,
                HR: 7000
            }
        },
        usageTrends: [
            {
                subscriptionId: '123',
                currentUsage: 85,
                trend: 'increasing'
            }
        ]
    };

    beforeEach(async () => {
        metricsSubject = new Subject();
        analyticsService = jasmine.createSpyObj('AnalyticsService', [
            'getCostAnalytics',
            'getUsageTrends',
            'subscribeToMetricUpdates'
        ]);

        analyticsService.getCostAnalytics.and.returnValue(of(mockMetricsData.costAnalytics));
        analyticsService.getUsageTrends.and.returnValue(of(mockMetricsData.usageTrends));
        analyticsService.subscribeToMetricUpdates.and.returnValue(metricsSubject.asObservable());

        await TestBed.configureTestingModule({
            declarations: [DashboardComponent],
            providers: [
                { provide: AnalyticsService, useValue: analyticsService },
                ChangeDetectorRef
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        cdr = fixture.componentRef.injector.get(ChangeDetectorRef);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with loading state', () => {
        fixture.detectChanges();
        expect(component.loadingState$.value.isLoading).toBeTruthy();
        expect(component.loadingState$.value.error).toBeNull();
    });

    it('should load initial dashboard data', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        expect(analyticsService.getCostAnalytics).toHaveBeenCalled();
        expect(analyticsService.getUsageTrends).toHaveBeenCalledWith(
            'all',
            MetricType.LICENSE_USAGE,
            24
        );

        expect(component.costAnalytics$.value).toEqual(mockMetricsData.costAnalytics);
        expect(component.usageTrends$.value).toEqual(mockMetricsData.usageTrends);
        expect(component.loadingState$.value.isLoading).toBeFalsy();

        discardPeriodicTasks();
    }));

    it('should handle real-time updates correctly', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        const updateData = {
            metricType: MetricType.COST,
            value: 46000,
            subscriptionId: '123',
            timestamp: new Date()
        };

        metricsSubject.next(updateData);
        tick();

        expect(component.costAnalytics$.value?.totalSpend).toBe(46000);
        discardPeriodicTasks();
    }));

    it('should handle errors during data loading', fakeAsync(() => {
        analyticsService.getCostAnalytics.and.returnValue(
            throwError(() => new Error('API Error'))
        );

        fixture.detectChanges();
        tick();

        expect(component.loadingState$.value.isLoading).toBeFalsy();
        expect(component.loadingState$.value.error).toBeTruthy();

        discardPeriodicTasks();
    }));

    it('should refresh data at specified intervals', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        // Clear initial calls
        analyticsService.getCostAnalytics.calls.reset();
        analyticsService.getUsageTrends.calls.reset();

        // Advance time by refresh interval (30 seconds)
        tick(30000);

        expect(analyticsService.getCostAnalytics).toHaveBeenCalled();
        expect(analyticsService.getUsageTrends).toHaveBeenCalled();

        discardPeriodicTasks();
    }));

    it('should update usage trends on real-time updates', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        const usageUpdate = {
            metricType: MetricType.LICENSE_USAGE,
            value: 90,
            subscriptionId: '123',
            timestamp: new Date()
        };

        metricsSubject.next(usageUpdate);
        tick();

        const updatedTrends = component.usageTrends$.value;
        expect(updatedTrends[0].currentUsage).toBe(90);

        discardPeriodicTasks();
    }));

    it('should clean up resources on destroy', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        const completeSpy = spyOn(component['destroy$'], 'complete');
        const costAnalyticsCompleteSpy = spyOn(component.costAnalytics$, 'complete');
        const usageTrendsCompleteSpy = spyOn(component.usageTrends$, 'complete');
        const loadingStateCompleteSpy = spyOn(component.loadingState$, 'complete');

        component.ngOnDestroy();

        expect(completeSpy).toHaveBeenCalled();
        expect(costAnalyticsCompleteSpy).toHaveBeenCalled();
        expect(usageTrendsCompleteSpy).toHaveBeenCalled();
        expect(loadingStateCompleteSpy).toHaveBeenCalled();

        discardPeriodicTasks();
    }));

    it('should trigger change detection on data updates', fakeAsync(() => {
        const detectChangesSpy = spyOn(cdr, 'detectChanges');
        fixture.detectChanges();
        tick();

        metricsSubject.next({
            metricType: MetricType.COST,
            value: 47000,
            subscriptionId: '123',
            timestamp: new Date()
        });
        tick();

        expect(detectChangesSpy).toHaveBeenCalled();
        discardPeriodicTasks();
    }));

    it('should handle multiple concurrent real-time updates', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        const updates = [
            {
                metricType: MetricType.COST,
                value: 47000,
                subscriptionId: '123',
                timestamp: new Date()
            },
            {
                metricType: MetricType.LICENSE_USAGE,
                value: 95,
                subscriptionId: '123',
                timestamp: new Date()
            }
        ];

        updates.forEach(update => metricsSubject.next(update));
        tick();

        expect(component.costAnalytics$.value?.totalSpend).toBe(47000);
        expect(component.usageTrends$.value[0].currentUsage).toBe(95);

        discardPeriodicTasks();
    }));
});