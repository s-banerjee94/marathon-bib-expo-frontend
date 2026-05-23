import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
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

@Component({
  selector: 'app-organization-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    FloatLabelModule,
    ButtonModule,
    MessageModule,
    CardModule,
    SelectModule,
    InputNumberModule,
    SkeletonModule,
  ],
  templateUrl: './organization-form.html',
  styleUrl: './organization-form.css',
})
export class OrganizationForm implements OnInit {
  // Optional injection for dialog mode
  public dialogConfig = inject(DynamicDialogConfig, { optional: true });
  public dialogRef = inject(DynamicDialogRef, { optional: true });
  isDialogMode = signal(false);
  // Form data as plain object for ngModel binding
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
    maxOrganizerUsers: 5,
    maxDistributors: 30,
    subscriptionTier: SubscriptionTier.FREE,
    billingEmail: '',
  };
  // Component state as signals
  isSubmitting = signal(false);
  isEditMode = signal(false);
  organizationId = signal<number | null>(null);
  isLoading = signal(false);
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;
  readonly subscriptionTiers = SUBSCRIPTION_TIER_OPTIONS;
  private organizationService = inject(OrganizationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private organizationListBus = inject(OrganizationListBus);

  ngOnInit(): void {
    // Check if opened in dialog mode
    if (this.dialogConfig?.data) {
      this.isDialogMode.set(true);
      const dialogData = this.dialogConfig.data;

      if (dialogData.isEditMode && dialogData.organizationId) {
        this.isEditMode.set(true);
        this.organizationId.set(dialogData.organizationId);
        this.loadOrganizationData(dialogData.organizationId);
      }
    } else {
      // Route-based mode (existing behavior)
      this.isDialogMode.set(false);
      const idParam = this.route.snapshot.paramMap.get('id');

      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.isEditMode.set(true);
          this.organizationId.set(id);
          this.loadOrganizationData(id);
        } else {
          // Invalid ID, redirect to create mode
          this.router.navigate(['/organizations/new']);
        }
      } else {
        // Create mode - default state
        this.isEditMode.set(false);
        this.organizationId.set(null);
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.organizationId()) {
      // Edit mode
      this.organizationService
        .updateOrganization(this.organizationId()!, this.organization)
        .subscribe({
          next: (updatedOrg: Organization) => {
            this.isSubmitting.set(false);
            this.organizationListBus.publish({ action: 'updated', organization: updatedOrg });

            if (this.isDialogMode() && this.dialogRef) {
              const successMessage = this.dialogConfig?.data?.successMessage;
              this.dialogRef!.close({ organization: updatedOrg, message: successMessage });
            } else {
              this.toast.success('Organization updated successfully');
              setTimeout(() => this.location.back(), 1500);
            }
          },
          error: (error) => {
            this.isSubmitting.set(false);
            this.errorHandler.showError(error, 'Error');
          },
        });
    } else {
      // Create mode
      this.organizationService.createOrganization(this.organization).subscribe({
        next: (createdOrg: Organization) => {
          this.isSubmitting.set(false);
          this.organizationListBus.publish({ action: 'created', organization: createdOrg });

          if (this.isDialogMode() && this.dialogRef) {
            const successMessage = this.dialogConfig?.data?.successMessage;
            this.dialogRef!.close({ organization: createdOrg, message: successMessage });
          } else {
            this.toast.success('Organization created successfully');
            setTimeout(() => this.location.back(), 1500);
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error, 'Error');
        },
      });
    }
  }

  goBack(): void {
    this.location.back();
  }

  getTitle(): string {
    return this.isEditMode() ? 'Edit Organization' : 'Create Organization';
  }

  getSubmitButtonText(): string {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode() ? 'Update Organization' : 'Create Organization';
  }

  private loadOrganizationData(id: number): void {
    this.isLoading.set(true);

    this.organizationService.getOrganizationById(id).subscribe({
      next: (org: Organization) => {
        this.isLoading.set(false);
        this.populateFormFromOrganization(org);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error, 'Error');
        this.dismiss();
      },
    });
  }

  private dismiss(): void {
    if (this.isDialogMode() && this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.router.navigate(['/organizations']);
    }
  }

  private populateFormFromOrganization(org: Organization): void {
    this.organization = {
      organizerName: org.organizerName,
      email: org.email,
      phoneNumber: org.phoneNumber,
      website: org.website,
      addressLine1: org.addressLine1,
      addressLine2: org.addressLine2,
      city: org.city,
      stateProvince: org.stateProvince,
      postalCode: org.postalCode,
      country: org.country,
      taxId: org.taxId,
      registrationNumber: org.registrationNumber,
      maxOrganizerUsers: org.maxOrganizerUsers,
      maxDistributors: org.maxDistributors,
      subscriptionTier: org.subscriptionTier as SubscriptionTier | undefined,
      billingEmail: org.billingEmail,
    };
  }
}
