import { NgModule } from '@angular/core'; // v17.0.0
import { CommonModule } from '@angular/common'; // v17.0.0
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; // v17.0.0
import { MatButtonModule } from '@angular/material/button'; // v17.0.0
import { MatIconModule } from '@angular/material/icon'; // v17.0.0
import { MatTooltipModule } from '@angular/material/tooltip'; // v17.0.0
import { MatRippleModule } from '@angular/material/core'; // v17.0.0

// Component imports
import { AlertComponent } from './components/alert/alert.component';
import { ButtonComponent } from './components/button/button.component';
import { ChartComponent } from './components/chart/chart.component';

// Models and types
import { NotificationType, NotificationPriority } from './models/notification.model';
import { MetricType } from './models/analytics.model';

// Utility functions
import { truncateString } from './utils/string.utils';
import { formatCurrency, formatPercentage, formatMetricValue } from './utils/number.utils';

/**
 * Configuration interface for SharedModule
 */
export interface SharedModuleConfig {
  production: boolean;
  defaultLocale: string;
  defaultCurrency: string;
}

/**
 * SharedModule provides common components, directives, pipes, and utilities
 * used across the SaaS Management Platform.
 */
@NgModule({
  declarations: [
    AlertComponent,
    ButtonComponent,
    ChartComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatRippleModule
  ],
  exports: [
    // Angular Modules
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    
    // Material Modules
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatRippleModule,
    
    // Components
    AlertComponent,
    ButtonComponent,
    ChartComponent,
  ]
})
export class SharedModule {
  private static config: SharedModuleConfig;

  /**
   * Configures the SharedModule with global settings
   * @param config Module configuration options
   * @returns ModuleWithProviders
   */
  static forRoot(config: SharedModuleConfig) {
    return {
      ngModule: SharedModule,
      providers: [
        {
          provide: 'SHARED_MODULE_CONFIG',
          useValue: {
            production: config.production,
            defaultLocale: config.defaultLocale || 'en-US',
            defaultCurrency: config.defaultCurrency || 'USD'
          }
        }
      ]
    };
  }

  /**
   * Exports notification types for use in other modules
   */
  static readonly NotificationType = NotificationType;
  static readonly NotificationPriority = NotificationPriority;

  /**
   * Exports metric types for analytics
   */
  static readonly MetricType = MetricType;

  /**
   * Exports utility functions
   */
  static readonly utils = {
    truncateString,
    formatCurrency,
    formatPercentage,
    formatMetricValue
  };

  /**
   * Design system constants following specifications
   */
  static readonly designSystem = {
    typography: {
      fontFamily: 'Inter, sans-serif',
      sizes: {
        h1: '32px',
        h2: '24px',
        h3: '20px',
        h4: '18px',
        h5: '16px',
        body: '16px',
        small: '14px'
      }
    },
    colors: {
      primary: '#2563EB',
      secondary: '#3B82F6',
      accent: '#60A5FA',
      error: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#3B82F6'
    },
    spacing: {
      base: '8px',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px'
    },
    elevation: {
      none: '0px',
      sm: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      md: '0px 4px 6px rgba(0, 0, 0, 0.1)',
      lg: '0px 10px 15px rgba(0, 0, 0, 0.1)',
      xl: '0px 20px 25px rgba(0, 0, 0, 0.15)'
    },
    breakpoints: {
      mobile: '640px',
      tablet: '768px',
      desktop: '1024px',
      wide: '1280px'
    }
  };
}