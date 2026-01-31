import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateEventRequest,
  UpdateEventRequest,
  EventStatus,
  Event,
} from '../../core/models/event.model';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { UserRole } from '../../core/models/user.model';
import { shouldShowError, initializeErrorHandler } from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';

/**
 * Manage Event Component
 * Handles both create and edit operations for events
 * Can be opened as a standalone route or as a dynamic dialog
 */
@Component({
  selector: 'app-manage-event',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    FloatLabelModule,
    ButtonModule,
    MessageModule,
    CardModule,
    SelectModule,
    DatePickerModule,
    SkeletonModule,
    OrganizationSelector,
  ],
  templateUrl: './manage-event.html',
})
export class ManageEvent implements OnInit {
  private eventService = inject(EventService);
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

  // Check if user is ROOT or ADMIN (can create events for any organization)
  readonly isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  // Form data as plain object for ngModel binding
  event: CreateEventRequest = {
    eventName: '',
    eventDescription: '',
    eventStartDate: new Date(),
    eventEndDate: new Date(),
    venueName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    status: EventStatus.DRAFT,
    organizationId: 0,
  };

  // Component state as signals
  isSubmitting = signal(false);
  isEditMode = signal(false);
  eventId = signal<number | null>(null);
  isLoading = signal(false);

  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;

  // Event status options for dropdown
  readonly statusOptions = [
    { label: 'Draft', value: EventStatus.DRAFT },
    { label: 'Published', value: EventStatus.PUBLISHED },
    { label: 'Cancelled', value: EventStatus.CANCELLED },
    { label: 'Completed', value: EventStatus.COMPLETED },
  ];

  // Template utility function
  shouldShowError = shouldShowError;
  protected datetime12h: any;

  ngOnInit(): void {
    initializeErrorHandler(this.errorHandler, this.messageService);

    // Check if opened in dialog mode
    if (this.dialogConfig?.data) {
      this.isDialogMode.set(true);
      const dialogData = this.dialogConfig.data;

      if (dialogData.isEditMode && dialogData.eventId) {
        this.isEditMode.set(true);
        this.eventId.set(dialogData.eventId);
        this.loadEvent(dialogData.eventId);
      }

      // Pre-fill organizationId if provided (for create mode)
      if (dialogData.organizationId && !dialogData.isEditMode) {
        this.event.organizationId = dialogData.organizationId;
      }
    } else {
      // Route mode - check for ID in URL params
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.eventId.set(Number(id));
        this.loadEvent(Number(id));
      }
    }

    // Set default organization for non-ROOT/ADMIN users
    if (!this.isRootOrAdmin && !this.isEditMode()) {
      const currentUser = this.authService.currentUser();
      if (currentUser?.organizationId) {
        this.event.organizationId = currentUser.organizationId;
      }
    }
  }

  /**
   * Load event data for edit mode
   */
  private loadEvent(id: number): void {
    this.isLoading.set(true);
    this.eventService.getEventById(id).subscribe({
      next: (event) => {
        this.populateForm(event);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load event');
        this.isLoading.set(false);
        this.handleCancel();
      },
    });
  }

  /**
   * Populate form with event data
   */
  private populateForm(event: Event): void {
    this.event = {
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      eventStartDate: new Date(event.eventStartDate),
      eventEndDate: new Date(event.eventEndDate),
      venueName: event.venueName,
      addressLine1: event.addressLine1,
      addressLine2: event.addressLine2,
      city: event.city,
      stateProvince: event.stateProvince,
      postalCode: event.postalCode,
      country: event.country,
      status: event.status,
      organizationId: event.organizationId,
    };
  }

  /**
   * Show organization dropdown only for ROOT/ADMIN
   */
  showOrganizationDropdown(): boolean {
    return this.isRootOrAdmin;
  }

  /**
   * Submit form - create or update event
   */
  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    // Validate organizationId is set
    if (!this.event.organizationId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Organization is required. Please select an organization.',
      });
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditMode()) {
      this.updateEvent();
    } else {
      this.createEvent();
    }
  }

  /**
   * Create new event
   */
  private createEvent(): void {
    this.eventService.createEvent(this.event).subscribe({
      next: (createdEvent) => {
        this.isSubmitting.set(false);

        if (this.isDialogMode() && this.dialogRef) {
          const successMessage = this.dialogConfig?.data?.successMessage;
          this.dialogRef.close({ event: createdEvent, message: successMessage });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Event created successfully',
          });
          this.router.navigate(['/events']);
        }
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to create event');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Update existing event
   */
  private updateEvent(): void {
    const updateRequest: UpdateEventRequest = {
      eventName: this.event.eventName,
      eventDescription: this.event.eventDescription,
      eventStartDate: this.event.eventStartDate,
      eventEndDate: this.event.eventEndDate,
      venueName: this.event.venueName,
      addressLine1: this.event.addressLine1,
      addressLine2: this.event.addressLine2,
      city: this.event.city,
      stateProvince: this.event.stateProvince,
      postalCode: this.event.postalCode,
      country: this.event.country,
      status: this.event.status,
    };

    this.eventService.updateEvent(this.eventId()!, updateRequest).subscribe({
      next: (updatedEvent) => {
        this.isSubmitting.set(false);

        if (this.isDialogMode() && this.dialogRef) {
          const successMessage = this.dialogConfig?.data?.successMessage;
          this.dialogRef.close({ event: updatedEvent, message: successMessage });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Event updated successfully',
          });
          this.router.navigate(['/events']);
        }
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to update event');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Cancel and go back or close dialog
   */
  handleCancel(): void {
    if (this.isDialogMode()) {
      this.dialogRef?.close();
    } else {
      this.location.back();
    }
  }

  /**
   * Get page title based on mode
   */
  getTitle(): string {
    return this.isEditMode() ? 'Edit Event' : 'Create Event';
  }

  /**
   * Get submit button text based on state
   */
  getSubmitButtonText(): string {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode() ? 'Update Event' : 'Create Event';
  }
}
