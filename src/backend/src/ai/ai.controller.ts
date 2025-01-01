import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  UseGuards, 
  ValidationPipe, 
  UseInterceptors,
  RateLimit
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger'; // v7.0.0
import { Observable, catchError, retry } from 'rxjs'; // v7.8.0

import { AIService } from './ai.service';
import { AIInsightDTO, InsightType } from './dto/ai-insight.dto';
import { ApiPaginatedResponse, PaginatedDto } from '../common/decorators/api-paginated-response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ThrottleGuard } from '../common/guards/throttle.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { IMetric } from '../analytics/interfaces/metric.interface';

/**
 * Controller handling AI-related endpoints with enhanced security and monitoring
 */
@Controller('ai')
@ApiTags('AI')
@UseGuards(JwtAuthGuard)
@ApiSecurity('bearer')
@UseInterceptors(LoggingInterceptor, MetricsInterceptor)
export class AIController {
  constructor(
    private readonly aiService: AIService
  ) {}

  /**
   * Generates AI insights for SaaS usage optimization
   */
  @Post('insights')
  @ApiOperation({ summary: 'Generate AI insights' })
  @ApiResponse({ 
    status: 201, 
    type: [AIInsightDTO],
    description: 'AI-generated insights for optimization'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input parameters'
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too many requests'
  })
  @RateLimit({ points: 100, duration: 60 })
  @UseGuards(ThrottleGuard)
  async generateInsights(
    @Body(new ValidationPipe({ transform: true })) data: Record<string, any>
  ): Promise<AIInsightDTO[]> {
    try {
      const insights = await this.aiService.generateInsights(data)
        .pipe(
          retry(3),
          catchError(error => {
            throw new Error(`Failed to generate insights: ${error.message}`);
          })
        )
        .toPromise();

      return insights.map(insight => {
        const dto = new AIInsightDTO();
        return dto.toResponse();
      });
    } catch (error) {
      throw new Error(`Insight generation failed: ${error.message}`);
    }
  }

  /**
   * Processes natural language queries using AI assistant
   */
  @Post('query')
  @ApiOperation({ summary: 'Process AI assistant query' })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully processed query'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid query format'
  })
  @RateLimit({ points: 50, duration: 60 })
  @UseGuards(ThrottleGuard)
  async processQuery(
    @Body(new ValidationPipe()) queryData: { query: string; conversationId: string }
  ): Promise<{ response: string; confidence: number }> {
    try {
      const response = await this.aiService.processQuery(
        queryData.query,
        queryData.conversationId
      );

      return {
        response,
        confidence: 0.95 // Mock confidence score
      };
    } catch (error) {
      throw new Error(`Query processing failed: ${error.message}`);
    }
  }

  /**
   * Detects and retrieves usage pattern anomalies
   */
  @Get('anomalies')
  @ApiPaginatedResponse(AIInsightDTO)
  @ApiOperation({ summary: 'Get usage anomalies' })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid parameters'
  })
  @RateLimit({ points: 150, duration: 60 })
  @UseGuards(ThrottleGuard)
  async getAnomalies(
    @Query(new ValidationPipe({ transform: true })) 
    queryOptions: { page: number; pageSize: number }
  ): Promise<PaginatedDto<AIInsightDTO>> {
    try {
      const metrics: IMetric[] = []; // Mock metrics data
      const anomalies = await this.aiService.detectAnomalies(metrics);
      
      const insights = anomalies.map(anomaly => {
        const insight = new AIInsightDTO();
        insight.type = InsightType.USAGE_PATTERN;
        // Map other properties...
        return insight;
      });

      return new PaginatedDto<AIInsightDTO>({
        data: insights,
        page: queryOptions.page,
        pageSize: queryOptions.pageSize,
        totalItems: insights.length
      });
    } catch (error) {
      throw new Error(`Anomaly detection failed: ${error.message}`);
    }
  }
}