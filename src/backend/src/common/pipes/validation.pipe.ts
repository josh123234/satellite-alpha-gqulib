import { 
  PipeTransform, 
  Injectable, 
  ArgumentMetadata, 
  BadRequestException 
} from '@nestjs/common';
import { validate } from 'class-validator'; // v0.14.x
import { plainToInstance } from 'class-transformer'; // v0.5.x

interface ValidationPipeOptions {
  transform?: boolean;
  skipMissingProperties?: boolean;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  groups?: string[];
  dismissDefaultMessages?: boolean;
  validationError?: {
    target?: boolean;
    value?: boolean;
  };
  enableDebugMessages?: boolean;
  exceptionFactory?: (errors: any[]) => any;
}

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly validationOptions: ValidationPipeOptions;
  private readonly validationCache: Map<string, any>;

  constructor(options: ValidationPipeOptions = {}) {
    this.validationOptions = {
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      validationError: {
        target: false,
        value: true
      },
      ...options
    };

    this.validationCache = new Map<string, any>();
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;
    
    // Skip validation for primitive types and null values
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Generate cache key based on value and metadata
    const cacheKey = this.generateCacheKey(value, metadata);
    
    // Check cache for existing validation result
    const cachedResult = this.validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
      excludeExtraneousValues: this.validationOptions.whitelist
    });

    // Perform validation
    const errors = await validate(object, {
      ...this.validationOptions,
      groups: metadata.data?.groups || this.validationOptions.groups
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: formattedErrors
      });
    }

    // Cache successful validation result
    this.validationCache.set(cacheKey, object);

    return object;
  }

  private formatErrors(errors: any[]): object {
    return errors.reduce((acc, error) => {
      const property = error.property;
      const constraints = error.constraints;
      
      if (!acc[property]) {
        acc[property] = [];
      }

      if (constraints) {
        Object.values(constraints).forEach((message: string) => {
          acc[property].push({
            code: `VAL${this.generateErrorCode(error)}`,
            message: this.sanitizeErrorMessage(message),
            value: error.value
          });
        });
      }

      // Handle nested errors
      if (error.children?.length > 0) {
        acc[property].push(this.formatErrors(error.children));
      }

      return acc;
    }, {});
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private generateCacheKey(value: any, metadata: ArgumentMetadata): string {
    const valueString = JSON.stringify(value);
    const metadataString = JSON.stringify({
      type: metadata.type,
      data: metadata.data,
      metatype: metadata.metatype?.name
    });
    return `${valueString}:${metadataString}`;
  }

  private generateErrorCode(error: any): string {
    // Generate unique error codes based on constraint type
    const constraintCodes = {
      isString: '101',
      isNumber: '102',
      isBoolean: '103',
      isEmail: '104',
      isNotEmpty: '105',
      isLength: '106',
      isArray: '107',
      isObject: '108',
      // Add more constraint codes as needed
    };

    const constraint = Object.keys(error.constraints || {})[0];
    return constraintCodes[constraint] || '100';
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove any potentially sensitive information from error messages
    return message.replace(/\b(password|token|key|secret)\b/gi, '***');
  }
}

export { ValidationPipe };