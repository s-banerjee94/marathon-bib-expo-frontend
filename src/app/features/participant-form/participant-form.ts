import { Component, inject, signal, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateParticipantRequest,
  UpdateParticipantRequest,
  Participant,
} from '../../core/models/participant.model';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { EventSelector } from '../../components/event-selector/event-selector';
import { shouldShowError, initializeErrorHandler } from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { GENDER_OPTIONS } from '../../shared/constants/participant-columns.constant';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-participant-form',
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
    SkeletonModule,
    InputNumberModule,
    OrganizationSelector,
    EventSelector,
  ],
  templateUrl: './participant-form.html',
  styleUrl: './participant-form.css',
})
export class ParticipantForm implements OnInit {
  private participantService = inject(ParticipantService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  // Optional injection for dialog mode (DynamicDialog)
  private injectedDialogConfig = inject(DynamicDialogConfig, { optional: true });
  public dialogRef = inject(DynamicDialogRef, { optional: true });

  // Input for dialog mode (regular p-dialog) - pass data directly
  @Input() dialogData?: {
    eventId: number;
    bibNumber?: string;
    isEditMode: boolean;
  };

  // Event emitter for successful form submission (used when not in DynamicDialog mode)
  @Output() formSubmitSuccess = new EventEmitter<Participant>();

  isDialogMode = signal(false);

  // Form data as plain object for ngModel binding
  participant = {
    chipNumber: '',
    bibNumber: '',
    fullName: '',
    raceId: '',
    raceName: '',
    categoryId: '',
    categoryName: '',
    gender: '',
    phoneNumber: '',
    email: '',
    dateOfBirth: '',
    age: null as number | null,
    country: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
  };

  // Component state as signals
  isSubmitting = signal(false);
  isEditMode = signal(false);
  eventId = signal<number | null>(null);
  bibNumber = signal<string | null>(null);
  isLoading = signal(false);

  // Organization/Event selection for route mode
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);

  // Gender options
  genderOptions = GENDER_OPTIONS.filter((opt) => opt.value !== ''); // Remove "All Genders" option

  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;

  ngOnInit(): void {
    initializeErrorHandler(this.errorHandler, this.messageService);

    // Check if opened in dialog mode (either via Input or DynamicDialog injection)
    const dialogData = this.dialogData || this.injectedDialogConfig?.data;

    if (dialogData) {
      this.isDialogMode.set(true);

      // In dialog mode, eventId is always provided
      if (dialogData.eventId) {
        this.eventId.set(dialogData.eventId);
      }

      if (dialogData.isEditMode && dialogData.bibNumber) {
        this.isEditMode.set(true);
        this.bibNumber.set(dialogData.bibNumber);
        this.loadParticipantData(dialogData.eventId, dialogData.bibNumber);
      }
    } else {
      // Route-based mode
      this.isDialogMode.set(false);

      const eventIdParam = this.route.snapshot.paramMap.get('eventId');
      const bibNumberParam = this.route.snapshot.paramMap.get('bibNumber');

      if (eventIdParam && bibNumberParam) {
        // Edit mode
        const id = parseInt(eventIdParam, 10);
        if (!isNaN(id)) {
          this.isEditMode.set(true);
          this.eventId.set(id);
          this.bibNumber.set(bibNumberParam);
          this.selectedEventId.set(id);
          this.loadParticipantData(id, bibNumberParam);
        } else {
          // Invalid ID, redirect to create mode
          this.router.navigate(['/participant-form']);
        }
      } else {
        // Create mode - default state
        this.isEditMode.set(false);
        this.eventId.set(null);
        this.bibNumber.set(null);

        // Auto-set organization for org users
        const currentRole = this.authService.getCurrentRole();
        if (currentRole === UserRole.ORGANIZER_ADMIN || currentRole === UserRole.ORGANIZER_USER) {
          const orgId = this.authService.currentUser()?.organizationId;
          if (orgId) {
            this.selectedOrganizationId.set(orgId);
          }
        }
      }
    }
  }

