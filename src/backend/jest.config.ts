import type { Config } from '@jest/types'; // @jest/types@^29.0.0

/**
 * Comprehensive Jest configuration for NestJS backend testing
 * Supports microservices architecture, TypeScript, and enhanced CI/CD integration
 * 
 * @returns {Config.InitialOptions} Complete Jest configuration object
 */
export default async (): Promise<Config.InitialOptions> => {
  return {
    // Supported file extensions for test discovery
    moduleFileExtensions: [
      'js',
      'json',
      'ts'
    ],

    // Set Node.js as test environment for backend testing
    testEnvironment: 'node',

    // Root directory for test discovery
    rootDir: 'src',

    // Test file pattern matching
    testRegex: '.*\\.spec\\.ts$',

    // TypeScript transformation configuration
    transform: {
      '^.+\\.(t|j)s$': 'ts-jest'
    },

    // Coverage collection configuration
    collectCoverageFrom: [
      '**/*.(t|j)s',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/*.mock.ts',
      '!**/*.dto.ts',
      '!**/*.entity.ts',
      '!**/index.ts'
    ],

    // Coverage output directory
    coverageDirectory: '../coverage',

    // Coverage thresholds for CI/CD quality gates
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },

    // Module path aliases for microservices architecture
    moduleNameMapper: {
      '^@app/(.*)$': '<rootDir>/$1',
      '^@common/(.*)$': '<rootDir>/common/$1',
      '^@config/(.*)$': '<rootDir>/config/$1',
      '^@test/(.*)$': '<rootDir>/../test/$1',
      '^@services/(.*)$': '<rootDir>/services/$1',
      '^@models/(.*)$': '<rootDir>/models/$1',
      '^@utils/(.*)$': '<rootDir>/utils/$1'
    },

    // Extended timeout for integration tests
    testTimeout: 30000,

    // Enhanced logging and debugging
    verbose: true,

    // Resource cleanup and error detection
    detectOpenHandles: true,
    forceExit: true,
    clearMocks: true,
    restoreMocks: true
  };
};