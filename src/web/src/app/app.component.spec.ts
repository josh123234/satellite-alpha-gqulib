import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of, throwError, timer } from 'rxjs';
import { By } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NotificationService } from './core/services/notification.service';
import { WebSocketService } from './core/services/websocket.service';
import { SharedModule } from './shared/shared.module';
import { NotificationType, NotificationPriority, NotificationStatus } from './shared/models/notification.model';
import { ConnectionState } from './core/services/websocket.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockWebSocketService: jasmine.SpyObj<WebSocketService>;
  let wsConnectionStatus$: BehaviorSubject<ConnectionState>;
  let notificationsSubject$: BehaviorSubject<any[]>;

  const mockNotifications = [
    {
      id: '1',
      type: NotificationType.SUBSCRIPTION_RENEWAL,
      priority: NotificationPriority.HIGH,
      status: NotificationStatus.UNREAD,
      title: 'Test Notification',
      message: 'Test Message',
      createdAt: new Date()
    }
  ];

  beforeEach(async () => {
    wsConnectionStatus$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
    notificationsSubject$ = new BehaviorSubject<any[]>([]);

    mockNotificationService = jasmine.createSpyObj('NotificationService', [
      'getNotifications',
      'markAsRead'
    ], {
      notifications$: notificationsSubject$.asObservable(),
      unreadCount$: new BehaviorSubject<number>(0)
    });

    mockWebSocketService = jasmine.createSpyObj('WebSocketService', [
      'connect',
      'disconnect',
      'getConnectionState',
      'getEvents'
    ], {
      connectionStatus$: wsConnectionStatus$.asObservable()
    });

    mockWebSocketService.getConnectionState.and.returnValue(wsConnectionStatus$.asObservable());
    mockWebSocketService.getEvents.and.returnValue(of({}));
    mockNotificationService.getNotifications.and.returnValue(of(mockNotifications));

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [
        NoopAnimationsModule,
        SharedModule
      ],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: WebSocketService, useValue: mockWebSocketService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize WebSocket connection on init', () => {
    expect(mockWebSocketService.connect).toHaveBeenCalled();
  });

  it('should handle WebSocket connection state changes', fakeAsync(() => {
    wsConnectionStatus$.next(ConnectionState.CONNECTED);
    tick();
    fixture.detectChanges();

    const connectionElement = fixture.debugElement.query(By.css('[data-test="ws-status"]'));
    expect(connectionElement.nativeElement.textContent).toContain('Connected');
  }));

  it('should handle WebSocket reconnection with exponential backoff', fakeAsync(() => {
    mockWebSocketService.connect.calls.reset();
    wsConnectionStatus$.next(ConnectionState.ERROR);
    tick();
    fixture.detectChanges();

    // First retry attempt
    tick(1000);
    expect(mockWebSocketService.connect).toHaveBeenCalledTimes(1);

    // Second retry attempt with exponential backoff
    tick(2000);
    expect(mockWebSocketService.connect).toHaveBeenCalledTimes(2);
  }));

  it('should load and display notifications', fakeAsync(() => {
    notificationsSubject$.next(mockNotifications);
    tick();
    fixture.detectChanges();

    const notificationElements = fixture.debugElement.queryAll(By.css('[data-test="notification-item"]'));
    expect(notificationElements.length).toBe(mockNotifications.length);
  }));

  it('should handle urgent notifications with system notifications', fakeAsync(() => {
    spyOn(window, 'Notification').and.returnValue({});
    const urgentNotification = {
      ...mockNotifications[0],
      priority: NotificationPriority.URGENT
    };

    notificationsSubject$.next([urgentNotification]);
    tick();
    fixture.detectChanges();

    expect(window.Notification).toHaveBeenCalledWith(
      urgentNotification.title,
      jasmine.any(Object)
    );
  }));

  it('should clean up resources on destroy', fakeAsync(() => {
    component.ngOnDestroy();
    expect(mockWebSocketService.disconnect).toHaveBeenCalled();
  }));

  it('should handle WebSocket connection errors', fakeAsync(() => {
    mockWebSocketService.connect.and.throwError('Connection failed');
    
    expect(() => {
      component.ngOnInit();
      tick();
    }).not.toThrow();

    expect(mockWebSocketService.connect).toHaveBeenCalledTimes(1);
  }));

  it('should prioritize notifications by priority', fakeAsync(() => {
    const mixedPriorityNotifications = [
      { ...mockNotifications[0], priority: NotificationPriority.LOW },
      { ...mockNotifications[0], priority: NotificationPriority.HIGH, id: '2' }
    ];

    notificationsSubject$.next(mixedPriorityNotifications);
    tick();
    fixture.detectChanges();

    const notificationElements = fixture.debugElement.queryAll(By.css('[data-test="notification-item"]'));
    expect(notificationElements[0].nativeElement.getAttribute('data-priority')).toBe('HIGH');
  }));

  it('should handle notification read status updates', fakeAsync(() => {
    mockNotificationService.markAsRead.and.returnValue(of([]));
    
    component.markNotificationAsRead('1');
    tick();
    
    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(['1']);
  }));

  it('should maintain WebSocket connection state', fakeAsync(() => {
    const states = [
      ConnectionState.CONNECTING,
      ConnectionState.CONNECTED,
      ConnectionState.ERROR,
      ConnectionState.DISCONNECTED
    ];

    states.forEach(state => {
      wsConnectionStatus$.next(state);
      tick();
      fixture.detectChanges();
      
      const statusElement = fixture.debugElement.query(By.css('[data-test="ws-status"]'));
      expect(statusElement.nativeElement.getAttribute('data-state')).toBe(state);
    });
  }));

  it('should handle maximum retry attempts', fakeAsync(() => {
    mockWebSocketService.connect.calls.reset();
    
    // Simulate multiple connection failures
    for (let i = 0; i < 6; i++) {
      wsConnectionStatus$.next(ConnectionState.ERROR);
      tick(Math.pow(2, i) * 1000);
    }

    expect(mockWebSocketService.connect).toHaveBeenCalledTimes(5); // Max retries
  }));
});