import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { Race, CreateRaceRequest, UpdateRaceRequest } from '../../../core/models/race.model';
import { RaceService } from '../../../core/services/race.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { RaceForm } from '../race-form/race-form';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { TableRowSelectEvent } from 'primeng/table';
import { TableColumn } from '../../../shared/models/table-config.model';
import { RACE_COLUMNS } from '../../../shared/constants/race-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

const DEFAULT_RACE_FIELDS = ['id', 'raceName', 'raceDescription', 'categoryCount'];

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
    DefaultValuePipe,
  ],
  providers: [DialogService, ConfirmationService, MessageService],
  templateUrl: './race-section.html',
  styleUrl: './race-section.css',
})
export class RaceSection implements OnInit {
  eventId = input.required<number>();
  selectedRace = output<Race>();

  private raceService = inject(RaceService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  races = signal<Race[]>([]);
  isLoading = signal(true);
  internalSelectedRace = signal<Race | null>(null);

  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  private dialogRef: DynamicDialogRef | null = null;

  ngOnInit(): void {
    initializeColumnPreferences(
      RACE_COLUMNS,
      DEFAULT_RACE_FIELDS,
      STORAGE_KEYS.RACE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadRaces();
  }

  onColumnSelectionChange(): void {
    saveColumnPreferences(this.selectedCols, STORAGE_KEYS.RACE_TABLE_COLUMNS);
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
    this.dialogRef = this.dialogService.open(RaceForm, {
      header: 'Create Race',
      width: '600px',
      data: { race: null },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as CreateRaceRequest;
        this.raceService.createRace(this.eventId(), request).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Race created successfully',
            });
            this.loadRaces();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to create race');
            this.isLoading.set(false);
          },
        });
      }
    });
  }

  onEdit(race: Race): void {
    this.dialogRef = this.dialogService.open(RaceForm, {
      header: 'Edit Race',
      width: '600px',
      data: { race },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as UpdateRaceRequest;
        this.raceService.updateRace(this.eventId(), race.id, request).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Race updated successfully',
            });
            this.loadRaces();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to update race');
            this.isLoading.set(false);
          },
        });
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
        this.isLoading.set(true);
        this.raceService.deleteRace(this.eventId(), race.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Race deleted successfully',
            });
            this.loadRaces();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to delete race');
            this.isLoading.set(false);
          },
        });
      },
    });
  }

  onRowSelect(event: TableRowSelectEvent<Race>): void {
    const race = event.data;
    if (race && !Array.isArray(race)) {
      this.internalSelectedRace.set(race);
      this.selectedRace.emit(race);
    }
  }
}
