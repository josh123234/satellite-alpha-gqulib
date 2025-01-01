import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { Store, MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, throwError, WebSocketSubject } from 'rxjs';
import { cold, hot } from 'jasmine-marbles';

import { AnalyticsComponent } from './analytics.component';
import { AnalyticsService } from '../../core/services/analytics.service';
import { MetricType } from '../../shared/models/analytics.model';
import { AppState } from '../../core/store/state/app.state';

describe('AnalyticsComponent', () => {
  let component: AnalyticsComponent;
  let fixture: ComponentFixture<AnalyticsComponent>;
  let mockStore: MockStore<AppState>;
  let mockAnalyticsService: jasmine.SpyObj<AnalyticsService>;
  let mockWebSocket: jasmine.SpyObj<WebSocket>;

  const mockInitialState = {
    analytics: {
      entities: {},
      ids: [],
      selectedMetricType: MetricType.COST,
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      loading: false,
      error: null,
      aggregates: {
        totalCost: 10000,
        averageUtilization: 75,
        activeSubscriptions: 50
      }
    }
  };

  const mockMetrics = [
    {
      id: '1',
      subscriptionId: 'sub_1',
      metricType: MetricType.COST,
      value: 1000,
      unit: 'USD',
      timestamp: new Date()
    }
  ];

  beforeEach(async () => {
    mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', [
      'getMetricsBySubscription',
      'getCostAnalytics',
      'getUsageTrends',
      'connectToMetricsStream'
    ]);

    mockWebSocket = jasmine.createSpyObj('WebSocket', ['close', 'send']);

    await TestBed.configureTestingModule({
      declarations: [AnalyticsComponent],
      providers: [
        provideMockStore({ initialState: mockInitialState }),
        { provide: AnalyticsService, useValue: mockAnalyticsService }
      ]
    }).compileComponents();

    mockStore = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    mockStore.resetSelectors();
  });

  describe('Component Lifecycle', () => {
    it('should initialize WebSocket connection on init', fakeAsync(() => {
      mockAnalyticsService.connectToMetricsStream.and.returnValue(mockWebSocket);
      
      component.ngOnInit();
      tick();

      expect(mockAnalyticsService.connectToMetricsStream).toHaveBeenCalled();
      expect(component['metricsSocket']).toBeTruthy();
    }));

    it('should clean up resources on destroy', fakeAsync(() => {
      component['metricsSocket'] = mockWebSocket;
      
      component.ngOnDestroy();
      tick();

      expect(mockWebSocket.close).toHaveBeenCalled();
    }));
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket metric updates correctly', fakeAsync(() => {
      const mockMessage = {
        type: 'METRIC_UPDATE',
        payload: { metrics: mockMetrics }
      };

      mockAnalyticsService.connectToMetricsStream.and.returnValue(mockWebSocket);
      component.ngOnInit();
      
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(mockMessage)
      });
      mockWebSocket.onmessage(messageEvent);
      tick();

      const action = mockStore.scannedActions().find(
        action => action.type === '[Analytics] Update Metrics'
      );
      expect(action).toBeTruthy();
      expect(action.payload).toEqual(mockMetrics);
    }));

    it('should handle WebSocket connection errors', fakeAsync(() => {
      mockAnalyticsService.connectToMetricsStream.and.returnValue(mockWebSocket);
      component.ngOnInit();
      
      mockWebSocket.onerror(new Event('error'));
      tick(5000); // WS_RETRY_DELAY

      expect(mockAnalyticsService.connectToMetricsStream).toHaveBeenCalledTimes(2);
    }));
  });

  describe('Cost Analytics', () => {
    it('should load cost analytics data', fakeAsync(() => {
      const mockCostData = {
        total: 10000,
        departments: { 'Engineering': 5000, 'Marketing': 3000 },
        savings: 2000
      };

      mockAnalyticsService.getCostAnalytics.and.returnValue(of(mockCostData));
      component.loadAnalytics();
      tick();

      expect(mockAnalyticsService.getCostAnalytics).toHaveBeenCalledWith(
        component.startDate,
        component.endDate,
        component.selectedDepartment
      );
    }));

    it('should handle cost analytics error', fakeAsync(() => {
      const errorMessage = 'Failed to load cost data';
      mockAnalyticsService.getCostAnalytics.and.returnValue(throwError(() => new Error(errorMessage)));
      
      spyOn(console, 'error');
      component.loadAnalytics();
      tick();

      expect(console.error).toHaveBeenCalledWith('Cost analytics loading error:', jasmine.any(Error));
    }));
  });

  describe('Usage Analytics', () => {
    it('should load usage trends', fakeAsync(() => {
      const mockTrends = {
        trends: [{ date: new Date(), value: 85 }],
        average: 80
      };

      mockAnalyticsService.getUsageTrends.and.returnValue(of(mockTrends));
      component.loadAnalytics();
      tick();

      expect(mockAnalyticsService.getUsageTrends).toHaveBeenCalledWith(
        'all',
        MetricType.LICENSE_USAGE,
        24
      );
    }));

    it('should update date range and reload analytics', fakeAsync(() => {
      const newStart = new Date('2024-02-01');
      const newEnd = new Date('2024-02-29');

      component.updateDateRange(newStart, newEnd);
      tick();

      expect(mockWebSocket.send).toHaveBeenCalledWith(jasmine.any(String));
      expect(component.startDate).toEqual(newStart);
      expect(component.endDate).toEqual(newEnd);
    }));
  });

  describe('Export Functionality', () => {
    it('should validate export format', fakeAsync(() => {
      spyOn(console, 'error');
      component.exportAnalytics('invalid_format');
      tick();

      expect(console.error).toHaveBeenCalledWith('Unsupported export format');
    }));

    it('should prepare data for export', fakeAsync(() => {
      mockStore.setState({
        ...mockInitialState,
        analytics: {
          ...mockInitialState.analytics,
          entities: { '1': mockMetrics[0] }
        }
      });

      spyOn<any>(component, 'exportToCsv');
      component.exportAnalytics('csv');
      tick();

      expect(component['exportToCsv']).toHaveBeenCalled();
    }));
  });

  describe('Performance Optimization', () => {
    it('should debounce frequent metric updates', fakeAsync(() => {
      const metrics$ = cold('a-b-c|', { a: mockMetrics });
      mockStore.overrideSelector(state => state.analytics.entities, metrics$);
      
      component.ngOnInit();
      tick(component['METRICS_REFRESH_INTERVAL']);
      
      expect(mockAnalyticsService.getCostAnalytics).toHaveBeenCalledTimes(1);
    }));

    it('should retry failed API calls', fakeAsync(() => {
      mockAnalyticsService.getCostAnalytics.and.returnValues(
        throwError(() => new Error('Network error')),
        throwError(() => new Error('Network error')),
        of({ total: 10000, departments: {}, savings: 2000 })
      );

      component.loadAnalytics();
      tick();

      expect(mockAnalyticsService.getCostAnalytics).toHaveBeenCalledTimes(3);
    }));
  });
});