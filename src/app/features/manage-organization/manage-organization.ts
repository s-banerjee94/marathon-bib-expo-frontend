import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateOrganizationRequest,
  SubscriptionTier,
  Organization,
} from '../../core/models/organization.model';
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { initializeErrorHandler } from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { SUBSCRIPTION_TIER_OPTIONS } from '../../shared/constants/subscription.constant';

@Component({
  selector: 'app-manage-organization',
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
  templateUrl: './manage-organization.html',
  styleUrl: './manage-organization.css',
})
export class ManageOrganization implements OnInit {
  private organizationService = inject(OrganizationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

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

  ngOnInit(): void {
    initializeErrorHandler(this.errorHandler, this.messageService);

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
          this.router.navigate(['/manage-organization']);
        }
      } else {
        // Create mode - default state
        this.isEditMode.set(false);
        this.organizationId.set(null);
      }
    }
  }

  private loadOrganizationData(id: number): void {
    this.isLoading.set(true);

    this.organizationService.getOrganizationById(id).subscribe({
      next: (org: Organization) => {
        this.populateFormFromOrganization(org);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error, 'Error', {
          customMessage: 'Failed to load organization data. Please try again.',
        });
        this.router.navigate([this.authService.getDashboardRoute()]);
      },
    });
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

            // Close dialog or navigate back based on mode
            if (this.isDialogMode() && this.dialogRef) {
              // Close immediately - parent will show toast with custom message from dialog data
              const successMessage = this.dialogConfig?.data?.successMessage;
              this.dialogRef!.close({ organization: updatedOrg, message: successMessage });
            } else {
              // Show toast for non-dialog mode
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Organization updated successfully',
              });
              setTimeout(() => {
                this.location.back();
              }, 1500);
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

          // Close dialog or reset form based on mode
          if (this.isDialogMode() && this.dialogRef) {
            // Close immediately - parent will show toast with custom message from dialog data
            const successMessage = this.dialogConfig?.data?.successMessage;
            this.dialogRef!.close({ organization: createdOrg, message: successMessage });
          } else {
            // Show toast for non-dialog mode
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Organization created successfully',
            });
            // Reset form for creating another organization
            setTimeout(() => {
              form.resetForm();
              this.organization = {
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
            }, 1500);
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error, 'Error');
        },
      });
    }
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
}
