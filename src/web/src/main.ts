// @angular/core v17.x
import { enableProdMode, ApplicationRef } from '@angular/core';
// @angular/platform-browser-dynamic v17.x
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

/**
 * Configures platform-level security policies and CSP headers
 */
function configurePlatformSecurity(): void {
  // Enable Custom Elements support for web components
  (window as any).__zone_symbol__CUSTOM_ELEMENTS_SUPPORT__ = true;

  // Set platform configuration
  (window as any).__platform_config__ = environment.platformConfig;

  // Configure strict CSP headers for production
  if (environment.production) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      `connect-src 'self' ${environment.apiUrl} ${environment.wsUrl}`,
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'"
    ].join('; ');
    document.head.appendChild(meta);
  }
}

/**
 * Configures performance monitoring for the bootstrapped application
 * @param appRef Application reference for monitoring
 */
function configurePerformanceMonitoring(appRef: ApplicationRef): void {
  // Monitor stable state for performance metrics
  appRef.isStable.subscribe(stable => {
    if (stable) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const bootstrapTime = timing.domComplete - timing.domLoading;

      // Log performance metrics
      console.info('App Load Time:', loadTime);
      console.info('Bootstrap Time:', bootstrapTime);

      // Configure zone.js performance tracing in development
      if (!environment.production) {
        (window as any).__zone_symbol__ENABLE_LONG_STACK_TRACE_ZONE__ = true;
      }
    }
  });

  // Monitor memory usage in development
  if (!environment.production) {
    setInterval(() => {
      const memory = (window.performance as any).memory;
      if (memory) {
        console.debug('Memory Usage:', {
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576) + 'MB'
        });
      }
    }, 30000);
  }
}

/**
 * Enhanced bootstrap function with retry logic, error handling, and performance monitoring
 */
async function bootstrap(): Promise<void> {
  try {
    // Configure platform security
    configurePlatformSecurity();

    // Enable production mode if needed
    if (environment.production) {
      enableProdMode();
    }

    // Bootstrap application with enhanced error handling
    const platform = platformBrowserDynamic();
    const app = await platform.bootstrapModule(AppModule, {
      // Enable zone.js performance tracing in development
      ngZone: 'zone.js',
      ngZoneEventCoalescing: true,
      ngZoneRunCoalescing: true
    });

    // Configure performance monitoring
    configurePerformanceMonitoring(app.injector.get(ApplicationRef));

    // Handle bootstrap errors
  } catch (error) {
    console.error('Application bootstrap failed:', error);

    // Display user-friendly error message
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px;
      background: #fff;
      border: 1px solid #f5f5f5;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
      font-family: sans-serif;
    `;
    errorElement.innerHTML = `
      <h2 style="color: #ef4444; margin: 0 0 10px;">Application Error</h2>
      <p style="margin: 0;">Unable to start the application. Please try refreshing the page.</p>
    `;
    document.body.appendChild(errorElement);

    // Re-throw error for monitoring systems
    throw error;
  }
}

// Initialize bootstrap with timeout handling
const BOOTSTRAP_TIMEOUT = 10000; // 10 seconds
const bootstrapPromise = bootstrap();
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Bootstrap timeout')), BOOTSTRAP_TIMEOUT);
});

// Race between bootstrap and timeout
Promise.race([bootstrapPromise, timeoutPromise]).catch(error => {
  console.error('Bootstrap failed:', error);
  // Additional error reporting can be added here
});