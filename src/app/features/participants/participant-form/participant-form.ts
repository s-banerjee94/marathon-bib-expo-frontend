import { Component, computed, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateParticipantRequest,
  Participant,
  UpdateParticipantRequest,
} from '../../../core/models/participant.model';
import { Race } from '../../../core/models/race.model';
import { Category } from '../../../core/models/category.model';
import { ParticipantService } from '../../../core/services/participant.service';
import { RaceService } from '../../../core/services/race.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { EventSelector } from '../../../layout/event-selector/event-selector';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { GENDER_OPTIONS } from '../../../shared/constants/participant-columns.constant';
import { UserRole } from '../../../core/models/user.model';
import { ParticipantListBus } from '../participant-list-bus.service';

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
    DatePickerModule,
    DividerModule,
    OrganizationSelector,
    EventSelector,
  ],
  templateUrl: './participant-form.html',
  styleUrl: './participant-form.css',
})
export class ParticipantForm implements OnInit {
  public dialogRef = inject(DynamicDialogRef, { optional: true });
  // Signal input for dialog mode (regular p-dialog) — pass data directly
  readonly dialogData = input<{ eventId: number; bibNumber?: string; isEditMode: boolean }>();
  // Emitted on successful form submission (used when not in DynamicDialog mode)
  readonly formSubmitSuccess = output<Participant>();
  // Emits whenever the submit-disabled state may have changed so the parent dialog can disable its button.
  readonly submitDisabledChange = output<boolean>();
  isDialogMode = signal(false);
  // Form data as plain object for ngModel binding
  participant = {
    chipNumber: '',
    bibNumber: '',
    fullName: '',
    raceId: null as number | null,
    raceName: '',
    categoryId: null as number | null,
    categoryName: '',
    gender: '',
    phoneNumber: '',
    email: '',
    dateOfBirth: null as Date | null,
    age: null as number | null,
    country: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
  };
  // Dynamic goodies rows (key=goodie name, value=size or value)
  goodieEntries: { key: string; value: string }[] = [];
  // Dynamic additional field rows (free-form key-value pairs)
  additionalFieldEntries: { key: string; value: string }[] = [];
  // Component state as signals
  isSubmitting = signal(false);
  isEditMode = signal(false);
  eventId = signal<number | null>(null);
  bibNumber = signal<string | null>(null);
  isLoading = signal(false);
  // Organization/Event selection for route mode
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);
  // Race / Category dropdown state
  races = signal<Race[]>([]);
  categories = signal<Category[]>([]);
  isLoadingRaces = signal(false);
  isLoadingCategories = signal(false);
  // Most fields require a known event context (route-mode picks via selector, dialog-mode passes it in).
  inputsDisabled = computed(() => {
    const eventCtx = this.isDialogMode() ? this.eventId() : this.selectedEventId();
    return !eventCtx;
  });
  // Gender options
  genderOptions = GENDER_OPTIONS.filter((opt) => opt.value !== ''); // Remove "All Genders" option
  // Upper bound for DOB picker — no future birthdays.
  readonly today = new Date();
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;
  private participantService = inject(ParticipantService);
  private raceService = inject(RaceService);
  private categoryService = inject(CategoryService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private participantListBus = inject(ParticipantListBus);
  // Optional injection for dialog mode (DynamicDialog)
  private injectedDialogConfig = inject(DynamicDialogConfig, { optional: true });

  constructor() {
    // Re-emit submit-disabled whenever any tracked signal changes (isSubmitting flip, event/dialog ctx changes).
    effect(() => {
      this.isSubmitting();
      this.eventId();
      this.selectedEventId();
      this.isDialogMode();
      this.notifySubmitState();
    });
  }

  ngOnInit(): void {
    // Check if opened in dialog mode (either via Input or DynamicDialog injection)
    const dialogData = this.dialogData() ?? this.injectedDialogConfig?.data;

    if (dialogData) {
      this.isDialogMode.set(true);

      // In dialog mode, eventId is always provided
      if (dialogData.eventId) {
        this.eventId.set(dialogData.eventId);
        this.loadRaces(dialogData.eventId);
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
      const bibParam = this.route.snapshot.paramMap.get('bib');

      if (eventIdParam && bibParam) {
        // Edit mode
        const id = parseInt(eventIdParam, 10);
        if (!isNaN(id)) {
          this.isEditMode.set(true);
          this.eventId.set(id);
          this.bibNumber.set(bibParam);
          this.selectedEventId.set(id);
          this.loadRaces(id);
          this.loadParticipantData(id, bibParam);
        } else {
          // Invalid params, redirect to create mode
          this.router.navigate(['/participants/new']);
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

  onOrganizationChange(organizationId: number | undefined): void {
    this.selectedOrganizationId.set(organizationId);
    this.selectedEventId.set(undefined);
    this.resetRaceAndCategory();
    this.races.set([]);
    this.notifySubmitState();
  }

  onEventChange(eventId: number | undefined): void {
    this.selectedEventId.set(eventId);
    this.resetRaceAndCategory();
    if (eventId) {
      this.loadRaces(eventId);
    } else {
      this.races.set([]);
    }
    this.notifySubmitState();
  }

  onRaceChange(): void {
    const raceId = this.participant.raceId;
    // Reset category whenever race changes
    this.participant.categoryId = null;
    this.participant.categoryName = '';
    this.categories.set([]);

    if (raceId === null || raceId === undefined) {
      this.participant.raceName = '';
      this.notifySubmitState();
      return;
    }

    const race = this.races().find((r) => r.id === Number(raceId));
    this.participant.raceName = race?.raceName ?? '';

    const targetEventId = this.isDialogMode() ? this.eventId() : this.selectedEventId();
    if (targetEventId && race) {
      this.loadCategories(targetEventId, race.id);
    }
    this.notifySubmitState();
  }

  onCategoryChange(): void {
    const categoryId = this.participant.categoryId;
    if (categoryId === null || categoryId === undefined) {
      this.participant.categoryName = '';
      this.notifySubmitState();
      return;
    }
    const category = this.categories().find((c) => c.id === Number(categoryId));
    this.participant.categoryName = category?.categoryName ?? '';
    this.notifySubmitState();
  }

  private resetRaceAndCategory(): void {
    this.participant.raceId = null;
    this.participant.raceName = '';
    this.participant.categoryId = null;
    this.participant.categoryName = '';
    this.categories.set([]);
  }

  private loadRaces(eventId: number): void {
    this.isLoadingRaces.set(true);
    this.raceService.getRacesByEventId(eventId).subscribe({
      next: (races) => {
        this.races.set(races);
        this.isLoadingRaces.set(false);
      },
      error: (error) => {
        this.isLoadingRaces.set(false);
        this.errorHandler.showError(error, 'Failed to load races');
      },
    });
  }

  private loadCategories(eventId: number, raceId: number): void {
    this.isLoadingCategories.set(true);
    this.categoryService.getCategoriesByRaceId(eventId, raceId).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoadingCategories.set(false);
      },
      error: (error) => {
        this.isLoadingCategories.set(false);
        this.errorHandler.showError(error, 'Failed to load categories');
      },
    });
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

  // Parameterless so the route-mode button can bind directly and the parent dialog can read it via output.
  isSubmitDisabled(): boolean {
    if (this.isSubmitting()) return true;

    const m = this.participant;
    if (!m.chipNumber?.trim()) return true;
    if (!m.bibNumber?.trim()) return true;
    if (!m.fullName?.trim()) return true;
    if (!m.raceId || !m.raceName) return true;
    if (!m.categoryId || !m.categoryName) return true;
    if (!m.gender) return true;
    // Mirrors Angular's `email` directive — only validate when a value is present.
    if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return true;
    if (!m.phoneNumber && !m.email) return true;
    if (!m.dateOfBirth && !m.age) return true;

    const eventCtx = this.isDialogMode() ? this.eventId() : this.selectedEventId();
    if (!eventCtx) return true;

    return false;
  }

  // Called from template events whenever the participant model may have changed.
  notifySubmitState(): void {
    this.submitDisabledChange.emit(this.isSubmitDisabled());
  }

  onSubmit(_form: NgForm): void {
    // Submit button is gated by isSubmitDisabled(); these checks are defensive only.
    if (this.isSubmitDisabled()) {
      return;
    }

    const model = this.participant;
    const targetEventId = (this.isDialogMode() ? this.eventId() : this.selectedEventId())!;

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.bibNumber()) {
      // Edit mode
      const updateRequest: UpdateParticipantRequest = {
        chipNumber: model.chipNumber,
        fullName: model.fullName,
        email: model.email || undefined,
        phoneNumber: model.phoneNumber || undefined,
        dateOfBirth: this.formatDateForWire(model.dateOfBirth),
        age: model.age || undefined,
        gender: model.gender,
        country: model.country || undefined,
        city: model.city || undefined,
        raceId: String(model.raceId),
        categoryId: String(model.categoryId),
        emergencyContactName: model.emergencyContactName || undefined,
        emergencyContactPhone: model.emergencyContactPhone || undefined,
        notes: model.notes || undefined,
      };

      this.participantService
        .updateParticipant(targetEventId, this.bibNumber()!, updateRequest)
        .subscribe({
          next: (updatedParticipant: Participant) => {
            this.isSubmitting.set(false);
            this.participantListBus.publish({ action: 'updated', participant: updatedParticipant });

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
              // Route mode - navigate back after brief delay
              this.toast.success('Participant updated successfully');
              setTimeout(() => this.location.back(), 1500);
            }
          },
          error: (error) => {
            this.isSubmitting.set(false);
            this.errorHandler.showError(error);
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
        dateOfBirth: this.formatDateForWire(model.dateOfBirth),
        age: model.age || undefined,
        country: model.country || undefined,
        city: model.city || undefined,
        emergencyContactName: model.emergencyContactName || undefined,
        emergencyContactPhone: model.emergencyContactPhone || undefined,
        notes: model.notes || undefined,
        goodies: this.buildGoodiesMap(),
        additionalFields: this.buildAdditionalFieldsMap(),
      };

      this.participantService.createParticipant(targetEventId, createRequest).subscribe({
        next: (createdParticipant: Participant) => {
          this.isSubmitting.set(false);
          this.participantListBus.publish({ action: 'created', participant: createdParticipant });

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
            // Route mode - navigate back after brief delay
            this.toast.success('Participant created successfully');
            setTimeout(() => this.location.back(), 1500);
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error);
        },
      });
    }
  }

  addGoodie(): void {
    this.goodieEntries = [...this.goodieEntries, { key: '', value: '' }];
  }

  removeGoodie(index: number): void {
    this.goodieEntries = this.goodieEntries.filter((_, i) => i !== index);
  }

  addAdditionalField(): void {
    if (this.additionalFieldEntries.length >= 10) return;
    this.additionalFieldEntries = [...this.additionalFieldEntries, { key: '', value: '' }];
  }

  removeAdditionalField(index: number): void {
    this.additionalFieldEntries = this.additionalFieldEntries.filter((_, i) => i !== index);
  }

  goBack(): void {
    this.location.back();
  }

  onCancel(): void {
    this.dismiss();
  }

  private dismiss(): void {
    if (this.isDialogMode() && this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.router.navigate(['/participants']);
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

  private loadParticipantData(eventId: number, bibNumber: string): void {
    this.isLoading.set(true);

    this.participantService.getParticipantByBibNumber(eventId, bibNumber).subscribe({
      next: (participantData: Participant) => {
        this.populateFormFromParticipant(participantData);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error);
        if (!this.isDialogMode()) {
          this.router.navigate(['/participants']);
        }
      },
    });
  }

  private populateFormFromParticipant(participantData: Participant): void {
    const raceIdNum = participantData.raceId ? Number(participantData.raceId) : null;
    const categoryIdNum = participantData.categoryId ? Number(participantData.categoryId) : null;

    this.participant = {
      chipNumber: participantData.chipNumber || '',
      bibNumber: participantData.bibNumber || '',
      fullName: participantData.fullName || '',
      raceId: raceIdNum,
      raceName: participantData.raceName || '',
      categoryId: categoryIdNum,
      categoryName: participantData.categoryName || '',
      gender: participantData.gender || '',
      phoneNumber: participantData.phoneNumber || '',
      email: participantData.email || '',
      dateOfBirth: this.parseDateFromWire(participantData.dateOfBirth),
      age: participantData.age || null,
      country: participantData.country || '',
      city: participantData.city || '',
      emergencyContactName: participantData.emergencyContactName || '',
      emergencyContactPhone: participantData.emergencyContactPhone || '',
      notes: participantData.notes || '',
    };

    // Load existing goodies into editable entries
    this.goodieEntries = participantData.goodies
      ? Object.entries(participantData.goodies).map(([key, value]) => ({ key, value }))
      : [];

    // Load existing additional fields into editable entries
    this.additionalFieldEntries = participantData.additionalFields
      ? Object.entries(participantData.additionalFields).map(([key, value]) => ({ key, value }))
      : [];

    // Load categories for the participant's race so the category dropdown can render
    const targetEventId = this.isDialogMode() ? this.eventId() : this.selectedEventId();
    if (targetEventId && raceIdNum) {
      this.loadCategories(targetEventId, raceIdNum);
    }
    this.notifySubmitState();
  }

  private buildGoodiesMap(): { [key: string]: string } | undefined {
    const filled = this.goodieEntries.filter((e) => e.key.trim());
    if (filled.length === 0) return undefined;
    return Object.fromEntries(filled.map((e) => [e.key.trim(), e.value.trim()]));
  }

  private buildAdditionalFieldsMap(): { [key: string]: string } | undefined {
    const filled = this.additionalFieldEntries.filter((e) => e.key.trim());
    if (filled.length === 0) return undefined;
    return Object.fromEntries(filled.map((e) => [e.key.trim(), e.value.trim()]));
  }

  // Wire format stays "dd-MM-yyyy" (legacy contract); the picker only changes display to "10-Jan-1994".
  private formatDateForWire(date: Date | null): string | undefined {
    if (!date) return undefined;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Accept both legacy "dd-MM-yyyy" and ISO "yyyy-MM-dd" so old and new backend rows both load.
  private parseDateFromWire(value: string | undefined): Date | null {
    if (!value) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(value);
    if (dmy) {
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }
    return null;
  }
}
