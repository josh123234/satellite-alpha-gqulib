import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { LangChain } from 'langchain'; // ^0.1.0
import { Observable } from 'rxjs'; // ^7.8.0
import { AIModel } from '../interfaces/model.interface';
import { aiConfig } from '../../config/ai.config';

@Injectable()
export class LangChainService implements AIModel {
  private readonly logger = new Logger(LangChainService.name);
  private model: LangChain;
  private config = aiConfig.langchain;
  private conversationHistory: Map<string, Array<{ role: string; content: string; timestamp: Date }>> = new Map();
  private readonly maxHistorySize = 50;
  private readonly maxTokens = this.config.maxTokens;
  private readonly retryAttempts = this.config.retryConfig.maxRetries;

  constructor() {
    this.logger.log('Initializing LangChain service');
    this.setupCleanupInterval();
  }

  private setupCleanupInterval(): void {
    // Cleanup old conversations every hour
    setInterval(() => {
      this.cleanupOldConversations();
    }, 3600000);
  }

  private cleanupOldConversations(): void {
    const now = new Date();
    for (const [id, history] of this.conversationHistory.entries()) {
      const lastMessage = history[history.length - 1];
      if (lastMessage && (now.getTime() - lastMessage.timestamp.getTime()) > 24 * 3600000) {
        this.conversationHistory.delete(id);
        this.logger.debug(`Cleaned up conversation ${id} due to inactivity`);
      }
    }
  }

  async initialize(): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('LangChain API key not configured');
      }

      let retries = 0;
      while (retries < this.retryAttempts) {
        try {
          this.model = new LangChain({
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            contextWindow: this.config.contextWindow
          });

          // Warm up the model with a test prompt
          await this.model.predict('Test connection');
          this.logger.log('LangChain model initialized successfully');
          return;
        } catch (error) {
          retries++;
          if (retries === this.retryAttempts) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, this.config.retryConfig.retryDelay));
        }
      }
    } catch (error) {
      this.logger.error(`Failed to initialize LangChain model: ${error.message}`);
      throw error;
    }
  }

  async generateInsight(data: Record<string, any>): Promise<string> {
    try {
      if (!this.model) {
        await this.initialize();
      }

      const formattedData = this.formatDataForInsight(data);
      const prompt = this.buildInsightPrompt(formattedData);

      const response = await this.model.predict(prompt, {
        maxTokens: this.maxTokens,
        temperature: this.config.temperature
      });

      return this.sanitizeResponse(response);
    } catch (error) {
      this.logger.error(`Error generating insight: ${error.message}`);
      throw new Error('Failed to generate insight');
    }
  }

  private formatDataForInsight(data: Record<string, any>): string {
    return JSON.stringify(data, null, 2);
  }

  private buildInsightPrompt(data: string): string {
    return `
      As a SaaS management assistant, analyze the following data and provide actionable insights:
      ${data}
      Focus on cost optimization, usage patterns, and potential risks.
    `;
  }

  async processUserQuery(query: string, conversationId: string): Promise<string> {
    try {
      if (!this.model) {
        await this.initialize();
      }

      if (!query || !conversationId) {
        throw new Error('Query and conversation ID are required');
      }

      let history = this.conversationHistory.get(conversationId) || [];
      history = this.truncateHistory(history);

      const contextualPrompt = this.buildContextualPrompt(query, history);
      const response = await this.model.predict(contextualPrompt, {
        maxTokens: this.maxTokens,
        temperature: this.config.temperature
      });

      const sanitizedResponse = this.sanitizeResponse(response);
      
      // Update conversation history
      history.push(
        { role: 'user', content: query, timestamp: new Date() },
        { role: 'assistant', content: sanitizedResponse, timestamp: new Date() }
      );
      this.conversationHistory.set(conversationId, history);

      return sanitizedResponse;
    } catch (error) {
      this.logger.error(`Error processing query: ${error.message}`);
      throw new Error('Failed to process user query');
    }
  }

  private truncateHistory(history: Array<{ role: string; content: string; timestamp: Date }>): Array<{ role: string; content: string; timestamp: Date }> {
    if (history.length > this.maxHistorySize) {
      return history.slice(-this.maxHistorySize);
    }
    return history;
  }

  private buildContextualPrompt(query: string, history: Array<{ role: string; content: string; timestamp: Date }>): string {
    const contextualHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    return `
      ${this.config.assistantPrompt}
      
      Previous conversation:
      ${contextualHistory}
      
      User: ${query}
      Assistant:
    `;
  }

  private sanitizeResponse(response: string): string {
    // Remove any potential unsafe content or formatting issues
    return response
      .trim()
      .replace(/```/g, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  async clearConversation(conversationId: string): Promise<void> {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      this.conversationHistory.delete(conversationId);
      this.logger.debug(`Cleared conversation history for ${conversationId}`);
    } catch (error) {
      this.logger.error(`Error clearing conversation: ${error.message}`);
      throw new Error('Failed to clear conversation');
    }
  }

  // Implementing required AIModel interface methods
  async predict(input: any): Promise<any> {
    return this.processUserQuery(input.query, input.conversationId);
  }

  train(): Observable<any> {
    throw new Error('Training is not supported for LangChain models');
  }

  evaluate(): Promise<any> {
    throw new Error('Evaluation is not supported for LangChain models');
  }
}