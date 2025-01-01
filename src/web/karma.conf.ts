// karma-jasmine v5.1.0
// karma-chrome-launcher v3.2.0
// karma-coverage v2.2.0
// karma-jasmine-html-reporter v2.1.0
// @angular-devkit/build-angular v17.0.0

import { Config } from 'karma';

/**
 * Karma configuration for Angular application testing
 * Implements comprehensive test execution environment with advanced options
 * for CI/CD pipeline integration and quality metrics tracking
 */
export default function(config: Config): void {
  config.set({
    // Base path used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // Frameworks to use for testing
    frameworks: ['jasmine', '@angular-devkit/build-angular'],

    // List of plugins to load
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],

    // Client configuration
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible
      jasmine: {
        random: true, // randomize test execution order
        timeoutInterval: 10000, // timeout for async specs
        failFast: true // stop execution on first failure in CI
      }
    },

    // Coverage reporter configuration
    coverageReporter: {
      dir: 'coverage',
      reporters: [
        { type: 'html', dir: 'coverage/html' },
        { type: 'lcov', dir: 'coverage/lcov' },
        { type: 'text-summary' },
        { type: 'json', dir: 'coverage/json' }
      ],
      check: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      },
      watermarks: {
        statements: [70, 80],
        branches: [70, 80],
        functions: [70, 80],
        lines: [70, 80]
      }
    },

    // Test results reporters
    reporters: ['progress', 'kjhtml', 'coverage'],

    // Web server port
    port: 9876,

    // Enable colors in the output
    colors: true,

    // Level of logging
    logLevel: config.LOG_INFO,

    // Enable file watching
    autoWatch: true,

    // Browsers to use for testing
    browsers: ['Chrome'],

    // Custom launcher configurations
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ]
      }
    },

    // Continuous Integration mode
    singleRun: false,

    // Restart on file changes
    restartOnFileChange: true,

    // Files to include in the testing process
    files: [
      'src/test.ts',
      'src/**/*.spec.ts'
    ],

    // Preprocess matching files before serving them
    preprocessors: {
      'src/**/*.ts': ['coverage']
    },

    // Mime types for files
    mime: {
      'text/x-typescript': ['ts', 'tsx']
    },

    // Browser disconnect timeout
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: 60000,

    // Capturer timeout settings
    captureTimeout: 60000,

    // Report slower tests
    reportSlowerThan: 500,

    // Retry failed tests
    retryLimit: 2,

    // Webpack source maps
    sourceMap: true,

    // TypeScript configuration
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.spec.json',
      compilerOptions: {
        module: 'commonjs'
      }
    }
  });

  // CI environment detection and configuration
  if (process.env.CI) {
    config.browsers = ['ChromeHeadlessCI'];
    config.singleRun = true;
    config.autoWatch = false;
    config.browserNoActivityTimeout = 90000;
    config.reporters = ['progress', 'coverage'];
    config.coverageReporter.reporters = [
      { type: 'lcov', dir: 'coverage/lcov' },
      { type: 'text-summary' }
    ];
  }
}