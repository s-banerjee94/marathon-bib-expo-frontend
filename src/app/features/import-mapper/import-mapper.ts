import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { StepperModule } from 'primeng/stepper';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import Papa from 'papaparse';
import { ToastService } from '../../core/services/toast.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ParticipantService } from '../../core/services/participant.service';
import { EventService } from '../../core/services/event.service';
import { ImportProgressService } from '../../core/services/import-progress.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { Event } from '../../core/models/event.model';
import { ImportMode } from '../../core/models/participant.model';
import { copyToClipboard } from '../../shared/utils/clipboard.utils';
import { ColumnMapper } from './column-mapper/column-mapper';
import { MobileColumnMapper } from './mobile-column-mapper/mobile-column-mapper';
import {
  BUCKET_FIELDS,
  BUCKET_KEYS,
  FIELD_HINTS,
  Mapping,
  MappingConfig,
  REQUIRED_TO_MAP,
  TargetField,
} from '../../core/models/import-mapper.model';

/**
 * Route (`/participants/import-map`) that maps an uploaded CSV onto participant
 * fields by dragging, then launches the async batch import.
 *
 * The event and run mode are supplied by the caller via the `?eventId=` and
 * `?mode=` query params (the participant list's Import / Add On buttons) —
 * there is no event picker here. Flow: upload a CSV → connect columns to fields →
 * confirm & import. Submitting POSTs the file plus the {@link MappingConfig} JSON
 * (the `ImportMappingRequest` contract) to the batch-import endpoint. In `IMPORT`
 * mode the backend wipes existing participants and runs a full Spring Batch load;
 * in `ADD_ON` mode it appends the rows without wiping. Progress is tracked by the
 * global {@link ImportProgressService} floating widget.
 */
@Component({
  selector: 'app-import-mapper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
  imports: [
    NgTemplateOutlet,
    ButtonModule,
    ConfirmDialogModule,
    FileUploadModule,
    TableModule,
    MessageModule,
    TagModule,
    ProgressSpinnerModule,
    StepperModule,
    PanelModule,
    ColumnMapper,
    MobileColumnMapper,
  ],
  templateUrl: './import-mapper.html',
})
export class ImportMapper {
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private participantService = inject(ParticipantService);
  private eventService = inject(EventService);
  private importProgress = inject(ImportProgressService);
  private confirmation = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** ≤768px viewports get the tap-to-select mapper instead of drag-to-connect. */
  protected readonly isMobile = inject(BreakpointService).isMobile;

  /** Active wizard step (1 = Upload, 2 = Map, 3 = Review & Import). */
  protected readonly activeStep = signal(1);

  // --- event (supplied via ?eventId) + run mode (?mode) + target fields ---
  protected readonly selectedEventId = signal<number | null>(null);
  protected readonly selectedEvent = signal<Event | null>(null);
  /** Run mode from `?mode=` — IMPORT (full replace) or ADD_ON (append walk-ins). */
  protected readonly importMode = signal<ImportMode>('IMPORT');
  protected readonly isAddOn = computed(() => this.importMode() === 'ADD_ON');
  protected readonly targetFields = signal<TargetField[]>([]);
  protected readonly fieldsLoading = signal(false);

  // --- parsed CSV state ---
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileName = signal('');
  protected readonly delimiter = signal(',');
  protected readonly totalRows = signal(0);
  protected readonly csvColumns = signal<string[]>([]);
  /** Physical CSV position per (deduped) column name — the backend maps positionally. */
  protected readonly columnIndexByName = signal<Record<string, number>>({});
  protected readonly previewRows = signal<Record<string, string>[]>([]);
  protected readonly parseError = signal<string | null>(null);

  // --- mapping state (two-way bound to the mappers) ---
  protected readonly connections = signal<Mapping[]>([]);

  // --- import state ---
  protected readonly isImporting = signal(false);
  /** Set once the batch job is launched so the leave guard stops prompting. */
  private importLaunched = false;

  protected readonly hasFile = computed(() => this.csvColumns().length > 0);
  protected readonly selectedEventName = computed(() => this.selectedEvent()?.eventName ?? '');

  /** Step 1 → 2 requires the event's fields loaded and a parsed file. */
  protected readonly canStartMapping = computed(
    () => this.hasFile() && this.targetFields().length > 0 && !this.fieldsLoading(),
  );

  private readonly mappedTargets = computed(
    () => new Set(this.connections().map((c) => c.targetField)),
  );

  /** Required single fields that still have no column mapped. */
  protected readonly missingRequired = computed<TargetField[]>(() =>
    this.targetFields().filter((f) => f.kind === 'required' && !this.mappedTargets().has(f.key)),
  );

