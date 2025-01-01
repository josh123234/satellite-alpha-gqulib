import * as tf from '@tensorflow/tfjs-node'; // v4.10.0
import { Injectable } from '@nestjs/common'; // v10.0.0
import { Observable, Subject } from 'rxjs'; // v7.8.0
import { AIModel, ModelConfig, ModelMetrics, TrainingOptions, PredictionOptions, PredictionResult } from '../interfaces/model.interface';
import { aiConfig } from '../../config/ai.config';

/**
 * Interface for model loading options
 */
interface LoadOptions {
  useGPU?: boolean;
  memoryLimit?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Interface for model cache entry
 */
interface ModelCacheEntry {
  model: tf.LayersModel;
  lastUsed: Date;
  memoryUsage: number;
}

/**
 * Service providing comprehensive TensorFlow.js functionality for AI model operations
 */
@Injectable()
export class TensorFlowService implements AIModel {
  private models: Map<string, ModelCacheEntry> = new Map();
  private readonly config = aiConfig.tensorflow;
  private readonly modelMetrics: Map<string, ModelMetrics> = new Map();
  private readonly memoryLimit: number = 0.9 * tf.engine().memory().maxBytes;
  private readonly cleanupInterval: number = 300000; // 5 minutes

  constructor() {
    this.initializeTensorFlow();
    this.setupMemoryManagement();
  }

  /**
   * Initializes TensorFlow backend with GPU support if available
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      await tf.setBackend('tensorflow');
      if (tf.getBackend() === 'tensorflow') {
        console.log('TensorFlow.js initialized with TensorFlow backend');
      }
    } catch (error) {
      console.warn('GPU acceleration not available, falling back to CPU', error);
      await tf.setBackend('cpu');
    }
  }

  /**
   * Sets up periodic memory management for model cache
   */
  private setupMemoryManagement(): void {
    setInterval(() => {
      this.cleanupUnusedModels();
    }, this.cleanupInterval);
  }

  /**
   * Removes least recently used models when memory usage is high
   */
  private cleanupUnusedModels(): void {
    const currentMemory = tf.memory().numBytes;
    if (currentMemory > this.memoryLimit * 0.8) {
      const entries = Array.from(this.models.entries());
      entries.sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());
      
      for (const [modelId, entry] of entries) {
        if (tf.memory().numBytes < this.memoryLimit * 0.7) break;
        entry.model.dispose();
        this.models.delete(modelId);
      }
    }
  }

  /**
   * Loads a TensorFlow model with retry logic and memory management
   */
  public async loadModel(modelPath: string, options: LoadOptions = {}): Promise<tf.LayersModel> {
    const {
      useGPU = true,
      memoryLimit = this.memoryLimit,
      retryAttempts = 3,
      retryDelay = 1000
    } = options;

    if (this.models.has(modelPath)) {
      const entry = this.models.get(modelPath)!;
      entry.lastUsed = new Date();
      return entry.model;
    }

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const model = await tf.loadLayersModel(`file://${modelPath}`);
        
        const modelMemory = this.estimateModelMemory(model);
        if (modelMemory > memoryLimit) {
          throw new Error('Model exceeds memory limit');
        }

        this.models.set(modelPath, {
          model,
          lastUsed: new Date(),
          memoryUsage: modelMemory
        });

        return model;
      } catch (error) {
        if (attempt === retryAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error('Failed to load model after maximum retry attempts');
  }

  /**
   * Estimates memory usage of a model
   */
  private estimateModelMemory(model: tf.LayersModel): number {
    return model.weights.reduce((total, weight) => {
      return total + tf.util.sizeFromShape(weight.shape) * 4; // 4 bytes per float32
    }, 0);
  }

  /**
   * Implements AIModel interface initialize method
   */
  public async initialize(config: ModelConfig): Promise<void> {
    await this.loadModel(config.modelPath, {
      useGPU: config.deviceConfig?.deviceType === 'gpu',
      memoryLimit: config.deviceConfig?.memoryLimit
    });
  }

  /**
   * Implements AIModel interface train method
   */
  public train(
    data: tf.Tensor | tf.Tensor[],
    labels: tf.Tensor,
    options: TrainingOptions = {}
  ): Observable<ModelMetrics> {
    const metricsSubject = new Subject<ModelMetrics>();
    
    const {
      batchSize = this.config.contractAnalysis.batchSize,
      epochs = 10,
      validationSplit = 0.2,
      earlyStoppingPatience = 5
    } = options;

    (async () => {
      try {
        const model = await this.loadModel(this.config.contractAnalysis.modelName);
        
        await model.fit(data, labels, {
          batchSize,
          epochs,
          validationSplit,
          callbacks: {
            onEpochEnd: (epoch, logs: any) => {
              const metrics: ModelMetrics = {
                accuracy: logs.acc,
                loss: logs.loss,
                precision: logs.precision,
                recall: logs.recall,
                f1Score: logs.f1,
                timestamp: new Date()
              };
              metricsSubject.next(metrics);
              this.modelMetrics.set(model.name, metrics);
            }
          }
        });

        metricsSubject.complete();
      } catch (error) {
        metricsSubject.error(error);
      }
    })();

    return metricsSubject.asObservable();
  }

  /**
   * Implements AIModel interface predict method
   */
  public async predict(input: tf.Tensor, options: PredictionOptions = {}): Promise<PredictionResult> {
    const model = await this.loadModel(this.config.contractAnalysis.modelName);
    
    const prediction = model.predict(input) as tf.Tensor;
    const confidence = tf.max(prediction as tf.Tensor).dataSync()[0];

    return {
      prediction: await prediction.array(),
      confidence,
      metadata: options.includeMetadata ? {
        modelName: model.name,
        timestamp: new Date(),
        inputShape: input.shape
      } : undefined,
      timestamp: new Date()
    };
  }

  /**
   * Saves model to specified path
   */
  public async saveModel(model: tf.LayersModel, path: string): Promise<void> {
    await model.save(`file://${path}`);
  }

  /**
   * Cleanup resources on service destruction
   */
  public async onModuleDestroy() {
    for (const entry of this.models.values()) {
      entry.model.dispose();
    }
    this.models.clear();
    tf.dispose();
  }
}