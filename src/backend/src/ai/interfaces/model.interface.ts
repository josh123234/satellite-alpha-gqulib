import { Observable } from 'rxjs'; // v7.8.0

/**
 * Supported AI frameworks for model implementations
 */
export enum AIFramework {
  TENSORFLOW = 'tensorflow',
  PYTORCH = 'pytorch'
}

/**
 * Supported model types in the system
 */
export enum ModelType {
  CONTRACT_ANALYSIS = 'contract_analysis',
  USAGE_PATTERN = 'usage_pattern',
  SAAS_CLASSIFICATION = 'saas_classification'
}

/**
 * Device configuration for model execution
 */
export interface DeviceConfig {
  deviceType: 'cpu' | 'gpu';
  deviceId?: number;
  memoryLimit?: number;
  parallelization?: boolean;
}

/**
 * Optimizer configuration for model training
 */
export interface OptimizerConfig {
  type: string;
  learningRate: number;
  momentum?: number;
  weightDecay?: number;
  beta1?: number;
  beta2?: number;
}

/**
 * Training options for model training process
 */
export interface TrainingOptions {
  batchSize?: number;
  epochs?: number;
  validationSplit?: number;
  shuffle?: boolean;
  earlyStoppingPatience?: number;
  checkpointPath?: string;
}

/**
 * Options for model prediction
 */
export interface PredictionOptions {
  batchSize?: number;
  confidenceThreshold?: number;
  topK?: number;
  includeMetadata?: boolean;
}

/**
 * Options for model evaluation
 */
export interface EvaluationOptions {
  batchSize?: number;
  includeConfusionMatrix?: boolean;
  customMetrics?: string[];
  detailedReport?: boolean;
}

/**
 * Result structure for model predictions
 */
export interface PredictionResult {
  prediction: any;
  confidence: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Configuration interface for model initialization
 */
export interface ModelConfig {
  modelPath: string;
  modelType: ModelType;
  framework: AIFramework;
  hyperparameters: Record<string, any>;
  deviceConfig?: DeviceConfig;
  optimizerConfig?: OptimizerConfig;
}

/**
 * Comprehensive metrics interface for model evaluation
 */
export interface ModelMetrics {
  accuracy: number;
  loss: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  confusionMatrix?: number[][];
  customMetrics?: Record<string, number>;
  timestamp: Date;
}

/**
 * Core interface that all AI models must implement
 * Supports both TensorFlow and PyTorch based implementations
 */
export interface AIModel {
  /**
   * Initializes the model with provided configuration
   * @param config Model configuration including paths and hyperparameters
   * @returns Promise that resolves when model is initialized
   */
  initialize(config: ModelConfig): Promise<void>;

  /**
   * Trains the model on provided dataset
   * @param data Training data
   * @param labels Training labels
   * @param options Optional training configuration
   * @returns Observable stream of training metrics
   */
  train(
    data: any[],
    labels: any[],
    options?: TrainingOptions
  ): Observable<ModelMetrics>;

  /**
   * Generates predictions for input data
   * @param input Input data for prediction
   * @param options Optional prediction configuration
   * @returns Promise with prediction results
   */
  predict(
    input: any,
    options?: PredictionOptions
  ): Promise<PredictionResult>;

  /**
   * Evaluates model performance on test dataset
   * @param testData Test dataset
   * @param testLabels Test labels
   * @param options Optional evaluation configuration
   * @returns Promise with evaluation metrics
   */
  evaluate(
    testData: any[],
    testLabels: any[],
    options?: EvaluationOptions
  ): Promise<ModelMetrics>;
}