  /** Per-required-field status rows for the "Required Fields Status" card. */
  protected readonly requiredStatus = computed(() => {
    const mapped = this.mappedTargets();
    return this.targetFields()
      .filter((f) => f.kind === 'required')
      .map((f) => ({ label: f.label, mapped: mapped.has(f.key) }));
  });

  /** Mapped-vs-total required fields, for the mobile summary panel header. */
  protected readonly requiredProgress = computed(() => {
    const rows = this.requiredStatus();
    return { mapped: rows.filter((r) => r.mapped).length, total: rows.length };
  });

  /** Counts for the "Mapping Summary" card. */
  protected readonly summary = computed(() => {
    const cfg = this.mappingConfig();
    return {
      totalColumns: cfg.csvColumns.length,
      mappedFields: cfg.mappings.length,
      extraColumns: cfg.goodies.length + cfg.other.length,
      unmappedRequired: this.missingRequired().length,
    };
  });

  protected readonly canProceed = computed(
    () =>
      this.hasFile() &&
      this.targetFields().length > 0 &&
      this.missingRequired().length === 0 &&
      this.mappingConfig().mappings.length > 0,
  );

  /** First couple of distinct sample values per column, shown under its name. */
  protected readonly sampleByColumn = computed<Record<string, string>>(() => {
    const rows = this.previewRows();
    const out: Record<string, string> = {};
    for (const col of this.csvColumns()) {
      const values: string[] = [];
      for (const row of rows) {
        const value = (row[col] ?? '').trim();
        if (value && !values.includes(value)) values.push(value);
        if (values.length === 2) break;
      }
      out[col] = values.join(' · ');
    }
    return out;
  });

  protected readonly mappingConfig = computed<MappingConfig>(() => {
    const conns = this.connections();
    const cols = this.csvColumns();
    const physicalIndex = this.columnIndexByName();
    const indexOf = (name: string) => physicalIndex[name] ?? cols.indexOf(name);
    return {
      fileName: this.fileName(),
      delimiter: this.delimiter(),
      hasHeader: true,
      totalRows: this.totalRows(),
      csvColumns: cols,
      mappings: conns
        .filter((c) => !BUCKET_KEYS.has(c.targetField))
        .map((c) => ({
          csvColumnIndex: indexOf(c.csvColumn),
          csvColumn: c.csvColumn,
          targetField: c.targetField,
        })),
      goodies: conns
        .filter((c) => c.targetField === 'goodies')
        .map((c) => ({ csvColumnIndex: indexOf(c.csvColumn), csvColumn: c.csvColumn })),
      other: conns
        .filter((c) => c.targetField === 'other')
        .map((c) => ({ csvColumnIndex: indexOf(c.csvColumn), csvColumn: c.csvColumn })),
    };
  });

  protected readonly mappingConfigJson = computed(() =>
    JSON.stringify(this.mappingConfig(), null, 2),
  );

  /** CSV columns with no connection — kept out of the import. */
  protected readonly ignoredColumns = computed(() => {
    const used = new Set(this.connections().map((c) => c.csvColumn));
    return this.csvColumns().filter((c) => !used.has(c));
  });

  /**
   * One row per mapping for the read-only confirm view: CSV column → field label,
   * ordered by the column's physical position in the file.
   */
  protected readonly confirmRows = computed(() => {
    const fields = this.targetFields();
    const physicalIndex = this.columnIndexByName();
    const labelOf = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
    return this.connections()
      .map((c) => ({
        csvColumn: c.csvColumn,
        fieldLabel: labelOf(c.targetField),
        index: physicalIndex[c.csvColumn] ?? 0,
      }))
      .sort((a, b) => a.index - b.index);
  });

  constructor() {
    // The event and mode are provided by the caller (participant list → ?eventId=…&mode=…).
    const params = this.route.snapshot.queryParamMap;
    const eventId = Number(params.get('eventId'));
    if (!Number.isFinite(eventId) || eventId <= 0) {
      this.toast.warn('Select an event to import participants.');
      this.router.navigate(['/participants']);
      return;
    }
    this.importMode.set(params.get('mode') === 'ADD_ON' ? 'ADD_ON' : 'IMPORT');
    this.selectedEventId.set(eventId);
    this.loadEvent(eventId);
    this.loadImportFields(eventId);
  }

  // --- data loading ---

  private loadEvent(eventId: number): void {
    this.eventService.getEventById(eventId).subscribe({
      next: (event) => this.selectedEvent.set(event),
      error: (error) => this.errorHandler.showError(error, 'Failed to load event'),
    });
  }

  private loadImportFields(eventId: number): void {
    this.fieldsLoading.set(true);
    this.participantService.getImportFields(eventId).subscribe({
      next: (fields) => {
        const scalar: TargetField[] = fields.map((f) => ({
          key: f.key,
          label: f.label,
          // Guide §2 requires more fields than the live catalog reports — union the two.
          kind: f.required || REQUIRED_TO_MAP.has(f.key) ? 'required' : 'optional',
          hint: FIELD_HINTS[f.key],
        }));
        this.targetFields.set([...scalar, ...BUCKET_FIELDS]);
        this.fieldsLoading.set(false);
      },
      error: (error) => {
        this.fieldsLoading.set(false);
        this.errorHandler.showError(error, 'Failed to load import fields');
      },
    });
  }

