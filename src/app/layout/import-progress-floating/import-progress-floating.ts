import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import {
  FloatingProgress,
  FloatingProgressId,
  FloatingProgressSeverity,
} from '../floating-progress/floating-progress';
import { ImportJobEntry, ImportProgressService } from '../../core/services/import-progress.service';

@Component({
  selector: 'app-import-progress-floating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-progress-floating.html',
  imports: [FloatingProgress, ButtonModule, ConfirmPopupModule],
  providers: [ConfirmationService],
})
export class ImportProgressFloating {
  protected readonly importProgress = inject(ImportProgressService);
  private readonly confirmation = inject(ConfirmationService);

  severityFor(job: ImportJobEntry): FloatingProgressSeverity {
    const s = job.status()?.status;
    if (s === 'COMPLETED') return 'success';
    if (s === 'FAILED' || s === 'STOPPED' || s === 'ABANDONED') return 'danger';
    if (s === 'STARTING' || s === 'STARTED') return 'info';
    return 'secondary';
  }

  statusLabelFor(job: ImportJobEntry): string {
    if (job.isStopping()) return 'Stopping';
    const s = job.status()?.status;
    if (s === 'STARTING' || s === 'STARTED') return 'Importing';
    if (s === 'COMPLETED') return 'Completed';
    if (s === 'FAILED' || s === 'STOPPED' || s === 'ABANDONED') return s;
    return s ?? 'Pending';
  }

  isActive(job: ImportJobEntry): boolean {
    const s = job.status()?.status;
    return s === undefined || s === 'STARTING' || s === 'STARTED' || s === 'UNKNOWN';
  }

  confirmStop(event: Event, job: ImportJobEntry): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: 'Stop this import? Already-imported rows will be kept.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Stop',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => this.importProgress.stop(job.jobExecutionId),
    });
  }

  onDismiss(id: FloatingProgressId): void {
    this.importProgress.dismiss(Number(id));
  }
}
