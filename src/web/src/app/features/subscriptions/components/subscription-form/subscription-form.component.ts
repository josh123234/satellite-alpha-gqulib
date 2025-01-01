import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core'; // v17.x
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms'; // v17.x
import { Store, select } from '@ngrx/store'; // v17.x
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs'; // v7.x

import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
  ContractDetails,
  UsageMetrics
} from '../../../../shared/models/subscription.model';
import {
  createSubscription,
  updateSubscription,
  subscriptionAnalyticsUpdate
} from '../../../../core/store/actions/subscription.actions';

@Component({
  selector: 'app-subscription-form',
  templateUrl: './subscription-form.component.html',
  styleUrls: ['./subscription-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionFormComponent implements OnInit, OnDestroy {
  subscriptionForm: FormGroup;
  contractDetailsForm: FormGroup;
  usageMetricsForm: FormGroup;
  
  private destroy$ = new Subject<void>();
  private formChanges$ = new Subject<void>();
  
  subscription: Subscription | null = null;
  isEditMode = false;
  isLoading = false;
  
  statusOptions = Object.values(SubscriptionStatus);
  billingCycleOptions = Object.values(BillingCycle);

  constructor(
    private fb: FormBuilder,
    private store: Store
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.trackFormChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.formChanges$.next();
    this.formChanges$.complete();
  }

  private initForm(): void {
    // Initialize nested form groups
    this.contractDetailsForm = this.fb.group({
      contractId: ['', [Validators.required]],
      terms: ['', [Validators.required, Validators.minLength(10)]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]]
    });

    this.usageMetricsForm = this.fb.group({
      lastActive: [new Date()],
      utilizationRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      activeUsers: [0, [Validators.required, Validators.min(0)]]
    });

    // Initialize main form
    this.subscriptionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      provider: ['', [Validators.required]],
      cost: [0, [Validators.required, Validators.min(0)]],
      billingCycle: [BillingCycle.MONTHLY, [Validators.required]],
      renewalDate: ['', [Validators.required]],
      status: [SubscriptionStatus.PENDING, [Validators.required]],
      totalLicenses: [0, [Validators.required, Validators.min(1)]],
      usedLicenses: [0, [Validators.required, Validators.min(0)]],
      metadata: this.fb.group({
        tags: [[]],
        customFields: [{}],
        integrationData: [{}]
      }),
      contractDetails: this.contractDetailsForm,
      usageMetrics: this.usageMetricsForm
    });

    // Set form values if in edit mode
    if (this.isEditMode && this.subscription) {
      this.subscriptionForm.patchValue(this.subscription);
    }

    // Add custom validators
    this.subscriptionForm.get('usedLicenses')?.setValidators([
      Validators.required,
      Validators.min(0),
      (control: AbstractControl) => {
        const total = this.subscriptionForm.get('totalLicenses')?.value;
        return control.value <= total ? null : { exceedsTotal: true };
      }
    ]);

    // Validate contract dates
    this.contractDetailsForm.get('endDate')?.setValidators([
      Validators.required,
      (control: AbstractControl) => {
        const startDate = this.contractDetailsForm.get('startDate')?.value;
        return new Date(control.value) > new Date(startDate) ? null : { invalidEndDate: true };
      }
    ]);
  }

  private trackFormChanges(): void {
    this.subscriptionForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(formValue => {
        // Track analytics for form changes
        this.store.dispatch(subscriptionAnalyticsUpdate({
          subscriptionId: this.subscription?.id || 'new',
          analytics: {
            utilizationRate: formValue.usageMetrics.utilizationRate,
            activeUsers: formValue.usageMetrics.activeUsers,
            lastActive: new Date()
          }
        }));
      });
  }

  onSubmit(): void {
    if (this.subscriptionForm.invalid) {
      Object.keys(this.subscriptionForm.controls).forEach(key => {
        const control = this.subscriptionForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isLoading = true;
    const formValue = this.subscriptionForm.value;

    if (this.isEditMode && this.subscription) {
      this.store.dispatch(updateSubscription({
        id: this.subscription.id,
        changes: formValue
      }));
    } else {
      this.store.dispatch(createSubscription({
        subscription: {
          ...formValue,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }));
    }
  }

  reset(): void {
    this.subscriptionForm.reset({
      status: SubscriptionStatus.PENDING,
      billingCycle: BillingCycle.MONTHLY,
      metadata: {
        tags: [],
        customFields: {},
        integrationData: {}
      },
      usageMetrics: {
        lastActive: new Date(),
        utilizationRate: 0,
        activeUsers: 0
      }
    });
    this.isLoading = false;
  }

  validateContractDates(): void {
    const startDate = this.contractDetailsForm.get('startDate')?.value;
    const endDate = this.contractDetailsForm.get('endDate')?.value;
    
    if (startDate && endDate) {
      if (new Date(endDate) <= new Date(startDate)) {
        this.contractDetailsForm.get('endDate')?.setErrors({ invalidEndDate: true });
      }
    }
  }

  updateUsageMetrics(metrics: Partial<UsageMetrics>): void {
    this.usageMetricsForm.patchValue(metrics);
    this.trackFormChanges();
  }
}