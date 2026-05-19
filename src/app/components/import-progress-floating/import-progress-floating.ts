import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
  imports: [FloatingProgress],
})
export class ImportProgressFloating {
  protected readonly importProgress = inject(ImportProgressService);

  severityFor(job: ImportJobEntry): FloatingProgressSeverity {
    const s = job.status()?.status;
    if (s === 'COMPLETED') return 'success';
    if (s === 'FAILED' || s === 'STOPPED' || s === 'ABANDONED') return 'danger';
    if (s === 'STARTING' || s === 'STARTED') return 'info';
    return 'secondary';
  }

  statusLabelFor(job: ImportJobEntry): string {
    const s = job.status()?.status;
    if (s === 'STARTING' || s === 'STARTED') return 'Importing';
    if (s === 'COMPLETED') return 'Completed';
    if (s === 'FAILED' || s === 'STOPPED' || s === 'ABANDONED') return s;
    return s ?? 'Pending';
  }

  onDismiss(id: FloatingProgressId): void {
    this.importProgress.dismiss(Number(id));
  }
}