  // --- file actions ---

  protected onFileSelect(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (!file) return;
    this.parseError.set(null);

    // worker: true keeps large files from blocking the UI. Function options
    // (e.g. transformHeader) cannot cross the worker boundary, so the file is
    // parsed as raw rows and the header row is split off here instead.
    Papa.parse<string[]>(file, {
      worker: true,
      skipEmptyLines: true,
      complete: (result) => {
        const [headerRow, ...rows] = result.data;
        const columns: string[] = [];
        const indexByName: Record<string, number> = {};
        const seen = new Map<string, number>();
        (headerRow ?? []).forEach((header, i) => {
          const trimmed = header.trim();
          if (!trimmed) return;
          // Duplicate headers get a numeric suffix (display name only — the
          // backend maps by physical column position).
          const count = seen.get(trimmed) ?? 0;
          seen.set(trimmed, count + 1);
          const name = count === 0 ? trimmed : `${trimmed}_${count}`;
          columns.push(name);
          indexByName[name] = i;
        });
        if (columns.length === 0) {
          this.parseError.set('No columns found — make sure the CSV has a header row.');
          return;
        }
        const preview = rows.slice(0, 5).map((row) => {
          const record: Record<string, string> = {};
          for (const name of columns) record[name] = row[indexByName[name]] ?? '';
          return record;
        });
        this.selectedFile.set(file);
        this.fileName.set(file.name);
        this.delimiter.set(result.meta.delimiter || ',');
        this.csvColumns.set(columns);
        this.columnIndexByName.set(indexByName);
        this.previewRows.set(preview);
        this.totalRows.set(rows.length);
        this.connections.set([]);
      },
      error: (err) => this.parseError.set(err.message),
    });
  }

  protected formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  /** File removed/cleared in the upload widget — drop everything derived from it. */
  protected onFileCleared(): void {
    this.selectedFile.set(null);
    this.fileName.set('');
    this.csvColumns.set([]);
    this.columnIndexByName.set({});
    this.previewRows.set([]);
    this.totalRows.set(0);
    this.connections.set([]);
    this.parseError.set(null);
  }

  /**
   * Route-leave check (see `unsavedMappingGuard`): confirm before discarding
   * an uploaded file and its mapping; free to leave otherwise.
   */
  canLeave(): boolean | Promise<boolean> {
    if (this.importLaunched || !this.hasFile()) return true;
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Discard import?',
        message: 'Your uploaded file and column mapping will be lost.',
        icon: 'pi pi-exclamation-triangle',
        acceptButtonProps: { label: 'Discard', severity: 'danger' },
        rejectButtonProps: { label: 'Stay', severity: 'secondary', outlined: true },
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  protected resetMapping(): void {
    this.connections.set([]);
  }

  protected async copyJson(): Promise<void> {
    if (await copyToClipboard(this.mappingConfigJson())) {
      this.toast.success('Mapping JSON copied to clipboard.');
    } else {
      this.toast.error('Could not copy to clipboard.');
    }
  }

  protected downloadJson(): void {
    const blob = new Blob([this.mappingConfigJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.fileName().replace(/\.csv$/i, '') || 'mapping'}.mapping.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // --- import ---

  /**
   * Starts the import immediately (no confirmation — the review step is the
   * confirmation) and returns to the page the user came from. Progress is shown
   * by the global floating widget; the participant list refreshes on completion.
   */
  protected launchImport(): void {
    const eventId = this.selectedEventId();
    const file = this.selectedFile();
    if (eventId === null || !file || !this.canProceed() || this.isImporting()) return;

    this.isImporting.set(true);
    this.participantService
      .launchBatchImport(eventId, file, this.mappingConfigJson(), this.importMode())
      .subscribe({
        next: (response) => {
          this.importLaunched = true;
          this.importProgress.start(eventId, response.jobExecutionId);
          this.toast.success(
            `${this.isAddOn() ? 'Add-on import' : 'Import'} job #${response.jobExecutionId} started — track progress in the corner.`,
            this.isAddOn() ? 'Add-on import started' : 'Import started',
          );
          const orgId = this.selectedEvent()?.organizationId;
          this.router.navigate(['/participants/event', eventId, 'list'], {
            queryParams: {
              organizationId: orgId != null ? String(orgId) : undefined,
              eventId: String(eventId),
            },
          });
        },
        error: (error) => {
          this.isImporting.set(false);
          this.errorHandler.showError(error, 'Failed to start import');
        },
      });
  }
}
