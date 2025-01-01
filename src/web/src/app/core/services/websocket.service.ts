import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { 
  Subject, 
  Observable, 
  BehaviorSubject, 
  timer, 
  of, 
  EMPTY 
} from 'rxjs';
import { 
  webSocket, 
  WebSocketSubject 
} from 'rxjs/webSocket';
import { 
  retryWhen, 
  delay, 
  takeUntil, 
  catchError,
  filter 
} from 'rxjs/operators';

import { 
  SocketEvent, 
  SocketEventType 
} from '../../../../backend/src/websocket/interfaces/socket-event.interface';
import { environment } from '../../../../environments/environment';

/**
 * Enum representing possible WebSocket connection states
 */
export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  CONNECTING = 'CONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

/**
 * Service responsible for managing WebSocket connections with enhanced reliability features
 * including automatic reconnection, heartbeat mechanism, and comprehensive error handling.
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocketSubject<SocketEvent>;
  private eventSubject = new Subject<SocketEvent>();
  private connectionStateSubject = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
  private destroySubject = new Subject<void>();
  private reconnectAttempts = 0;
  private messageQueue: SocketEvent[] = [];

  // Configuration constants
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000; // 5 seconds
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds

  constructor(private store: Store) {}

  /**
   * Establishes WebSocket connection with automatic reconnection and heartbeat
   */
  public connect(): void {
    if (this.socket) {
      return;
    }

    this.connectionStateSubject.next(ConnectionState.CONNECTING);

    this.socket = webSocket({
      url: `${environment.wsUrl}?version=${environment.wsVersion}`,
      openObserver: {
        next: () => {
          this.connectionStateSubject.next(ConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          this.processMessageQueue();
          this.setupHeartbeat();
        }
      },
      closeObserver: {
        next: () => {
          this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
          this.handleReconnection();
        }
      }
    });

    this.socket.pipe(
      takeUntil(this.destroySubject),
      catchError(error => {
        console.error('WebSocket error:', error);
        this.connectionStateSubject.next(ConnectionState.ERROR);
        return EMPTY;
      }),
      filter(event => this.validateEvent(event))
    ).subscribe(
      (event: SocketEvent) => {
        if (event.type === SocketEventType.HEARTBEAT) {
          return; // Handle heartbeat separately
        }
        this.eventSubject.next(event);
      }
    );

    // Setup connection timeout
    timer(this.CONNECTION_TIMEOUT).pipe(
      takeUntil(this.connectionStateSubject.pipe(
        filter(state => state === ConnectionState.CONNECTED)
      ))
    ).subscribe(() => {
      if (this.connectionStateSubject.value === ConnectionState.CONNECTING) {
        this.handleConnectionTimeout();
      }
    });
  }

  /**
   * Safely closes the WebSocket connection and cleans up resources
   */
  public disconnect(): void {
    this.destroySubject.next();
    this.destroySubject.complete();
    this.eventSubject.complete();
    
    if (this.socket) {
      this.socket.complete();
      this.socket = null;
    }
    
    this.reconnectAttempts = 0;
    this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
  }

  /**
   * Sends a message through WebSocket with error handling and queuing
   */
  public send(event: SocketEvent): void {
    if (!this.validateEvent(event)) {
      console.error('Invalid event format:', event);
      return;
    }

    if (this.connectionStateSubject.value !== ConnectionState.CONNECTED) {
      this.messageQueue.push(event);
      return;
    }

    this.socket.next(event);
  }

  /**
   * Returns an observable of WebSocket events
   */
  public getEvents(): Observable<SocketEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Returns an observable of the connection state
   */
  public getConnectionState(): Observable<ConnectionState> {
    return this.connectionStateSubject.asObservable();
  }

  /**
   * Validates the event format and version
   */
  private validateEvent(event: SocketEvent): boolean {
    return event &&
           typeof event.type === 'string' &&
           Object.values(SocketEventType).includes(event.type as SocketEventType) &&
           event.version === environment.wsVersion;
  }

  /**
   * Implements heartbeat mechanism for connection monitoring
   */
  private setupHeartbeat(): void {
    timer(0, this.HEARTBEAT_INTERVAL)
      .pipe(takeUntil(this.destroySubject))
      .subscribe(() => {
        this.send({
          type: SocketEventType.HEARTBEAT,
          payload: { timestamp: new Date().toISOString() },
          timestamp: new Date(),
          version: environment.wsVersion
        });
      });
  }

  /**
   * Manages reconnection attempts with exponential backoff
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.connectionStateSubject.next(ConnectionState.ERROR);
      return;
    }

    const backoffTime = Math.min(
      this.RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;
    
    timer(backoffTime)
      .pipe(takeUntil(this.destroySubject))
      .subscribe(() => {
        this.connect();
      });
  }

  /**
   * Handles connection timeout
   */
  private handleConnectionTimeout(): void {
    this.disconnect();
    this.handleReconnection();
  }

  /**
   * Processes queued messages after reconnection
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      this.send(event);
    }
  }
}