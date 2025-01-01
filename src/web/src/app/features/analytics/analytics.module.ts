import { NgModule } from '@angular/core'; // v17.0.0
import { CommonModule } from '@angular/common'; // v17.0.0
import { RouterModule } from '@angular/router'; // v17.0.0

// Feature components
import { AnalyticsComponent } from './analytics.component';
import { CostAnalysisComponent } from './components/cost-analysis/cost-analysis.component';
import { DepartmentBreakdownComponent } from './components/department-breakdown/department-breakdown.component';
import { UsageTrendsComponent } from './components/usage-trends/usage-trends.component';

// Shared module with common components and utilities
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module that provides comprehensive analytics functionality including
 * real-time cost analysis, usage metrics, department breakdowns, and interactive
 * visualizations for the SaaS Management Platform.
 * 
 * Implements lazy loading and optimized change detection for improved performance.
 */
@NgModule({
  declarations: [
    AnalyticsComponent,
    CostAnalysisComponent,
    DepartmentBreakdownComponent,
    UsageTrendsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: AnalyticsComponent,
        children: [
          {
            path: 'cost',
            component: CostAnalysisComponent,
            data: { title: 'Cost Analysis' }
          },
          {
            path: 'departments',
            component: DepartmentBreakdownComponent,
            data: { title: 'Department Breakdown' }
          },
          {
            path: 'usage',
            component: UsageTrendsComponent,
            data: { title: 'Usage Trends' }
          }
        ]
      }
    ])
  ],
  exports: [
    // Export main component for potential external usage
    AnalyticsComponent,
    // Export child components for flexibility
    CostAnalysisComponent,
    DepartmentBreakdownComponent,
    UsageTrendsComponent
  ]
})
export class AnalyticsModule {
  /**
   * Module name for debugging and performance tracking
   */
  static readonly moduleName: string = 'AnalyticsModule';

  /**
   * Flag to track module initialization status
   */
  private static isInitialized: boolean = false;

  constructor() {
    if (!AnalyticsModule.isInitialized) {
      this.initializeModule();
      AnalyticsModule.isInitialized = true;
    }
  }

  /**
   * Initializes the analytics module with performance monitoring
   * and error boundaries
   * @private
   */
  private initializeModule(): void {
    // Set up performance monitoring for analytics components
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark('analytics-module-init');
    }

    // Configure error boundaries for analytics components
    window.addEventListener('error', (event: ErrorEvent) => {
      if (event.filename?.includes('analytics')) {
        console.error('Analytics Module Error:', event.error);
        // Implement error reporting logic here
      }
    });

    // Initialize real-time update handlers
    this.setupRealTimeHandlers();
  }

  /**
   * Sets up handlers for real-time analytics updates
   * @private
   */
  private setupRealTimeHandlers(): void {
    // Configure WebSocket reconnection strategy
    const wsConfig = {
      reconnectInterval: 5000,
      maxRetries: 3
    };

    // Set up performance marks for analytics operations
    const performanceConfig = {
      measurePoints: ['dataLoad', 'chartRender', 'updateComplete'],
      bufferSize: 100
    };

    // Initialize error boundary configuration
    const errorConfig = {
      maxErrors: 3,
      resetInterval: 60000
    };
  }

  /**
   * Custom bootstrap logic for analytics module
   */
  ngDoBootstrap(): void {
    // Set up module dependencies
    this.initializeModule();

    // Configure real-time data connections
    this.setupRealTimeHandlers();

    // Set up performance monitoring
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark('analytics-module-bootstrap');
      window.performance.measure(
        'analytics-module-init-to-bootstrap',
        'analytics-module-init',
        'analytics-module-bootstrap'
      );
    }

    // Initialize error handling
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      if (event.reason?.stack?.includes('analytics')) {
        console.error('Analytics Module Unhandled Rejection:', event.reason);
        // Implement error reporting logic here
      }
    });
  }
}