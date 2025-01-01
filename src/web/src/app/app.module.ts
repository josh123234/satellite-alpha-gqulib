import { NgModule, CUSTOM_ELEMENTS_SCHEMA, ErrorHandler, APP_INITIALIZER } from '@angular/core'; // v17.0.0
import { BrowserModule } from '@angular/platform-browser'; // v17.0.0
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // v17.0.0
import { environment } from '../environments/environment';

// Core application imports
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';

// Error handling and initialization
import { GlobalErrorHandler } from './core/services/error-handling.service';
import { AuthService } from './core/auth/auth.service';

/**
 * Factory function to handle application initialization
 * Ensures auth state and critical services are ready before app bootstrap
 */
export function initializeApp(authService: AuthService) {
  return () => new Promise<void>(resolve => {
    // Initialize authentication state
    authService.initializeAuthState();
    
    // Configure runtime checks for development
    if (!environment.production) {
      enableDebugTools();
    }

    resolve();
  });
}

/**
 * Enables development debug tools and strict runtime checks
 */
function enableDebugTools(): void {
  // Enable strict runtime checks for immutability
  if (typeof ngDevMode !== 'undefined' && ngDevMode) {
    Object.freeze(environment);
  }
}

/**
 * Root module of the SaaS Management Platform
 * Implements secure module loading, state management, and comprehensive error handling
 */
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    // Angular Core Modules
    BrowserModule,
    BrowserAnimationsModule,
    
    // Application Routing
    AppRoutingModule,
    
    // Core Functionality
    CoreModule.forRoot(),
    
    // Shared Components and Services
    SharedModule.forRoot({
      production: environment.production,
      defaultLocale: 'en-US',
      defaultCurrency: 'USD'
    })
  ],
  providers: [
    // Global error handling
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    // Application initialization
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService],
      multi: true
    }
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {
  constructor() {
    // Configure production mode
    if (environment.production) {
      this.enableProductionMode();
    }
  }

  /**
   * Enables production optimizations and security measures
   */
  private enableProductionMode(): void {
    // Disable development APIs
    if (typeof console !== 'undefined') {
      console.debug = () => {};
    }

    // Lock down environment configuration
    Object.freeze(environment);
  }
}