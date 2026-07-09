import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location, NgTemplateOutlet } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateEventRequest,
  Event,
  EventStatus,
  UpdateEventRequest,
} from '../../../core/models/event.model';

interface EventFormModel {
  eventName: string;
  eventDescription?: string;
  eventStartDate: Date;
  eventEndDate: Date;
  venueName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  timezone: string;
  organizationId: number;
}
import { EventService } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserRole } from '../../../core/models/user.model';
import { buildDirtyPatch, shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { EventListBus } from '../event-list-bus.service';
import {
  COUNTRY_OPTIONS,
  CountryOption,
  detectBrowserLocale,
  getCountryTimezones,
} from '../../../shared/constants/country-timezone.constant';

/**
 * Event Form Component
 * Handles both create and edit operations for events
 * Can be opened as a standalone route or as a dynamic dialog
 */
@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
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
  templateUrl: './event-form.html',
})
export class EventForm implements OnInit {
  // Optional injection for dialog mode
  public dialogConfig = inject(DynamicDialogConfig, { optional: true });
  public dialogRef = inject(DynamicDialogRef, { optional: true });
  isDialogMode = signal(false);
  event: EventFormModel = {
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
    timezone: '',
    organizationId: 0,
  };
  // Component state as signals
  isSubmitting = signal(false);
  isEditMode = signal(false);
  eventId = signal<number | null>(null);
  isLoading = signal(false);
  timezoneOptions = signal<string[]>([]);
  // Country and timezone data
  readonly countryOptions: CountryOption[] = COUNTRY_OPTIONS;
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;
  // Loaded event status (read-only). Status is changed only via the dedicated
  // status endpoint, not this form; kept here to enforce the timezone-lock rule.
  currentStatus = signal<EventStatus | null>(null);
  // Template utility function
  shouldShowError = shouldShowError;
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  // Check if user is ROOT or ADMIN (can create events for any organization)
  readonly isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private eventListBus = inject(EventListBus);

