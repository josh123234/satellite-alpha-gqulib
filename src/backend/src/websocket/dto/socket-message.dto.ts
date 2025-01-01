import { IsString, IsEnum, IsOptional, IsNotEmpty, ValidateNested, MaxLength } from 'class-validator'; // ^0.14.0
import { Transform } from 'class-transformer'; // ^0.5.1
import { SocketEventType } from '../interfaces/socket-event.interface';

/**
 * Data Transfer Object for WebSocket messages with comprehensive validation
 * and security measures. Implements strict type checking and sanitization
 * for all real-time communication between server and clients.
 */
export class SocketMessageDto {
  /**
   * Unique identifier for the WebSocket room/channel
   * Limited to 50 chars for security, trimmed for consistency
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value.trim())
  roomId: string;

  /**
   * Type of WebSocket event being transmitted
   * Must match one of the predefined event types
   */
  @IsEnum(SocketEventType)
  @IsNotEmpty()
  type: SocketEventType;

  /**
   * Event-specific payload data
   * Optional but must be validated when present
   */
  @IsOptional()
  @ValidateNested()
  @Transform(({ value }) => {
    // Sanitize payload by removing any undefined or null values
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).filter(([_, v]) => v !== undefined && v !== null)
      );
    }
    return value;
  })
  payload?: Record<string, any>;

  /**
   * API version for backward compatibility
   * Optional, limited to 10 chars for version string
   */
  @IsString()
  @IsOptional()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim())
  version?: string;
}