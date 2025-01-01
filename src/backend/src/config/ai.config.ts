import { config } from 'dotenv'; // ^16.0.0

// Load environment variables
config();

// Validation decorator
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args: any[]) {
        const config = originalMethod.apply(this, args);
        validateRequiredFields(config);
        validateNumericRanges(config);
        return Object.freeze(config);
    };
    return descriptor;
}

// Validation helpers
function validateRequiredFields(config: any) {
    if (!config.langchain.apiKey) {
        throw new Error('LANGCHAIN_API_KEY is required but not provided');
    }
    
    const requiredPaths = [
        config.tensorflow.modelPath,
        config.pytorch.modelPath,
        config.langchain.modelName
    ];
    
    requiredPaths.forEach(path => {
        if (!path) {
            throw new Error(`Required model path is missing in configuration`);
        }
    });
}

function validateNumericRanges(config: any) {
    // Validate TensorFlow settings
    if (config.tensorflow.contractAnalysis.threshold < 0 || config.tensorflow.contractAnalysis.threshold > 1) {
        throw new Error('TensorFlow confidence threshold must be between 0 and 1');
    }
    
    // Validate PyTorch settings
    if (config.pytorch.saasClassifier.dropoutRate < 0 || config.pytorch.saasClassifier.dropoutRate > 1) {
        throw new Error('PyTorch dropout rate must be between 0 and 1');
    }
    
    // Validate LangChain settings
    if (config.langchain.temperature < 0 || config.langchain.temperature > 2) {
        throw new Error('LangChain temperature must be between 0 and 2');
    }
}

class AIConfigLoader {
    @validateConfig
    loadAIConfig() {
        return {
            tensorflow: {
                modelPath: process.env.TF_MODEL_PATH || 'models/tensorflow',
                contractAnalysis: {
                    modelName: process.env.TF_CONTRACT_MODEL || 'contract-analysis-bert',
                    batchSize: parseInt(process.env.TF_BATCH_SIZE as string) || 32,
                    threshold: parseFloat(process.env.TF_CONFIDENCE_THRESHOLD as string) || 0.85,
                    maxSequenceLength: parseInt(process.env.TF_MAX_SEQUENCE_LENGTH as string) || 512,
                    warmupSteps: parseInt(process.env.TF_WARMUP_STEPS as string) || 100
                },
                usagePattern: {
                    modelName: process.env.TF_USAGE_MODEL || 'usage-pattern-cnn',
                    timeWindow: parseInt(process.env.TF_TIME_WINDOW as string) || 30,
                    minSamples: parseInt(process.env.TF_MIN_SAMPLES as string) || 100,
                    anomalyThreshold: parseFloat(process.env.TF_ANOMALY_THRESHOLD as string) || 0.95,
                    predictionWindow: parseInt(process.env.TF_PREDICTION_WINDOW as string) || 7
                }
            },
            pytorch: {
                modelPath: process.env.PYTORCH_MODEL_PATH || 'models/pytorch',
                saasClassifier: {
                    modelName: process.env.PYTORCH_CLASSIFIER_MODEL || 'saas-classifier-rf',
                    inputSize: parseInt(process.env.PYTORCH_INPUT_SIZE as string) || 512,
                    threshold: parseFloat(process.env.PYTORCH_THRESHOLD as string) || 0.75,
                    numClasses: parseInt(process.env.PYTORCH_NUM_CLASSES as string) || 10,
                    hiddenSize: parseInt(process.env.PYTORCH_HIDDEN_SIZE as string) || 256,
                    dropoutRate: parseFloat(process.env.PYTORCH_DROPOUT_RATE as string) || 0.3
                }
            },
            langchain: {
                apiKey: process.env.LANGCHAIN_API_KEY,
                modelName: process.env.LANGCHAIN_MODEL || 'gpt-4',
                temperature: parseFloat(process.env.LANGCHAIN_TEMP as string) || 0.7,
                maxTokens: parseInt(process.env.LANGCHAIN_MAX_TOKENS as string) || 2048,
                contextWindow: parseInt(process.env.LANGCHAIN_CONTEXT_WINDOW as string) || 4096,
                assistantPrompt: process.env.ASSISTANT_PROMPT || 'You are an AI assistant for SaaS management.',
                retryConfig: {
                    maxRetries: parseInt(process.env.LANGCHAIN_MAX_RETRIES as string) || 3,
                    retryDelay: parseInt(process.env.LANGCHAIN_RETRY_DELAY as string) || 1000
                },
                caching: {
                    enabled: process.env.LANGCHAIN_CACHE_ENABLED === 'true',
                    ttl: parseInt(process.env.LANGCHAIN_CACHE_TTL as string) || 3600
                }
            }
        };
    }
}

// Create and export the frozen configuration
const configLoader = new AIConfigLoader();
export const aiConfig = configLoader.loadAIConfig();

// Named exports for specific configurations
export const { tensorflow, pytorch, langchain } = aiConfig;

// Type definitions for configuration objects
export interface TensorFlowConfig {
    modelPath: string;
    contractAnalysis: {
        modelName: string;
        batchSize: number;
        threshold: number;
        maxSequenceLength: number;
        warmupSteps: number;
    };
    usagePattern: {
        modelName: string;
        timeWindow: number;
        minSamples: number;
        anomalyThreshold: number;
        predictionWindow: number;
    };
}

export interface PyTorchConfig {
    modelPath: string;
    saasClassifier: {
        modelName: string;
        inputSize: number;
        threshold: number;
        numClasses: number;
        hiddenSize: number;
        dropoutRate: number;
    };
}

export interface LangChainConfig {
    apiKey: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    assistantPrompt: string;
    retryConfig: {
        maxRetries: number;
        retryDelay: number;
    };
    caching: {
        enabled: boolean;
        ttl: number;
    };
}