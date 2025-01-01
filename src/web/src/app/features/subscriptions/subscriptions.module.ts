import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';

// Feature components
import { SubscriptionsComponent } from './subscriptions.component';
import { SubscriptionListComponent } from './components/subscription-list/subscription-list.component';
import { SubscriptionDetailComponent } from './components/subscription-detail/subscription-detail.component';
import { SubscriptionFormComponent } from './components/subscription-form/subscription-form.component';

// Shared module with common components
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module for subscription management functionality.
 * Implements comprehensive subscription tracking and management capabilities
 * with real-time monitoring and cost optimization interfaces.
 */
@NgModule({
  declarations: [
    SubscriptionsComponent,
    SubscriptionListComponent,
    SubscriptionDetailComponent,
    SubscriptionFormComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: '',
        component: SubscriptionsComponent,
        children: [
          {
            path: '',
            component: SubscriptionListComponent
          },
          {
            path: 'new',
            component: SubscriptionFormComponent
          },
          {
            path: ':id',
            component: SubscriptionDetailComponent
          },
          {
            path: ':id/edit',
            component: SubscriptionFormComponent
          }
        ]
      }
    ]),
    ReactiveFormsModule,
    MatDialogModule,
    SharedModule
  ],
  exports: [
    SubscriptionsComponent
  ]
})
export class SubscriptionsModule {
  /**
   * Default constructor for the module
   * Initializes lazy loading configuration and feature routing
   */
  constructor() {
    // Module initialization logic can be added here if needed
  }
}