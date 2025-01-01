import { Module } from '@nestjs/common'; // v10.0.0

// Import controllers
import { AIController } from './ai.controller';

// Import services
import { AIService } from './ai.service';
import { LangChainService } from './services/langchain.service';
import { TensorFlowService } from './services/tensorflow.service';
import { PyTorchService } from './services/pytorch.service';

/**
 * AIModule configures and orchestrates AI-related services, controllers and dependencies
 * for the SaaS Management Platform's AI capabilities. Implements a modular architecture
 * for AI functionality including SaaS discovery, usage analysis, cost optimization,
 * and conversational assistance.
 * 
 * Key capabilities:
 * - AI-powered SaaS discovery through payment and email analysis
 * - Usage pattern detection and anomaly identification
 * - Intelligent cost optimization recommendations
 * - Natural language processing for conversational AI
 * - Contract analysis and document processing
 */
@Module({
  imports: [], // No additional module imports required
  controllers: [
    AIController // Handles AI-related HTTP endpoints
  ],
  providers: [
    // Core AI orchestration service
    AIService,
    
    // Specialized AI service providers
    LangChainService, // Natural language processing and conversational AI
    TensorFlowService, // Contract analysis and document processing
    PyTorchService // Usage pattern detection and anomaly identification
  ],
  exports: [
    // Export services for use in other modules
    AIService,
    LangChainService,
    TensorFlowService,
    PyTorchService
  ]
})
export class AIModule {}