import { WebSocketGateway, SubscribeMessage, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'; // ^10.0.0
import { UseGuards, Logger } from '@nestjs/common'; // ^10.0.0
import { Server, Socket } from 'socket.io'; // ^4.0.0
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocketEvent, SocketEventType } from './interfaces/socket-event.interface';
import { SocketMessageDto } from './dto/socket-message.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * WebSocket Gateway implementation for real-time communication in the SaaS Management Platform.
 * Implements secure event handling, rate limiting, and room-based access control.
 */
@WebSocketGateway({
  cors: true,
  namespace: '/events',
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
})
@UseGuards(JwtAuthGuard)
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly rooms: Map<string, Set<string>> = new Map();
  private readonly clientRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly logger = new Logger('WebsocketGateway');

  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;

  /**
   * Handles new WebSocket client connections with security validation
   * @param client Connected socket client
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract and validate JWT payload
      const payload = client.handshake.auth.token as JwtPayload;
      if (!this.validateClientCredentials(payload)) {
        this.logger.warn(`Invalid credentials for client ${client.id}`);
        client.disconnect(true);
        return;
      }

      // Initialize rate limiting
      this.clientRateLimits.set(client.id, {
        count: 0,
        resetTime: Date.now() + this.RATE_LIMIT_WINDOW
      });

      // Add client to organization room
      const orgRoom = `org_${payload.organizationId}`;
      this.joinRoom(client, orgRoom);

      this.logger.log(`Client ${client.id} connected to organization ${payload.organizationId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect(true);
    }
  }

  /**
   * Handles client disconnections with cleanup
   * @param client Disconnected socket client
   */
  async handleDisconnect(client: Socket): Promise<void> {
    try {
      // Clean up client resources
      this.clientRateLimits.delete(client.id);
      this.leaveAllRooms(client);
      
      this.logger.log(`Client ${client.id} disconnected`);
    } catch (error) {
      this.logger.error(`Disconnection error: ${error.message}`, error.stack);
    }
  }

  /**
   * Handles subscription update events
   * @param client Socket client
   * @param message Event message
   */
  @SubscribeMessage(SocketEventType.SUBSCRIPTION_UPDATED)
  async handleSubscriptionUpdate(client: Socket, message: SocketMessageDto): Promise<void> {
    try {
      if (!this.checkRateLimit(client.id)) {
        this.logger.warn(`Rate limit exceeded for client ${client.id}`);
        client.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      // Validate message and room access
      if (!this.validateRoomAccess(client, message.roomId)) {
        this.logger.warn(`Unauthorized room access attempt by client ${client.id}`);
        return;
      }

      const event: SocketEvent = {
        type: message.type,
        payload: message.payload,
        version: message.version || '1.0',
        timestamp: new Date()
      };

      // Broadcast to room members
      this.server.to(message.roomId).emit(message.type, event);
      
      this.logger.debug(`Broadcast ${message.type} to room ${message.roomId}`);
    } catch (error) {
      this.logger.error(`Event handling error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to process event' });
    }
  }

  /**
   * Handles usage alert events
   * @param client Socket client
   * @param message Event message
   */
  @SubscribeMessage(SocketEventType.USAGE_ALERT)
  async handleUsageAlert(client: Socket, message: SocketMessageDto): Promise<void> {
    try {
      if (!this.checkRateLimit(client.id)) {
        return;
      }

      const event: SocketEvent = {
        type: message.type,
        payload: message.payload,
        version: message.version || '1.0',
        timestamp: new Date()
      };

      this.server.to(message.roomId).emit(message.type, event);
    } catch (error) {
      this.logger.error(`Usage alert error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to process usage alert' });
    }
  }

  /**
   * Handles AI insight events
   * @param client Socket client
   * @param message Event message
   */
  @SubscribeMessage(SocketEventType.AI_INSIGHT)
  async handleAIInsight(client: Socket, message: SocketMessageDto): Promise<void> {
    try {
      if (!this.checkRateLimit(client.id)) {
        return;
      }

      const event: SocketEvent = {
        type: message.type,
        payload: message.payload,
        version: message.version || '1.0',
        timestamp: new Date()
      };

      this.server.to(message.roomId).emit(message.type, event);
    } catch (error) {
      this.logger.error(`AI insight error: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to process AI insight' });
    }
  }

  /**
   * Validates client credentials
   * @param payload JWT payload
   * @returns boolean indicating validity
   */
  private validateClientCredentials(payload: JwtPayload): boolean {
    return !!(
      payload &&
      payload.sub &&
      payload.organizationId &&
      payload.roles &&
      payload.exp > Date.now() / 1000
    );
  }

  /**
   * Checks rate limiting for client
   * @param clientId Client identifier
   * @returns boolean indicating if request is allowed
   */
  private checkRateLimit(clientId: string): boolean {
    const limit = this.clientRateLimits.get(clientId);
    if (!limit) return false;

    const now = Date.now();
    if (now > limit.resetTime) {
      this.clientRateLimits.set(clientId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (limit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Adds client to room
   * @param client Socket client
   * @param roomId Room identifier
   */
  private joinRoom(client: Socket, roomId: string): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(client.id);
    client.join(roomId);
  }

  /**
   * Removes client from all rooms
   * @param client Socket client
   */
  private leaveAllRooms(client: Socket): void {
    for (const [roomId, clients] of this.rooms.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        client.leave(roomId);
        if (clients.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }
  }

  /**
   * Validates client's access to room
   * @param client Socket client
   * @param roomId Room identifier
   * @returns boolean indicating if access is allowed
   */
  private validateRoomAccess(client: Socket, roomId: string): boolean {
    const payload = client.handshake.auth.token as JwtPayload;
    return roomId.startsWith(`org_${payload.organizationId}`);
  }
}