import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing'; // v17.x
import { provideMockStore, MockStore } from '@ngrx/store/testing'; // v17.0.0
import { of, throwError } from 'rxjs'; // v7.x

import { AiAssistantComponent } from './ai-assistant.component';
import { AiService } from '../../core/services/ai.service';
import { WebSocketService, ConnectionState } from '../../core/services/websocket.service';
import { SocketEventType } from '../../../../backend/src/websocket/interfaces/socket-event.interface';

describe('AiAssistantComponent', () => {
  let component: AiAssistantComponent;
  let fixture: ComponentFixture<AiAssistantComponent>;
  let aiServiceSpy: jasmine.SpyObj<AiService>;
  let wsServiceSpy: jasmine.SpyObj<WebSocketService>;
  let store: MockStore;

  const mockInsights = [
    {
      id: 'insight-1',
      type: 'cost',
      title: 'Cost Optimization',
      description: 'Potential savings identified',
      recommendations: ['Reduce unused licenses'],
      potentialSavings: 500,
      validUntil: new Date(),
      metadata: {
        modelVersion: '1.0',
        dataPoints: 100,
        analysisTimestamp: new Date().toISOString()
      },
      confidence: 0.9,
      modelVersion: '1.0'
    }
  ];

  beforeEach(async () => {
    // Create spy objects for services
    aiServiceSpy = jasmine.createSpyObj('AiService', [
      'getInsights',
      'generateRecommendations',
      'analyzeUsagePatterns'
    ]);
    wsServiceSpy = jasmine.createSpyObj('WebSocketService', [
      'connect',
      'disconnect',
      'getConnectionState'
    ], {
      connectionState$: of(ConnectionState.CONNECTED)
    });

    // Configure spy behavior
    aiServiceSpy.getInsights.and.returnValue(of(mockInsights));
    aiServiceSpy.generateRecommendations.and.returnValue(of(mockInsights[0]));
    wsServiceSpy.getConnectionState.and.returnValue(of(ConnectionState.CONNECTED));

    await TestBed.configureTestingModule({
      declarations: [AiAssistantComponent],
      providers: [
        provideMockStore({}),
        { provide: AiService, useValue: aiServiceSpy },
        { provide: WebSocketService, useValue: wsServiceSpy }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AiAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    store.resetSelectors();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize WebSocket connection on init', () => {
      component.ngOnInit();
      expect(wsServiceSpy.connect).toHaveBeenCalled();
    });

    it('should set up insights subscription on init', () => {
      component.ngOnInit();
      expect(aiServiceSpy.getInsights).toHaveBeenCalled();
    });

    it('should handle initial connection state', (done) => {
      component.connectionState$.subscribe(state => {
        expect(state).toBe(ConnectionState.CONNECTED);
        done();
      });
    });
  });

  describe('WebSocket Communication', () => {
    it('should handle connection state changes', fakeAsync(() => {
      wsServiceSpy.getConnectionState.and.returnValue(of(ConnectionState.DISCONNECTED));
      component.ngOnInit();
      tick();
      
      component.connectionState$.subscribe(state => {
        expect(state).toBe(ConnectionState.DISCONNECTED);
      });
      
      flush();
    }));

    it('should attempt reconnection on disconnect', fakeAsync(() => {
      wsServiceSpy.getConnectionState.and.returnValue(of(ConnectionState.DISCONNECTED));
      component.ngOnInit();
      tick();
      
      expect(wsServiceSpy.connect).toHaveBeenCalledTimes(2);
      flush();
    }));

    it('should clean up WebSocket connection on destroy', () => {
      component.ngOnDestroy();
      expect(wsServiceSpy.disconnect).toHaveBeenCalled();
    });
  });

  describe('Insight Handling', () => {
    it('should process new insights', fakeAsync(() => {
      component.ngOnInit();
      tick();

      component.insights$.subscribe(insights => {
        expect(insights).toEqual(mockInsights);
      });

      flush();
    }));

    it('should handle insight action', fakeAsync(() => {
      const insight = mockInsights[0];
      component.handleInsightAction(insight);
      tick();

      expect(aiServiceSpy.generateRecommendations).toHaveBeenCalledWith(
        insight.id,
        { confidence: 0.8, timeframe: 30 }
      );

      flush();
    }));

    it('should handle error during insight generation', fakeAsync(() => {
      aiServiceSpy.generateRecommendations.and.returnValue(
        throwError(() => new Error('API Error'))
      );

      component.handleInsightAction(mockInsights[0]);
      tick();

      component.errorState$.subscribe(error => {
        expect(error).toBeTruthy();
        expect(error.type).toBe('API_ERROR');
      });

      flush();
    }));
  });

  describe('Error Handling', () => {
    it('should handle connection errors', fakeAsync(() => {
      wsServiceSpy.getConnectionState.and.returnValue(
        throwError(() => new Error('Connection Error'))
      );
      
      component.ngOnInit();
      tick();

      component.errorState$.subscribe(error => {
        expect(error).toBeTruthy();
        expect(error.type).toBe('CONNECTION_ERROR');
      });

      flush();
    }));

    it('should handle API errors', fakeAsync(() => {
      aiServiceSpy.getInsights.and.returnValue(
        throwError(() => new Error('API Error'))
      );

      component.ngOnInit();
      tick();

      component.errorState$.subscribe(error => {
        expect(error).toBeTruthy();
        expect(error.type).toBe('API_ERROR');
      });

      flush();
    }));

    it('should handle rate limit errors', fakeAsync(() => {
      aiServiceSpy.getInsights.and.returnValue(
        throwError(() => new Error('Rate Limit Exceeded'))
      );

      component.ngOnInit();
      tick();

      component.errorState$.subscribe(error => {
        expect(error).toBeTruthy();
        expect(error.type).toBe('RATE_LIMIT_ERROR');
      });

      flush();
    }));
  });

  describe('State Management', () => {
    it('should update loading state during operations', fakeAsync(() => {
      component.handleInsightAction(mockInsights[0]);
      tick();

      component.isLoading$.subscribe(loading => {
        expect(loading).toBeFalse();
      });

      flush();
    }));

    it('should maintain message queue during disconnection', fakeAsync(() => {
      wsServiceSpy.getConnectionState.and.returnValue(of(ConnectionState.DISCONNECTED));
      component.ngOnInit();
      tick();

      const insight = mockInsights[0];
      component.handleInsightAction(insight);
      tick();

      // Reconnect
      wsServiceSpy.getConnectionState.and.returnValue(of(ConnectionState.CONNECTED));
      tick();

      expect(aiServiceSpy.generateRecommendations).toHaveBeenCalled();
      flush();
    }));
  });

  describe('Cleanup', () => {
    it('should complete all observables on destroy', () => {
      const subjectSpies = [
        spyOn(component['destroy$'], 'complete'),
        spyOn(component.insights$, 'complete'),
        spyOn(component.isLoading$, 'complete'),
        spyOn(component.connectionState$, 'complete'),
        spyOn(component.errorState$, 'complete')
      ];

      component.ngOnDestroy();

      subjectSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('should clear message queue on destroy', () => {
      const insight = mockInsights[0];
      component.handleInsightAction(insight);
      component.ngOnDestroy();

      // Verify message queue is empty through a new action
      component.handleInsightAction(insight);
      expect(aiServiceSpy.generateRecommendations).toHaveBeenCalledTimes(1);
    });
  });
});