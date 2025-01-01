import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto'; // native
import * as bcrypt from 'bcrypt'; // ^5.1.0
import * as winston from 'winston'; // ^3.8.0
import { jwtSecret, encryptionConfig } from '../../config/configuration';

// Constants for encryption
const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha512';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const CURRENT_VERSION = '1.0';

// Configure logger for security operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

// Interfaces
interface EncryptionOptions {
  version?: string;
  additionalData?: Buffer;
}

interface EncryptedData {
  data: string;
  iv: string;
  authTag: string;
  salt: string;
  version: string;
}

// Decorators
function ValidateInput() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (!args[0] || !args[1]) {
        throw new Error('Invalid input parameters');
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

function AuditLog() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const startTime = Date.now();
      const result = originalMethod.apply(this, args);
      logger.info({
        operation: propertyKey,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      return result;
    };
    return descriptor;
  };
}

// Main Encryption Service Class
export class EncryptionService {
  private readonly keyManager: KeyManager;
  private readonly versionManager: VersionManager;
  private readonly monitor: SecurityMonitor;

  constructor(config: typeof encryptionConfig) {
    this.keyManager = new KeyManager(config);
    this.versionManager = new VersionManager();
    this.monitor = new SecurityMonitor();
  }

  @ValidateInput()
  @AuditLog()
  async encrypt(data: string, key: string, options: EncryptionOptions = {}): Promise<EncryptedData> {
    try {
      // Generate cryptographically secure salt and IV
      const salt = randomBytes(SALT_LENGTH);
      const iv = randomBytes(IV_LENGTH);

      // Derive key using PBKDF2
      const derivedKey = pbkdf2Sync(
        key,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST
      );

      // Create cipher with GCM mode
      const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

      // Add additional authenticated data if provided
      if (options.additionalData) {
        cipher.setAAD(options.additionalData);
      }

      // Encrypt data
      const encryptedData = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Monitor encryption operation
      this.monitor.recordOperation('encrypt');

      return {
        data: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        salt: salt.toString('base64'),
        version: options.version || CURRENT_VERSION
      };
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  @ValidateInput()
  @AuditLog()
  async decrypt(encryptedData: EncryptedData, key: string): Promise<string> {
    try {
      // Validate version compatibility
      this.versionManager.validateVersion(encryptedData.version);

      // Convert base64 strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const data = Buffer.from(encryptedData.data, 'base64');

      // Derive key using PBKDF2
      const derivedKey = pbkdf2Sync(
        key,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST
      );

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data using constant-time operations
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final()
      ]);

      // Monitor decryption operation
      this.monitor.recordOperation('decrypt');

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  async rotateKeys(): Promise<void> {
    await this.keyManager.rotateKeys();
    logger.info('Key rotation completed');
  }
}

// Helper Classes
class KeyManager {
  private keys: Map<string, Buffer>;

  constructor(config: typeof encryptionConfig) {
    this.keys = new Map();
    this.initializeKeys(config);
  }

  private initializeKeys(config: typeof encryptionConfig): void {
    // Initialize encryption keys securely
    this.keys.set('primary', Buffer.from(config.encryptionKey, 'base64'));
  }

  async rotateKeys(): Promise<void> {
    const newKey = randomBytes(32);
    this.keys.set(`key_${Date.now()}`, newKey);
  }
}

class VersionManager {
  private readonly supportedVersions = new Set(['1.0']);

  validateVersion(version: string): void {
    if (!this.supportedVersions.has(version)) {
      throw new Error('Unsupported encryption version');
    }
  }
}

class SecurityMonitor {
  private operations: Map<string, number>;

  constructor() {
    this.operations = new Map();
  }

  recordOperation(type: string): void {
    const count = this.operations.get(type) || 0;
    this.operations.set(type, count + 1);
    
    if (count % 1000 === 0) {
      logger.info(`Security operation milestone`, {
        type,
        count: count + 1
      });
    }
  }
}

// Export main service and types
export { EncryptedData, EncryptionOptions };