  ngOnInit(): void {
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
      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.isEditMode.set(true);
          this.eventId.set(id);
          this.loadEvent(id);
        } else {
          // Invalid ID, redirect to create mode
          this.router.navigate(['/events/new']);
        }
      }
    }

    // Set default organization for non-ROOT/ADMIN users
    if (!this.isRootOrAdmin && !this.isEditMode()) {
      const currentUser = this.authService.currentUser();
      if (currentUser?.organizationId) {
        this.event.organizationId = currentUser.organizationId;
      }
    }

    // Pre-fill country and timezone from browser locale (create mode only)
    if (!this.isEditMode()) {
      const locale = detectBrowserLocale();
      if (locale.country) {
        this.event.country = locale.country;
        this.timezoneOptions.set(getCountryTimezones(locale.country));
      }
      if (locale.timezone) {
        this.event.timezone = locale.timezone;
      }
    }
  }

  isTimezoneLocked(): boolean {
    const status = this.currentStatus();
    return (
      this.isEditMode() && (status === EventStatus.PUBLISHED || status === EventStatus.COMPLETED)
    );
  }

  onCountryChange(countryName: string): void {
    this.timezoneOptions.set(getCountryTimezones(countryName));
    this.event.timezone = '';
  }

  /**
   * Show organization dropdown only for ROOT/ADMIN and only in create mode
   * In edit mode, organization cannot be changed
   */
  showOrganizationDropdown(): boolean {
    return this.isRootOrAdmin && !this.isEditMode();
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
      this.toast.error('Organization is required. Please select an organization.');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditMode()) {
      this.updateEvent(form);
    } else {
      this.createEvent();
    }
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

  goBack(): void {
    this.location.back();
  }

  private dismiss(): void {
    if (this.isDialogMode() && this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.router.navigate(['/events']);
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
        this.errorHandler.showError(error, 'Error');
        this.isLoading.set(false);
        this.dismiss();
      },
    });
  }

  private parseDateFromStrings(date: string, time?: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    if (time) {
      const [h, min] = time.split(':').map(Number);
      return new Date(y, m - 1, d, h, min);
    }
    return new Date(y, m - 1, d);
  }

  private toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private toTimeString(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Populate form with event data
   */
  private populateForm(event: Event): void {
    if (event.country) {
      this.timezoneOptions.set(getCountryTimezones(event.country));
    }
    this.currentStatus.set(event.status);
    this.event = {
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      eventStartDate: this.parseDateFromStrings(event.eventStartDate, event.eventStartTime),
      eventEndDate: this.parseDateFromStrings(event.eventEndDate, event.eventEndTime),
      venueName: event.venueName || '',
      addressLine1: event.addressLine1,
      addressLine2: event.addressLine2,
      city: event.city,
      stateProvince: event.stateProvince,
      postalCode: event.postalCode,
      country: event.country,
      timezone: event.timezone ?? '',
      organizationId: event.organizationId,
    };
  }

  private buildCreateRequest(): CreateEventRequest {
    return {
      eventName: this.event.eventName,
      eventDescription: this.event.eventDescription,
      eventStartDate: this.toDateString(this.event.eventStartDate),
      eventStartTime: this.toTimeString(this.event.eventStartDate),
      eventEndDate: this.toDateString(this.event.eventEndDate),
      eventEndTime: this.toTimeString(this.event.eventEndDate),
      venueName: this.event.venueName,
      addressLine1: this.event.addressLine1,
      addressLine2: this.event.addressLine2,
      city: this.event.city,
      stateProvince: this.event.stateProvince,
      postalCode: this.event.postalCode,
      country: this.event.country,
      timezone: this.event.timezone,
      organizationId: this.event.organizationId,
    };
  }

  /**
   * Create new event
   */
  private createEvent(): void {
    this.eventService.createEvent(this.buildCreateRequest()).subscribe({
      next: (createdEvent) => {
        this.isSubmitting.set(false);
        this.eventListBus.publish({ action: 'created', event: createdEvent });

        if (this.isDialogMode() && this.dialogRef) {
          const successMessage = this.dialogConfig?.data?.successMessage;
          this.dialogRef.close({ event: createdEvent, message: successMessage });
        } else {
          this.toast.success('Event created successfully');
          setTimeout(() => this.location.back(), 1500);
        }
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Error');
        this.isSubmitting.set(false);
      },
    });
  }

  private buildPatchRequest(form: NgForm): UpdateEventRequest {
    const patch = buildDirtyPatch<UpdateEventRequest>(
      form,
      this.event,
      new Set(['eventStartDate', 'eventEndDate']),
    );

    if (form.controls['eventStartDate']?.dirty) {
      patch.eventStartDate = this.toDateString(this.event.eventStartDate);
      patch.eventStartTime = this.toTimeString(this.event.eventStartDate);
    }
    if (form.controls['eventEndDate']?.dirty) {
      patch.eventEndDate = this.toDateString(this.event.eventEndDate);
      patch.eventEndTime = this.toTimeString(this.event.eventEndDate);
    }

    return patch;
  }

  /**
   * Update existing event — sends only dirty fields as PATCH payload
   */
  private updateEvent(form: NgForm): void {
    const updateRequest = this.buildPatchRequest(form);

    if (Object.keys(updateRequest).length === 0) {
      this.isSubmitting.set(false);
      this.handleCancel();
      return;
    }

    this.eventService.updateEvent(this.eventId()!, updateRequest).subscribe({
      next: (updatedEvent) => {
        this.isSubmitting.set(false);
        this.eventListBus.publish({ action: 'updated', event: updatedEvent });

        if (this.isDialogMode() && this.dialogRef) {
          const successMessage = this.dialogConfig?.data?.successMessage;
          this.dialogRef.close({ event: updatedEvent, message: successMessage });
        } else {
          this.toast.success('Event updated successfully');
          setTimeout(() => this.location.back(), 1500);
        }
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Error');
        this.isSubmitting.set(false);
      },
    });
  }
}
