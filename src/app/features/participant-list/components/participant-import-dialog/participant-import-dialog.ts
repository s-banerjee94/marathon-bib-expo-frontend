import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { BatchJobStatusResponse } from '../../../../core/models/participant.model';

@Component({
  selector: 'app-participant-import-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-import-dialog.html',
  imports: [DialogModule, ButtonModule, FileUploadModule, MessageModule],
})
export class ParticipantImportDialog {
  visible = model<boolean>(false);
  eventId = input<number | undefined>(undefined);
  isUploading = input<boolean>(false);
  jobStatus = input<BatchJobStatusResponse | null>(null);

  importRequested = output<File>();
  resetClicked = output<void>();
  closed = output<void>();

  selectedFile = signal<File | null>(null);

  isProcessing = computed(() => {
    const s = this.jobStatus()?.status;
    return s === 'STARTING' || s === 'STARTED';
  });

  isCompleted = computed(() => this.jobStatus()?.status === 'COMPLETED');

  isFailed = computed(() => {
    const s = this.jobStatus()?.status;
    return s === 'FAILED' || s === 'STOPPED';
  });

  onFileSelect(event: { files: File[] }): void {
    if (event.files?.length > 0) {
      this.selectedFile.set(event.files[0]);
    }
  }

  import(): void {
    const file = this.selectedFile();
    if (file) {
      this.importRequested.emit(file);
    }
  }

  reset(): void {
    this.selectedFile.set(null);
    this.resetClicked.emit();
  }

  close(): void {
    if (!this.isUploading()) {
      this.visible.set(false);
    }
  }

  onDialogHide(): void {
    if (!this.isUploading()) {
      this.selectedFile.set(null);
      this.closed.emit();
    }
  }
}
