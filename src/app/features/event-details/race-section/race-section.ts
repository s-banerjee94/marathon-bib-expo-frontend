import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { Race } from '../../../core/models/race.model';
import { RaceService } from '../../../core/services/race.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { EventDetailsState } from '../event-details-state.service';
import { RaceForm } from '../race-form/race-form';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { TableRowSelectEvent } from 'primeng/table';
import { TableColumn } from '../../../shared/models/table-config.model';
import {
  RACE_COLUMNS,
  DEFAULT_RACE_COLUMNS,
} from '../../../shared/constants/race-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { LocalStorageService } from '../../../core/services/local-storage.service';
import {
  enforceRequiredColumns,
  getVisibleCols,
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

@Component({
  selector: 'app-race-section',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    MultiSelectModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
    CardModule,
    DefaultValuePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './race-section.html',
  styleUrl: './race-section.css',
})
export class RaceSection implements OnInit, OnDestroy {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private raceService = inject(RaceService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private storage = inject(LocalStorageService);
  private state = inject(EventDetailsState);

  races = signal<Race[]>([]);
  isLoading = signal(true);
  internalSelectedRace = signal<Race | null>(null);
  isMobile = signal(false);

  private mobileMediaQuery?: MediaQueryList;
  private mobileQueryHandler?: (e: MediaQueryListEvent) => void;

  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  visibleCols = computed(() => getVisibleCols(RACE_COLUMNS, this.selectedCols()));
  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  ngOnInit(): void {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mobileMediaQuery = window.matchMedia('(max-width: 768px)');
      this.isMobile.set(this.mobileMediaQuery.matches);
      this.mobileQueryHandler = (e) => this.isMobile.set(e.matches);
      this.mobileMediaQuery.addEventListener('change', this.mobileQueryHandler);
    }
    initializeColumnPreferences(
      this.storage,
      RACE_COLUMNS,
      DEFAULT_RACE_COLUMNS,
      STORAGE_KEYS.RACE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadRaces();
  }

  ngOnDestroy(): void {
    if (this.mobileMediaQuery && this.mobileQueryHandler) {
      this.mobileMediaQuery.removeEventListener('change', this.mobileQueryHandler);
    }
  }

  onColumnSelectionChange(): void {
    enforceRequiredColumns(this.selectedCols, RACE_COLUMNS);
    saveColumnPreferences(this.storage, this.selectedCols, STORAGE_KEYS.RACE_TABLE_COLUMNS);
  }

  loadRaces(): void {
    this.isLoading.set(true);
    this.raceService.getRacesByEventId(this.eventId()).subscribe({
      next: (races: Race[]) => {
        this.races.set(races);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load races');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    const ref = this.dialogService.open(RaceForm, {
      header: 'Create Race',
      width: '600px',
      data: { race: null, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: Race | undefined) => {
      if (result) {
        this.races.update((list) => [result, ...list]);
        this.toast.success('Race created successfully');
      }
    });
  }

  onEdit(race: Race): void {
    const ref = this.dialogService.open(RaceForm, {
      header: 'Edit Race',
      width: '600px',
      data: { race, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: Race | undefined) => {
      if (result) {
        this.races.update((list) => list.map((r) => (r.id === result.id ? result : r)));
        this.toast.success('Race updated successfully');
      }
    });
  }

  onDelete(race: Race, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete "${race.raceName}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-sm',
      accept: () => {
        this.raceService.deleteRace(this.eventId(), race.id).subscribe({
          next: () => {
            this.races.update((list) => list.filter((r) => r.id !== race.id));
            this.toast.success('Race deleted successfully');
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to delete race');
          },
        });
      },
    });
  }

  onRowSelect(event: TableRowSelectEvent<Race>): void {
    const race = event.data;
    if (race && !Array.isArray(race)) {
      this.internalSelectedRace.set(race);
      this.state.setSelectedRace(race);
    }
  }
}
