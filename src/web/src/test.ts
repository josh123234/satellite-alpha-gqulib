// @angular/core/testing v17.x
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// zone.js/testing v0.14.x
import 'zone.js/testing';

// jasmine-core v~5.1.0
import * as jasmine from 'jasmine-core';

// Prevent Karma from running prematurely
declare const __karma__: any;
declare const require: any;

// First, initialize the Angular testing environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true
  }
);

// Configure Jasmine test timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;

// Configure error handling for test failures
const originalError = console.error;
console.error = (...args: any[]) => {
  originalError.apply(console, args);
  if (args[0] instanceof Error) {
    __karma__.error(args[0].message);
  }
};

// Performance optimization: Enable parallel test execution
(window as any).__Zone_disable_thread_check = true;

// Configure test coverage thresholds
__karma__.config.coverageReporter = {
  check: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};

// Configure webpack context for test file loading
const context = require.context('./', true, /\.spec\.ts$/);

// Exclude module spec files
const filteredContext = context.keys().filter(key => !key.includes('.module.spec.ts'));

// Load all non-module spec files
filteredContext.forEach(context);

// Initialize lazy loading for test modules
Promise.resolve().then(() => {
  // Trigger Karma start after environment setup
  __karma__.start();
}).catch(error => {
  console.error('Test initialization failed:', error);
  __karma__.error(error.message);
});

// Export test bed for external use
export { getTestBed };