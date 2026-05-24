import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { BatchJobStatusResponse } from '../models/participant.model';
import { ParticipantService } from './participant.service';
import { ErrorHandlerService } from './error-handler.service';
import { ToastService } from './toast.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';

interface CompletionEvent {
  eventId: number;
  jobExecutionId: number;
  status: 'COMPLETED' | 'FAILED' | 'STOPPED' | 'ABANDONED';
}

export interface ImportJobEntry {
  readonly eventId: number;
  readonly jobExecutionId: number;
  readonly startedAt: number;
  readonly status: Signal<BatchJobStatusResponse | null>;
  readonly isStopping: Signal<boolean>;
}

interface InternalJobEntry extends ImportJobEntry {
  readonly status: WritableSignal<BatchJobStatusResponse | null>;
  readonly isStopping: WritableSignal<boolean>;
}

interface PersistedImport {
  eventId: number;
  jobExecutionId: number;
  startedAt: number;
}

const POLL_INTERVAL_MS = 2000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ImportProgressService {
  private readonly participantService = inject(ParticipantService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly storage = inject(LocalStorageService);

  private readonly jobsSignal = signal<InternalJobEntry[]>([]);
  readonly jobs = computed<ImportJobEntry[]>(() => this.jobsSignal());
  readonly completed$ = new Subject<CompletionEvent>();

  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    this.restoreFromStorage();
  }

  start(eventId: number, jobExecutionId: number): void {
    const stale = this.jobsSignal().filter(
      (j) => j.eventId === eventId && j.jobExecutionId !== jobExecutionId,
    );
    for (const old of stale) {
      this.dismiss(old.jobExecutionId);
    }
    this.addJob(eventId, jobExecutionId, Date.now());
  }

  dismiss(jobExecutionId: number): void {
    this.stopPolling(jobExecutionId);
    this.jobsSignal.update((arr) => arr.filter((j) => j.jobExecutionId !== jobExecutionId));
    this.persistActive();
  }

  stop(jobExecutionId: number): void {
    const entry = this.jobsSignal().find((j) => j.jobExecutionId === jobExecutionId);
    if (!entry || entry.isStopping()) return;

    entry.isStopping.set(true);
    this.participantService.stopBatchImport(entry.eventId, jobExecutionId).subscribe({
      next: (status) => {
        entry.status.set(status);
        this.toast.success(`Stop signal sent for import #${jobExecutionId}`, 'Stopping import');
      },
      error: (error: unknown) => {
        entry.isStopping.set(false);
        this.errorHandler.showError(error, 'Failed to stop import');
      },
    });
  }

  private addJob(eventId: number, jobExecutionId: number, startedAt: number): void {
    if (this.jobsSignal().some((j) => j.jobExecutionId === jobExecutionId)) return;

    const entry: InternalJobEntry = {
      eventId,
      jobExecutionId,
      startedAt,
      status: signal<BatchJobStatusResponse | null>(null),
      isStopping: signal<boolean>(false),
    };

    this.jobsSignal.update((arr) => [entry, ...arr]);
    this.persistActive();
    this.poll(jobExecutionId);
  }

  private poll(jobExecutionId: number): void {
    const entry = this.jobsSignal().find((j) => j.jobExecutionId === jobExecutionId);
    if (!entry) return;

    this.participantService.getBatchImportStatus(entry.eventId, jobExecutionId).subscribe({
      next: (status) => {
        const current = this.jobsSignal().find((j) => j.jobExecutionId === jobExecutionId);
        if (!current) return;

        current.status.set(status);

        const terminal =
          status.status === 'COMPLETED' ||
          status.status === 'FAILED' ||
          status.status === 'STOPPED' ||
          status.status === 'ABANDONED';

        if (terminal) {
          this.stopPolling(jobExecutionId);
          current.isStopping.set(false);
          this.persistActive();
          if (status.status === 'COMPLETED') {
            this.toast.success(
              `Import #${jobExecutionId} completed successfully`,
              'Import Complete',
            );
          }
          this.completed$.next({
            eventId: current.eventId,
            jobExecutionId,
            status: status.status as CompletionEvent['status'],
          });
        } else {
          const timer = setTimeout(() => this.poll(jobExecutionId), POLL_INTERVAL_MS);
          this.timers.set(jobExecutionId, timer);
        }
      },
      error: (error: unknown) => {
        this.stopPolling(jobExecutionId);
        const httpStatus = (error as { status?: number })?.status;
        if (httpStatus === 404) {
          this.dismiss(jobExecutionId);
        } else {
          this.errorHandler.showError(error, 'Failed to get import status');
        }
      },
    });
  }

  private stopPolling(jobExecutionId: number): void {
    const timer = this.timers.get(jobExecutionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(jobExecutionId);
    }
  }

  private persistActive(): void {
    const entries: PersistedImport[] = this.jobsSignal()
      .filter((j) => !this.isTerminal(j.status()))
      .map((j) => ({
        eventId: j.eventId,
        jobExecutionId: j.jobExecutionId,
        startedAt: j.startedAt,
      }));

    if (entries.length === 0) {
      this.storage.remove(STORAGE_KEYS.ACTIVE_IMPORTS);
    } else {
      this.storage.setJSON(STORAGE_KEYS.ACTIVE_IMPORTS, entries);
    }
  }

  private isTerminal(status: BatchJobStatusResponse | null): boolean {
    if (!status) return false;
    return (
      status.status === 'COMPLETED' ||
      status.status === 'FAILED' ||
      status.status === 'STOPPED' ||
      status.status === 'ABANDONED'
    );
  }

  private restoreFromStorage(): void {
    const entries = this.storage.getJSON<unknown>(STORAGE_KEYS.ACTIVE_IMPORTS);
    if (!Array.isArray(entries)) return;

    const now = Date.now();
    const fresh: PersistedImport[] = entries.filter((e): e is PersistedImport => {
      if (!e || typeof e !== 'object') return false;
      const entry = e as Record<string, unknown>;
      return (
        typeof entry['eventId'] === 'number' &&
        typeof entry['jobExecutionId'] === 'number' &&
        typeof entry['startedAt'] === 'number' &&
        now - (entry['startedAt'] as number) < MAX_AGE_MS
      );
    });

    fresh.forEach((e) => this.addJob(e.eventId, e.jobExecutionId, e.startedAt));
  }
}
