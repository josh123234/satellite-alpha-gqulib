import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ViewChild, 
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  Subject, 
  BehaviorSubject, 
  takeUntil, 
  catchError, 
  retry, 
  debounceTime,
  distinctUntilChanged
} from 'rxjs';
import { Store, select } from '@ngrx/store';

import { AiService, IAIInsightResponse, AIErrorType } from '../../../../core/services/ai.service';
import { WebSocketService, ConnectionState } from '../../../../core/services/websocket.service';
import { SocketEvent, SocketEventType, AIInsightEvent } from '../../../../backend/src/websocket/interfaces/socket-event.interface';

interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
  insights?: IAIInsightResponse[];
}

@Component({
  selector: 'app-chat-interface',
  templateUrl: './chat-interface.component.html',
  styleUrls: ['./chat-interface.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatInterfaceComponent implements OnInit, OnDestroy {
  @ViewChild('chatContainer', { static: true }) chatContainer: ElementRef;

  public chatForm: FormGroup;
  public messages$ = new BehaviorSubject<ChatMessage[]>([]);
  public isTyping$ = new BehaviorSubject<boolean>(false);
  public error$ = new BehaviorSubject<Error | null>(null);
  public connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);

  private readonly destroy$ = new Subject<void>();
  private readonly messageCache = new Map<string, ChatMessage>();
  private readonly MAX_RETRIES = 3;
  private readonly TYPING_TIMEOUT = 1000;
  private readonly MAX_MESSAGE_LENGTH = 500;

  constructor(
    private fb: FormBuilder,
    private aiService: AiService,
    private wsService: WebSocketService,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
    this.setupWebSocket();
  }

  private initializeForm(): void {
    this.chatForm = this.fb.group({
      message: ['', [
        Validators.required,
        Validators.maxLength(this.MAX_MESSAGE_LENGTH),
        Validators.pattern(/^[a-zA-Z0-9\s.,!?'"-]+$/)
      ]]
    });
  }

  ngOnInit(): void {
    // Subscribe to WebSocket connection state
    this.wsService.getConnectionState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.connectionState$.next(state);
        this.cdr.markForCheck();
      });

    // Subscribe to WebSocket events
    this.wsService.getEvents()
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(),
        catchError(error => {
          this.handleError(error);
          return [];
        })
      )
      .subscribe(event => this.handleWebSocketEvent(event));

    // Monitor form changes for typing indicator
    this.chatForm.get('message').valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(this.TYPING_TIMEOUT)
      )
      .subscribe(() => {
        this.isTyping$.next(false);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
    this.clearMessageCache();
  }

  public async sendMessage(): Promise<void> {
    if (this.chatForm.invalid || this.isTyping$.value) {
      return;
    }

    const messageContent = this.chatForm.get('message').value.trim();
    const messageId = crypto.randomUUID();

    const message: ChatMessage = {
      id: messageId,
      content: messageContent,
      type: 'user',
      timestamp: new Date(),
      status: 'sending'
    };

    try {
      // Add message to UI immediately
      this.updateMessages(message);
      this.chatForm.reset();

      // Send via WebSocket
      this.wsService.send({
        type: SocketEventType.USER_ACTION,
        payload: {
          content: messageContent,
          messageId
        },
        timestamp: new Date(),
        version: '1.0'
      });

      // Request AI insights
      const insights = await this.requestAIInsights(messageContent);
      this.handleAIResponse(messageId, insights);
    } catch (error) {
      this.handleError(error);
      message.status = 'error';
      this.updateMessages(message);
    }
  }

  private async requestAIInsights(content: string): Promise<IAIInsightResponse[]> {
    return this.aiService.getInsights({
      type: 'CHAT_RESPONSE',
      subscriptionId: 'global',
      timeframe: 30,
      filters: { messageContent: content },
      options: {
        confidence: 0.8,
        maxRecommendations: 3,
        includeMetadata: true
      }
    })
    .pipe(
      retry(this.MAX_RETRIES),
      catchError(error => {
        throw new Error(JSON.stringify({
          type: AIErrorType.API,
          message: 'Failed to get AI insights'
        }));
      })
    )
    .toPromise();
  }

  private handleAIResponse(messageId: string, insights: IAIInsightResponse[]): void {
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: this.formatInsightsResponse(insights),
      type: 'ai',
      timestamp: new Date(),
      status: 'sent',
      insights
    };

    this.updateMessages(aiMessage);
    this.scrollToBottom();
  }

  private formatInsightsResponse(insights: IAIInsightResponse[]): string {
    return insights
      .map(insight => `${insight.title}\n${insight.description}`)
      .join('\n\n');
  }

  private handleWebSocketEvent(event: SocketEvent): void {
    switch (event.type) {
      case SocketEventType.AI_INSIGHT:
        this.handleAIInsightEvent(event.payload as AIInsightEvent);
        break;
      // Handle other event types as needed
    }
  }

  private handleAIInsightEvent(insight: AIInsightEvent): void {
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: insight.recommendation,
      type: 'ai',
      timestamp: new Date(),
      status: 'sent'
    };
    this.updateMessages(aiMessage);
  }

  private updateMessages(message: ChatMessage): void {
    const currentMessages = this.messages$.value;
    this.messageCache.set(message.id, message);
    this.messages$.next([...currentMessages, message]);
    this.cdr.markForCheck();
  }

  private setupWebSocket(): void {
    this.wsService.connect();
  }

  private handleError(error: any): void {
    console.error('Chat interface error:', error);
    this.error$.next(error);
    this.cdr.markForCheck();
  }

  private clearMessageCache(): void {
    this.messageCache.clear();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }, 0);
  }
}