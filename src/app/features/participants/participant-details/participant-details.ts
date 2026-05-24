import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { Participant, UpdateParticipantRequest } from '../../../core/models/participant.model';
import { Race, Category } from '../../../core/models/event.model';
import { ParticipantService } from '../../../core/services/participant.service';
import { EventService } from '../../../core/services/event.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import {
  formatGoodiesKey,
  getGenderDisplay,
  getGenderSeverity,
  parseDob,
} from '../../../shared/utils/participant.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { ParticipantListBus } from '../participant-list-bus.service';
import { EditableFieldRow } from './editable-field-row';

type FieldKey =
  | 'fullName'
  | 'gender'
  | 'dateOfBirth'
  | 'age'
  | 'email'
  | 'phoneNumber'
  | 'city'
  | 'country'
  | 'raceId'
  | 'categoryId'
  | 'chipNumber'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'notes';

@Component({
  selector: 'app-participant-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-details.html',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    TagModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule,
    TextareaModule,
    SkeletonModule,
    TooltipModule,
    DefaultValuePipe,
    EditableFieldRow,
  ],
})
export class ParticipantDetails {
  // Inputs — eventId comes from either a number (host binding) or string (route param).
  eventId = input.required<number, number | string>({ transform: (v) => Number(v) });
  bibNumber = input.required<string>();
  editable = input<boolean>(false);

  // Outputs
  closed = output<void>();
  participantUpdated = output<Participant>();