  private loadParticipantData(eventId: number, bibNumber: string): void {
    this.isLoading.set(true);

    this.participantService.getParticipantByBibNumber(eventId, bibNumber).subscribe({
      next: (participantData: Participant) => {
        this.populateFormFromParticipant(participantData);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error, 'Error', {
          customMessage: 'Failed to load participant data. Please try again.',
        });
        if (!this.isDialogMode()) {
          this.router.navigate([this.authService.getDashboardRoute()]);
        }
      },
    });
  }

  private populateFormFromParticipant(participantData: Participant): void {
    this.participant = {
      chipNumber: participantData.chipNumber || '',
      bibNumber: participantData.bibNumber || '',
      fullName: participantData.fullName || '',
      raceId: participantData.raceId || '',
      raceName: participantData.raceName || '',
      categoryId: participantData.categoryId || '',
      categoryName: participantData.categoryName || '',
      gender: participantData.gender || '',
      phoneNumber: participantData.phoneNumber || '',
      email: participantData.email || '',
      dateOfBirth: participantData.dateOfBirth || '',
      age: participantData.age || null,
      country: participantData.country || '',
      city: participantData.city || '',
      emergencyContactName: participantData.emergencyContactName || '',
      emergencyContactPhone: participantData.emergencyContactPhone || '',
      notes: participantData.notes || '',
    };
  }

  onOrganizationChange(organizationId: number | undefined): void {
    this.selectedOrganizationId.set(organizationId);
    this.selectedEventId.set(undefined);
  }

  onEventChange(eventId: number | undefined): void {
    this.selectedEventId.set(eventId);
  }

  showOrganizationSelector(): boolean {
    // Show org selector only in route mode
    if (this.isDialogMode()) {
      return false;
    }

    // For ROOT/ADMIN, show in create mode
    const currentRole = this.authService.getCurrentRole();
    if (currentRole === UserRole.ROOT || currentRole === UserRole.ADMIN) {
      return !this.isEditMode();
    }

    return false;
  }

  showEventSelector(): boolean {
    // Show event selector only in route mode
    if (this.isDialogMode()) {
      return false;
    }

    // Show in create mode after organization is selected
    if (!this.isEditMode()) {
      const currentRole = this.authService.getCurrentRole();
      if (currentRole === UserRole.ROOT || currentRole === UserRole.ADMIN) {
        return this.selectedOrganizationId() !== undefined;
      }
      // For org users, always show
      return true;
    }

    return false;
  }

  shouldShowError = shouldShowError;

  // Public method to submit form (can be called from parent)
  public submitForm(): void {
    if (this.isDialogMode()) {
      // Trigger form submission programmatically
      const form = document.getElementById('participantFormDialog') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    const model = this.participant;

    // Validate required fields
    if (
      !model.chipNumber ||
      !model.bibNumber ||
      !model.fullName ||
      !model.raceId ||
      !model.raceName ||
      !model.categoryId ||
      !model.categoryName ||
      !model.gender
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields',
      });
      return;
    }

    // Validate conditional requirements
    if (!model.phoneNumber && !model.email) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Either phone number or email must be provided',
      });
      return;
    }

    if (!model.dateOfBirth && !model.age) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Either date of birth or age must be provided',
      });
      return;
    }

    // Validate event selection for route mode
    const targetEventId = this.isDialogMode() ? this.eventId() : this.selectedEventId();

    if (!targetEventId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Event is required. Please select an event.',
      });
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.bibNumber()) {
      // Edit mode
      const updateRequest: UpdateParticipantRequest = {
        chipNumber: model.chipNumber,
        fullName: model.fullName,
        email: model.email || undefined,
        phoneNumber: model.phoneNumber || undefined,
        dateOfBirth: model.dateOfBirth || undefined,
        age: model.age || undefined,
        gender: model.gender,
        country: model.country || undefined,
        city: model.city || undefined,
        raceId: model.raceId,
        categoryId: model.categoryId,
        emergencyContactName: model.emergencyContactName || undefined,
        emergencyContactPhone: model.emergencyContactPhone || undefined,
        notes: model.notes || undefined,
      };

      this.participantService
        .updateParticipant(targetEventId, this.bibNumber()!, updateRequest)
        .subscribe({
          next: (updatedParticipant: Participant) => {
            this.isSubmitting.set(false);

            // Close dialog or show message based on mode
            if (this.isDialogMode() && this.dialogRef) {
              // DynamicDialog mode - close with result
              const successMessage = this.injectedDialogConfig?.data?.successMessage;
              this.dialogRef!.close({
                participant: updatedParticipant,
                message: successMessage,
              });
            } else if (this.isDialogMode()) {
              // Regular p-dialog mode - emit event for parent
              this.formSubmitSuccess.emit(updatedParticipant);
            } else {
              // Route mode - show toast and navigate back
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Participant updated successfully',
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
      const createRequest: CreateParticipantRequest = {
        chipNumber: model.chipNumber,
        bibNumber: model.bibNumber,
        fullName: model.fullName,
        raceId: Number(model.raceId),
        raceName: model.raceName,
        categoryId: Number(model.categoryId),
        categoryName: model.categoryName,
        gender: model.gender,
        phoneNumber: model.phoneNumber || undefined,
        email: model.email || undefined,
        dateOfBirth: model.dateOfBirth || undefined,
        age: model.age || undefined,
        country: model.country || undefined,
        city: model.city || undefined,
        emergencyContactName: model.emergencyContactName || undefined,
        emergencyContactPhone: model.emergencyContactPhone || undefined,
        notes: model.notes || undefined,
      };

      this.participantService.createParticipant(targetEventId, createRequest).subscribe({
        next: (createdParticipant: Participant) => {
          this.isSubmitting.set(false);

          // Close dialog or reset form based on mode
          if (this.isDialogMode() && this.dialogRef) {
            // DynamicDialog mode - close with result
            const successMessage = this.injectedDialogConfig?.data?.successMessage;
            this.dialogRef!.close({
              participant: createdParticipant,
              message: successMessage,
            });
          } else if (this.isDialogMode()) {
            // Regular p-dialog mode - emit event for parent
            this.formSubmitSuccess.emit(createdParticipant);
          } else {
            // Route mode - show toast and reset form
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Participant created successfully',
            });
            setTimeout(() => {
              form.resetForm();
              this.participant = {
                chipNumber: '',
                bibNumber: '',
                fullName: '',
                raceId: '',
                raceName: '',
                categoryId: '',
                categoryName: '',
                gender: '',
                phoneNumber: '',
                email: '',
                dateOfBirth: '',
                age: null,
                country: '',
                city: '',
                emergencyContactName: '',
                emergencyContactPhone: '',
                notes: '',
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

  onCancel(): void {
    if (this.isDialogMode() && this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.location.back();
    }
  }

  getTitle(): string {
    return this.isEditMode() ? 'Edit Participant' : 'Create Participant';
  }

  getSubmitButtonText(): string {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode() ? 'Update Participant' : 'Create Participant';
  }
}
