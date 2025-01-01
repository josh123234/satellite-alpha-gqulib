import { Component, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { 
  Subscription, 
  SubscriptionStatus, 
  BillingCycle, 
  SubscriptionAnalytics 
} from '../../../../shared/models/subscription.model';
import { 
  DataTableComponent, 
  ITableConfig, 
  ITableColumn 
} from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-subscription-list',
  templateUrl: './subscription-list.component.html',
  styleUrls: ['./subscription-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionListComponent implements OnInit {
  // Observables for reactive data management
  subscriptions$: Observable<Subscription[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  analytics$: Observable<SubscriptionAnalytics[]>;

  // Table configuration
  tableConfig: ITableConfig = {
    columns: this.getTableColumns(),
    selectable: true,
    sortable: true,
    filterable: true,
    pageable: true,
    virtualScroll: true,
    pageSize: 20,
    ariaLabel: 'Subscription List',
    emptyStateMessage: 'No subscriptions found'
  };

  // Batch operations state
  batchOperationsEnabled = false;
  selectedSubscriptions: string[] = [];

  constructor(
    private store: Store,
    private destroyRef: DestroyRef
  ) {
    // Initialize observables from store with error handling
    this.subscriptions$ = this.store.select('subscriptions')
      .pipe(
        takeUntilDestroyed(destroyRef),
        catchError(error => {
          console.error('Error loading subscriptions:', error);
          return [];
        })
      );

    this.loading$ = this.store.select('subscriptionsLoading');
    this.error$ = this.store.select('subscriptionsError');
    this.analytics$ = this.store.select('subscriptionAnalytics');
  }

  ngOnInit(): void {
    // Load initial data
    this.store.dispatch({ type: '[Subscriptions] Load Subscriptions' });
    this.initializeRealTimeUpdates();
  }

  private getTableColumns(): ITableColumn[] {
    return [
      {
        key: 'name',
        label: 'Subscription Name',
        sortable: true,
        filterable: true,
        width: '25%',
        ariaLabel: 'Sort by subscription name'
      },
      {
        key: 'cost',
        label: 'Monthly Cost',
        type: 'currency',
        sortable: true,
        width: '15%',
        align: 'right',
        ariaLabel: 'Sort by cost'
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        sortable: true,
        width: '10%',
        ariaLabel: 'Sort by status'
      },
      {
        key: 'renewalDate',
        label: 'Renewal Date',
        type: 'date',
        sortable: true,
        width: '15%',
        format: 'MMM dd, yyyy',
        ariaLabel: 'Sort by renewal date'
      },
      {
        key: 'usageMetrics.utilizationRate',
        label: 'Utilization',
        type: 'percentage',
        sortable: true,
        width: '15%',
        ariaLabel: 'Sort by utilization rate'
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '20%',
        align: 'center'
      }
    ];
  }

  private initializeRealTimeUpdates(): void {
    // Subscribe to real-time updates with cleanup
    this.store.select('subscriptionUpdates')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        if (update) {
          this.handleRealTimeUpdate(update);
        }
      });
  }

  private handleRealTimeUpdate(update: any): void {
    // Handle different types of updates
    switch (update.type) {
      case 'SUBSCRIPTION_MODIFIED':
        this.store.dispatch({
          type: '[Subscriptions] Update Subscription',
          payload: update.data
        });
        break;
      case 'ANALYTICS_UPDATED':
        this.store.dispatch({
          type: '[Subscriptions] Update Analytics',
          payload: update.data
        });
        break;
      case 'STATUS_CHANGED':
        this.handleStatusChange(update.data);
        break;
    }
  }

  private handleStatusChange(data: { id: string; status: SubscriptionStatus }): void {
    this.store.dispatch({
      type: '[Subscriptions] Update Status',
      payload: data
    });
  }

  onSort(event: any): void {
    this.store.dispatch({
      type: '[Subscriptions] Sort',
      payload: event
    });
  }

  onFilter(event: any): void {
    this.store.dispatch({
      type: '[Subscriptions] Filter',
      payload: event
    });
  }

  onBatchOperation(operation: string): void {
    if (!this.selectedSubscriptions.length) {
      return;
    }

    this.store.dispatch({
      type: '[Subscriptions] Batch Operation',
      payload: {
        operation,
        subscriptionIds: this.selectedSubscriptions
      }
    });
  }

  onSelectionChange(selected: string[]): void {
    this.selectedSubscriptions = selected;
    this.batchOperationsEnabled = selected.length > 0;
  }

  exportSubscriptions(format: 'csv' | 'xlsx'): void {
    this.store.dispatch({
      type: '[Subscriptions] Export',
      payload: {
        format,
        subscriptionIds: this.selectedSubscriptions.length 
          ? this.selectedSubscriptions 
          : 'all'
      }
    });
  }

  refreshAnalytics(): void {
    this.store.dispatch({
      type: '[Subscriptions] Refresh Analytics'
    });
  }

  handleError(error: any): void {
    this.store.dispatch({
      type: '[Subscriptions] Error',
      payload: error.message
    });
  }
}