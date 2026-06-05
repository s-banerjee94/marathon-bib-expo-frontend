import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateOrganizationRequest,
  Organization,
  SubscriptionTier,
} from '../../../core/models/organization.model';
import { OrganizationService } from '../../../core/services/organization.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { SUBSCRIPTION_TIER_OPTIONS } from '../../../shared/constants/subscription.constant';
import { OrganizationListBus } from '../organization-list-bus.service';

/**
 * Create-organization form, always rendered inside a dialog (DialogService) from
 * OrganizationList. Editing an organization is handled by the full-page
 * OrganizationAccount view, so this form is create-only.
 */
@Component({
  selector: 'app-organization-form',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    FloatLabelModule,
    ButtonModule,
    MessageModule,
    SelectModule,
    InputNumberModule,
  ],
  templateUrl: './organization-form.html',
  styleUrl: './organization-form.css',
})
export class OrganizationForm {
  private dialogRef = inject(DynamicDialogRef, { optional: true });

  // Form data as a plain object for ngModel binding.
  organization: CreateOrganizationRequest = {
    organizerName: '',
    email: '',
    phoneNumber: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    taxId: '',
    registrationNumber: '',
    userQuota: {
      admins: { max: 1 },
      organizerUsers: { max: 1 },
      distributors: { max: 3 },
    },
    subscriptionTier: SubscriptionTier.FREE,
    billingEmail: '',
  };
  isSubmitting = signal(false);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly subscriptionTiers = SUBSCRIPTION_TIER_OPTIONS;

  private organizationService = inject(OrganizationService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private organizationListBus = inject(OrganizationListBus);

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    this.isSubmitting.set(true);
    this.organizationService.createOrganization(this.organization).subscribe({
      next: (createdOrg: Organization) => {
        this.isSubmitting.set(false);
        this.organizationListBus.publish({ action: 'created', organization: createdOrg });
        this.toast.success('Organization created successfully', 'Created');
        this.dialogRef?.close(createdOrg);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error, 'Error');
      },
    });
  }
}
