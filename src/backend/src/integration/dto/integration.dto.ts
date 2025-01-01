// class-validator version 0.14.x - Validation decorators for DTO properties
import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

// Internal imports for provider type definitions
import { ProviderType } from '../interfaces/provider.interface';

/**
 * Data Transfer Object for creating new integration connections.
 * Implements comprehensive validation for provider type and credentials.
 */
export class CreateIntegrationDto {
    /**
     * Type of the integration provider (e.g., GOOGLE_WORKSPACE, QUICKBOOKS, STRIPE)
     * Must be a valid value from the ProviderType enum
     */
    @IsEnum(ProviderType)
    providerType: ProviderType;

    /**
     * Integration credentials object containing OAuth tokens or API keys
     * Structure varies based on the provider type:
     * - GOOGLE_WORKSPACE: { clientId, clientSecret, refreshToken }
     * - QUICKBOOKS: { clientId, clientSecret, realmId }
     * - STRIPE: { apiKey, webhookSecret }
     */
    @IsObject()
    credentials: Record<string, string>;
}

/**
 * Data Transfer Object for updating existing integration configurations.
 * Supports partial updates with optional fields.
 */
export class UpdateIntegrationDto {
    /**
     * Updated credentials for the integration
     * Only provided fields will be updated, maintaining existing values for others
     */
    @IsObject()
    @IsOptional()
    credentials?: Record<string, string>;
}

/**
 * Data Transfer Object for standardized integration operation responses.
 * Provides consistent structure for integration status and results.
 */
export class IntegrationResponseDto {
    /**
     * Type of the integration provider associated with the response
     */
    @IsEnum(ProviderType)
    providerType: ProviderType;

    /**
     * Current status of the integration connection
     * Examples: "CONNECTED", "ERROR", "CONNECTING"
     */
    @IsString()
    connectionStatus: string;

    /**
     * Optional message providing additional context about the operation
     * Examples: "Successfully connected", "Authentication failed"
     */
    @IsString()
    @IsOptional()
    message?: string;
}