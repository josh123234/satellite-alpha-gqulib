/**
 * @fileoverview Core Angular module providing essential services and state management
 * for the SaaS Management Platform web application.
 * @version 1.0.0
 */

import { NgModule, Optional, SkipSelf, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { StoreModule, ActionReducer, MetaReducer, Action } from '@ngrx/store'; // v17.0.0
import { EffectsModule } from '@ngrx/effects'; // v17.0.0
import { StoreDevtoolsModule } from '@ngrx/store-devtools'; // v17.0.0

// Internal imports
import { AppState } from './store/state/app.state';
import { ApiInterceptor } from './http/api.interceptor';
import { environment } from '../../environments/environment';

// Core services
import { AuthService } from './auth/auth.service';
import { AIService } from './services/ai.service';
import { AnalyticsService } from './services/analytics.service';
import { NotificationService } from './services/notification.service';
import { ErrorHandlingService } from './services/error-handling.service';

// Store imports
import * as fromSubscriptions from './store/reducers/subscription.reducer';
import * as fromAnalytics from './store/reducers/analytics.reducer';
import * as fromNotifications from './store/reducers/notification.reducer';
import * as fromAuth from './store/reducers/auth.reducer';

// Effects
import { SubscriptionEffects } from './store/effects/subscription.effects';
import { AnalyticsEffects } from './store/effects/analytics.effects';
import { NotificationEffects } from './store/effects/notification.effects';
import { AuthEffects } from './store/effects/auth.effects';
import { AIEffects } from './store/effects/ai.effects';

/**
 * Debug meta-reducer for development logging
 */
export function debug(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return function(state, action) {
    if (!environment.production) {
      console.group(action.type);
      console.log('Previous State:', state);
      console.log('Action:', action);
    }
    
    const nextState = reducer(state, action);
    
    if (!environment.production) {
      console.log('Next State:', nextState);
      console.groupEnd();
    }
    
    return nextState;
  };
}

/**
 * State hydration meta-reducer for persistence
 */
export function hydrationMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return function(state, action) {
    if (action.type === '@ngrx/store/init') {
      const storageValue = localStorage.getItem('appState');
      if (storageValue) {
        try {
          return JSON.parse(storageValue);
        } catch {
          localStorage.removeItem('appState');
        }
      }
    }
    const nextState = reducer(state, action);
    localStorage.setItem('appState', JSON.stringify(nextState));
    return nextState;
  };
}

// Configure meta-reducers based on environment
export const metaReducers: MetaReducer<AppState>[] = !environment.production ? 
  [debug, hydrationMetaReducer] : [hydrationMetaReducer];

// Configure root reducers
export const reducers = {
  subscriptions: fromSubscriptions.reducer,
  analytics: fromAnalytics.reducer,
  notifications: fromNotifications.reducer,
  auth: fromAuth.reducer
};

// Configure root effects
export const effects = [
  SubscriptionEffects,
  AnalyticsEffects,
  NotificationEffects,
  AuthEffects,
  AIEffects
];

/**
 * Core module providing singleton services and state management
 * Must be imported only once in AppModule
 */
@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    StoreModule.forRoot(reducers, {
      metaReducers,
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
        strictStateSerializability: true,
        strictActionSerializability: true
      }
    }),
    EffectsModule.forRoot(effects),
    !environment.production ? StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
      autoPause: true,
      trace: true,
      traceLimit: 75
    }) : []
  ],
  providers: [
    // HTTP interceptors
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    },
    // Core services
    AuthService,
    AIService,
    AnalyticsService,
    NotificationService,
    ErrorHandlingService
  ]
})
export class CoreModule {
  private moduleLoadCount = 0;

  /**
   * Ensures CoreModule is imported only once
   * @throws Error if attempting to import CoreModule more than once
   */
  constructor(
    @Optional() @SkipSelf() parentModule: CoreModule,
    private injector: Injector
  ) {
    if (parentModule) {
      throw new Error('CoreModule has already been loaded. Import CoreModule only in AppModule.');
    }

    this.moduleLoadCount++;
    if (this.moduleLoadCount > 1) {
      throw new Error('CoreModule instantiated multiple times. This is not allowed.');
    }

    this.initializeErrorHandling();
    this.initializeStateHydration();
  }

  /**
   * Initializes global error handling
   */
  private initializeErrorHandling(): void {
    const errorHandler = this.injector.get(ErrorHandlingService);
    window.onerror = (message, source, lineno, colno, error) => {
      errorHandler.handleError(error || new Error(message as string));
      return false;
    };
  }

  /**
   * Initializes state hydration from localStorage
   */
  private initializeStateHydration(): void {
    window.addEventListener('beforeunload', () => {
      const state = this.injector.get(StoreModule);
      if (state) {
        localStorage.setItem('appState', JSON.stringify(state));
      }
    });
  }
}