  private readonly participantService = inject(ParticipantService);
  private readonly eventService = inject(EventService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly bus = inject(ParticipantListBus);

  // Data
  protected readonly participant = signal<Participant | null>(null);
  protected readonly isLoading = signal(true);

  // Edit lifecycle — only one field at a time can be editing.
  protected readonly editingField = signal<FieldKey | null>(null);
  protected readonly savingField = signal<FieldKey | null>(null);
  // Working value for the field currently being edited. Plain (non-signal) so
  // ngModel two-way binding mutates it directly.
  protected workingValue: string | number | Date | null = null;
  // Used only when editing 'raceId': holds the user's category pick alongside
  // the race pick. The save commits both atomically — race change forces a
  // new category selection in the same operation.
  protected workingCategoryValue: number | null = null;

  // Race / category options — lazy-loaded only when the field is edited.
  protected readonly races = signal<Race[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoadingRaces = signal(false);
  protected readonly isLoadingCategories = signal(false);

  protected readonly inputSize = FORM_INPUT_SIZE;
  protected readonly today = new Date();
  protected readonly genderOptions = [
    { label: 'Male', value: 'M' },
    { label: 'Female', value: 'F' },
    { label: 'Other', value: 'O' },
  ];

  protected getGenderDisplay = getGenderDisplay;
  protected getGenderSeverity = getGenderSeverity;
  protected parseDob = parseDob;
  protected formatGoodiesKey = formatGoodiesKey;

  protected readonly goodiesEntries = computed(() => {
    const g = this.participant()?.goodies;
    if (!g) return [];
    return Object.entries(g).map(([key, value]) => ({ key, value: String(value) }));
  });

  protected readonly distributionEntries = computed(() => {
    const p = this.participant();
    const goodies = p?.goodies;
    const dist = p?.goodiesDistribution;
    if (!goodies) return [];
    return Object.keys(goodies).map((key) => ({
      key,
      distributed: !!(dist && dist[key]),
    }));
  });

  constructor() {
    effect(() => {
      const id = this.eventId();
      const bib = this.bibNumber();
      if (id && bib) {
        untracked(() => this.loadParticipant(id, bib));
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.editingField() && !this.savingField()) {
      this.cancelEdit();
    }
  }

  // ---------- Data loading ----------
  private loadParticipant(eventId: number, bibNumber: string): void {
    this.isLoading.set(true);
    this.participantService.getParticipantByBibNumber(eventId, bibNumber).subscribe({
      next: (p) => {
        this.participant.set(p);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorHandler.showError(err, 'Failed to load participant details');
      },
    });
  }

  private loadRacesIfNeeded(): void {
    if (this.races().length > 0 || this.isLoadingRaces()) return;
    const id = this.eventId();
    if (!id) return;
    this.isLoadingRaces.set(true);
    this.eventService.getRaces(id).subscribe({
      next: (races) => {
        this.races.set(races);
        this.isLoadingRaces.set(false);
      },
      error: () => this.isLoadingRaces.set(false),
    });
  }

  private loadCategoriesForRace(raceId: number): void {
    const id = this.eventId();
    if (!id) return;
    this.isLoadingCategories.set(true);
    this.categories.set([]);
    this.eventService.getCategoriesByRace(id, raceId).subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.isLoadingCategories.set(false);
      },
      error: () => this.isLoadingCategories.set(false),
    });
  }

  // ---------- Edit lifecycle ----------
  protected startEdit(field: FieldKey, currentValue: string | number | null | undefined): void {
    if (!this.editable()) return;
    if (this.savingField()) return;

    this.workingValue = this.normalizeForEdit(field, currentValue);
    this.editingField.set(field);

    if (field === 'raceId') {
      // Race edit pulls in category too — load both lists, seed category
      // with the participant's current pick so it's visible until the user
      // (forced to) repicks after changing race.
      this.loadRacesIfNeeded();
      const p = this.participant();
      const rid = p?.raceId ? Number(p.raceId) : NaN;
      this.workingCategoryValue = p?.categoryId ? Number(p.categoryId) : null;
      if (!isNaN(rid)) this.loadCategoriesForRace(rid);
    } else if (field === 'categoryId') {
      const p = this.participant();
      const rid = p?.raceId ? Number(p.raceId) : NaN;
      if (!isNaN(rid)) this.loadCategoriesForRace(rid);
    }
  }

  // Called from the race dropdown's (onChange) — resets the in-flight category
  // and reloads the category list for the newly picked race. The user must pick
  // a category before save is allowed.
  protected onRaceSelectionChange(): void {
    const v = this.workingValue;
    if (v == null || v === '') return;
    const rid = Number(v);
    if (isNaN(rid)) return;
    this.workingCategoryValue = null;
    this.loadCategoriesForRace(rid);
  }

  protected raceEditValid(): boolean {
    return (
      this.workingValue != null && this.workingValue !== '' && this.workingCategoryValue != null
    );
  }

  protected cancelEdit(): void {
    this.editingField.set(null);
    this.workingValue = null;
    this.workingCategoryValue = null;
  }

  protected commitField(field: FieldKey): void {
    const id = this.eventId();
    const bib = this.bibNumber();
    if (!id || !bib) return;

    // Race save requires a category pick too — silently block if missing.
    if (field === 'raceId' && !this.raceEditValid()) return;

    const request = this.buildUpdateRequest(field);
    if (request === null) {
      this.cancelEdit();
      return;
    }

    this.savingField.set(field);
    this.participantService.updateParticipant(id, bib, request).subscribe({
      next: (updated) => {
        this.participant.set(updated);
        this.savingField.set(null);
        this.bus.publish({ action: 'updated', participant: updated });
        this.participantUpdated.emit(updated);
        this.toast.success('Saved');
        this.editingField.set(null);
        this.workingValue = null;
        this.workingCategoryValue = null;
      },
      error: (err) => {
        this.savingField.set(null);
        this.errorHandler.showError(err, 'Failed to save change');
      },
    });
  }

  private normalizeForEdit(
    field: FieldKey,
    value: string | number | null | undefined,
  ): string | number | Date | null {
    switch (field) {
      case 'dateOfBirth':
        return this.parseDob(value == null ? undefined : String(value));
      case 'age':
        return value == null || value === '' ? null : Number(value);
      case 'raceId':
      case 'categoryId':
        return value == null || value === '' ? null : Number(value);
      default:
        return value == null ? '' : String(value);
    }
  }

  private buildUpdateRequest(field: FieldKey): UpdateParticipantRequest | null {
    const v = this.workingValue;
    const r: UpdateParticipantRequest = {};
    switch (field) {
      case 'fullName':
        r.fullName = stringOrUndef(v);
        if (!r.fullName) return null;
        break;
      case 'gender':
        r.gender = stringOrUndef(v);
        if (!r.gender) return null;
        break;
      case 'dateOfBirth':
        r.dateOfBirth = this.formatDob(v as Date | null);
        break;
      case 'age':
        r.age = v == null || v === '' ? undefined : Number(v);
        break;
      case 'email':
        r.email = stringOrUndef(v);
        break;
      case 'phoneNumber':
        r.phoneNumber = stringOrUndef(v);
        break;
      case 'city':
        r.city = stringOrUndef(v);
        break;
      case 'country':
        r.country = stringOrUndef(v);
        break;
      case 'raceId':
        if (v == null || v === '') return null;
        // Race save is atomic with category — both fields go in the same PATCH.
        if (this.workingCategoryValue == null) return null;
        r.raceId = String(v);
        r.categoryId = String(this.workingCategoryValue);
        break;
      case 'categoryId':
        if (v == null || v === '') return null;
        r.categoryId = String(v);
        break;
      case 'chipNumber':
        r.chipNumber = stringOrUndef(v);
        if (!r.chipNumber) return null;
        break;
      case 'emergencyContactName':
        r.emergencyContactName = stringOrUndef(v);
        break;
      case 'emergencyContactPhone':
        r.emergencyContactPhone = stringOrUndef(v);
        break;
      case 'notes':
        r.notes = stringOrUndef(v);
        break;
      default:
        return null;
    }
    return r;
  }

  // ---------- DOB helpers (wire format dd-MM-yyyy) ----------
  private formatDob(date: Date | null): string | undefined {
    if (!date) return undefined;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return undefined;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  protected close(): void {
    this.closed.emit();
  }

  // Type-narrowing helpers used by the template (avoids `any` in templates).
  protected asString(v: unknown): string {
    return v == null ? '' : String(v);
  }
}

function stringOrUndef(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}
