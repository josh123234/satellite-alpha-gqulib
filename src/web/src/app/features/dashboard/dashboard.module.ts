import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Feature components
import { DashboardComponent } from './dashboard.component';
import { CostSummaryComponent } from './components/cost-summary/cost-summary.component';
import { LicenseUsageComponent } from './components/license-usage/license-usage.component';
import { RecentActivityComponent } from './components/recent-activity/recent-activity.component';
import { SubscriptionOverviewComponent } from './components/subscription-overview/subscription-overview.component';

// Shared module with common components and utilities
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module for the SaaS Management Platform's main dashboard.
 * Provides real-time monitoring, cost analytics, and subscription management capabilities.
 */
@NgModule({
  declarations: [
    DashboardComponent,
    CostSummaryComponent,
    LicenseUsageComponent,
    RecentActivityComponent,
    SubscriptionOverviewComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: DashboardComponent,
        data: { 
          title: 'Dashboard',
          preload: true,
          breadcrumb: 'Dashboard'
        }
      }
    ])
  ],
  exports: [
    // Export main dashboard component for potential reuse
    DashboardComponent,
    // Export individual widgets for flexible layout composition
    CostSummaryComponent,
    LicenseUsageComponent,
    RecentActivityComponent,
    SubscriptionOverviewComponent
  ]
})
export class DashboardModule {
  /**
   * Constructor documentation for DI debugging
   * No dependencies required at module level
   */
  constructor() {
    // Module initialization logic if needed
  }
}