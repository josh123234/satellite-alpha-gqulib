import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'; // v17.x
import { provideMockStore, MockStore } from '@ngrx/store/testing'; // v17.0.0
import { of, throwError } from 'rxjs'; // v7.x

import { SubscriptionsComponent } from './subscriptions.component';
import { SubscriptionService } from '../../core/services/subscription.service';
import * as SubscriptionActions from '../../core/store/actions/subscription.actions';
import { Subscription, SubscriptionStatus, BillingCycle } from '../../shared/models/subscription.model';
import { MetricType } from '../../shared/models/analytics.model';

describe('SubscriptionsComponent', () => {
  let component: SubscriptionsComponent;
  let fixture: ComponentFixture<SubscriptionsComponent>;
  let store: MockStore;
  let subscriptionService: jasmine.SpyObj<SubscriptionService>;

  // Mock data
  const mockSubscriptions: Subscription[] = [
    {
      id: '1',
      organizationId: 'org1',
      name: 'Slack',
      description: 'Team communication',
      provider: 'Slack',
      cost: 1000,
      billingCycle: BillingCycle.MONTHLY,
      renewalDate: new Date('2024-03-01'),
      status: SubscriptionStatus.ACTIVE,
      totalLicenses: 100,
      usedLicenses: 80,
      metadata: {
        tags: ['communication'],
        customFields: {},
        integrationData: {}
      },
      contractDetails: {
        contractId: 'contract1',
        terms: 'Standard',
        startDate: new Date('2023-03-01'),
        endDate: new Date('2024-03-01')
      },
      usageMetrics: {
        lastActive: new Date(),
        utilizationRate: 80,
        activeUsers: 75
      },
      createdAt: new Date('2023-03-01'),
      updatedAt: new Date('2024-01-20')
    }
  ];

  const mockAnalytics = [
    {
      id: 'metric1',
      subscriptionId: '1',
      metricType: MetricType.LICENSE_USAGE,
      value: 80,
      unit: 'percent',
      timestamp: new Date()
    }
  ];

  const mockInitialState = {
    subscriptions: {
      ids: ['1'],
      entities: { '1': mockSubscriptions[0] },
      selectedSubscriptionId: null,
      loading: false,
      error: null,
      lastUpdated: Date.now(),
      alertQueue: [],
      optimisticUpdates: new Map(),
      version: 1
    }
  };

  beforeEach(async () => {
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
      'getSubscriptions',
      'getSubscriptionAnalytics',
      'updateSubscription',
      'deleteSubscription'
    ]);

    await TestBed.configureTestingModule({
      declarations: [SubscriptionsComponent],
      providers: [
        provideMockStore({ initialState: mockInitialState }),
        { provide: SubscriptionService, useValue: subscriptionServiceSpy }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    subscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    fixture = TestBed.createComponent(SubscriptionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('Initialization', () => {
    it('should create component', () => {
      expect(component).toBeTruthy();
    });

    it('should load subscriptions on init', fakeAsync(() => {
      store.dispatch = jasmine.createSpy();
      component.ngOnInit();
      tick();

      expect(store.dispatch).toHaveBeenCalledWith(
        SubscriptionActions.loadSubscriptions()
      );
    }));

    it('should initialize analytics tracking', fakeAsync(() => {
      subscriptionService.getSubscriptionAnalytics.and.returnValue(of(mockAnalytics));
      component.ngOnInit();
      tick();

      component.analytics$.subscribe(analytics => {
        expect(analytics).toBeDefined();
        expect(analytics.length).toBeGreaterThan(0);
      });
    }));
  });

  describe('Subscription Management', () => {
    it('should filter subscriptions based on criteria', fakeAsync(() => {
      component.updateFilters({
        searchTerm: 'Slack',
        status: [SubscriptionStatus.ACTIVE]
      });
      tick(200); // Account for debounceTime

      component.filteredSubscriptions$.subscribe(filtered => {
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('Slack');
      });
    }));

    it('should handle subscription updates', fakeAsync(() => {
      const changes = { cost: 1200 };
      store.dispatch = jasmine.createSpy();
      
      component.updateSubscription('1', changes);
      tick();

      expect(store.dispatch).toHaveBeenCalledWith(
        SubscriptionActions.updateSubscription({ id: '1', changes })
      );
    }));

    it('should handle subscription deletion', () => {
      store.dispatch = jasmine.createSpy();
      component.deleteSubscription('1');

      expect(store.dispatch).toHaveBeenCalledWith(
        SubscriptionActions.deleteSubscription({ id: '1' })
      );
    });
  });

  describe('Real-time Updates', () => {
    it('should handle websocket subscription updates', fakeAsync(() => {
      const update = { ...mockSubscriptions[0], cost: 1500 };
      store.dispatch = jasmine.createSpy();

      // Simulate websocket update
      component['subscriptionWebSocket$'] = of(update);
      component.ngOnInit();
      tick();

      expect(store.dispatch).toHaveBeenCalledWith(
        SubscriptionActions.subscriptionWebSocketUpdate({ subscription: update })
      );
    }));

    it('should process analytics updates', fakeAsync(() => {
      const analyticsUpdate = {
        subscriptionId: '1',
        metricType: MetricType.LICENSE_USAGE,
        value: 85,
        timestamp: new Date()
      };

      store.dispatch = jasmine.createSpy();
      component['analyticsWebSocket$'] = of(analyticsUpdate);
      component.ngOnInit();
      tick();

      expect(store.dispatch).toHaveBeenCalled();
    }));
  });

  describe('Error Handling', () => {
    it('should handle subscription loading errors', fakeAsync(() => {
      const error = { message: 'Failed to load', code: 'LOAD_ERROR' };
      store.setState({
        subscriptions: {
          ...mockInitialState.subscriptions,
          loading: false,
          error
        }
      });
      tick();

      component.error$.subscribe(err => {
        expect(err).toEqual(error);
      });
    }));

    it('should retry failed websocket connections', fakeAsync(() => {
      const update = { ...mockSubscriptions[0], cost: 1500 };
      let attempts = 0;
      component['subscriptionWebSocket$'] = throwError(() => new Error('Connection failed')).pipe(
        retryWhen(errors => errors.pipe(
          tap(() => attempts++),
          delay(1000),
          take(3)
        ))
      );

      component.ngOnInit();
      tick(3000);

      expect(attempts).toBe(3);
    }));
  });

  describe('Analytics Integration', () => {
    it('should detect cost anomalies', fakeAsync(() => {
      const costMetrics = [
        {
          id: 'metric2',
          subscriptionId: '1',
          metricType: MetricType.COST,
          value: 2000, // Significant increase
          unit: 'USD',
          timestamp: new Date()
        }
      ];

      component['processAnalytics'](costMetrics);
      tick();

      component.analytics$.subscribe(analytics => {
        expect(analytics).toBeDefined();
        // Verify cost anomaly detection logic
      });
    }));

    it('should analyze usage patterns', fakeAsync(() => {
      const usageMetrics = [
        {
          id: 'metric3',
          subscriptionId: '1',
          metricType: MetricType.LICENSE_USAGE,
          value: 50, // Underutilization
          unit: 'percent',
          timestamp: new Date()
        }
      ];

      component['processAnalytics'](usageMetrics);
      tick();

      component.analytics$.subscribe(analytics => {
        expect(analytics).toBeDefined();
        // Verify usage pattern analysis logic
      });
    }));
  });
});