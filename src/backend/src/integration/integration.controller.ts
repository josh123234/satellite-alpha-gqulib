// @nestjs/common version ^10.0.0
import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Logger,
  HttpStatus,
  HttpException
} from '@nestjs/common';

// @nestjs/swagger version ^7.0.0
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody
} from '@nestjs/swagger';

// @nestjs/throttler version ^5.0.0
import { RateLimit } from '@nestjs/throttler';

import { IntegrationService } from './integration.service';
import { ProviderType, ConnectionStatus } from './interfaces/provider.interface';

// DTOs for request/response handling
class CreateIntegrationDto {
  providerType: ProviderType;
  credentials: Record<string, string>;
  options?: {
    timeout?: number;
    retryAttempts?: number;
    poolSize?: number;
  };
}

class IntegrationResponseDto {
  success: boolean;
  provider: ProviderType;
  status: ConnectionStatus;
  metrics: {
    connectionTime: number;
    retryCount: number;
  };
}

class HealthCheckResponseDto {
  provider: ProviderType;
  status: ConnectionStatus;
  lastCheck: Date;
  metrics: {
    latency: number;
    errorRate: number;
    availability: number;
  };
}

@Controller('integrations')
@ApiTags('integrations')
@ApiSecurity('bearer')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Post('connect')
  @ApiOperation({ summary: 'Connect to integration provider' })
  @ApiBody({ type: CreateIntegrationDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Successfully connected to provider',
    type: IntegrationResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid request parameters' 
  })
  @ApiResponse({ 
    status: HttpStatus.TOO_MANY_REQUESTS, 
    description: 'Rate limit exceeded' 
  })
  @RateLimit({ ttl: 60, limit: 5 })
  async connectProvider(
    @Body() createIntegrationDto: CreateIntegrationDto
  ): Promise<IntegrationResponseDto> {
    try {
      this.logger.log(`Attempting to connect to provider: ${createIntegrationDto.providerType}`);
      
      const result = await this.integrationService
        .connectProvider(
          createIntegrationDto.providerType,
          createIntegrationDto.credentials,
          createIntegrationDto.options
        )
        .toPromise();

      return result;
    } catch (error) {
      this.logger.error(`Failed to connect to provider: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to connect to provider',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('disconnect/:providerType')
  @ApiOperation({ summary: 'Disconnect from integration provider' })
  @ApiParam({ name: 'providerType', enum: ProviderType })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Successfully disconnected from provider' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Provider not found' 
  })
  @RateLimit({ ttl: 60, limit: 5 })
  async disconnectProvider(
    @Param('providerType') providerType: ProviderType
  ): Promise<void> {
    try {
      this.logger.log(`Disconnecting from provider: ${providerType}`);
      await this.integrationService.disconnectProvider(providerType, true).toPromise();
    } catch (error) {
      this.logger.error(`Failed to disconnect from provider: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to disconnect from provider',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status/:providerType')
  @ApiOperation({ summary: 'Get provider connection status' })
  @ApiParam({ name: 'providerType', enum: ProviderType })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Successfully retrieved provider status',
    type: IntegrationResponseDto 
  })
  @RateLimit({ ttl: 60, limit: 10 })
  async getProviderStatus(
    @Param('providerType') providerType: ProviderType
  ): Promise<IntegrationResponseDto> {
    try {
      return await this.integrationService.getProviderStatus(providerType).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get provider status: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to get provider status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health/:providerType')
  @ApiOperation({ summary: 'Check provider health status' })
  @ApiParam({ name: 'providerType', enum: ProviderType })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Successfully retrieved health status',
    type: HealthCheckResponseDto 
  })
  @RateLimit({ ttl: 60, limit: 10 })
  async checkProviderHealth(
    @Param('providerType') providerType: ProviderType
  ): Promise<HealthCheckResponseDto> {
    try {
      return await this.integrationService
        .monitorProviderHealth(providerType)
        .toPromise();
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Health check failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('metrics/:providerType')
  @ApiOperation({ summary: 'Get provider performance metrics' })
  @ApiParam({ name: 'providerType', enum: ProviderType })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Successfully retrieved provider metrics' 
  })
  @RateLimit({ ttl: 60, limit: 10 })
  async getProviderMetrics(
    @Param('providerType') providerType: ProviderType
  ): Promise<any> {
    try {
      return await this.integrationService
        .getProviderMetrics(providerType)
        .toPromise();
    } catch (error) {
      this.logger.error(`Failed to get provider metrics: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to get provider metrics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}