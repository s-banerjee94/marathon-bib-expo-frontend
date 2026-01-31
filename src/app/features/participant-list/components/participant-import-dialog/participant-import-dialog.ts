import { Component, input, output, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';

export interface ImportResponse {
  success: boolean;
  message: string;
  totalRows?: number;
  successCount?: number;
  failureCount?: number;
}

@Component({
  selector: 'app-participant-import-dialog',
  standalone: true,
  templateUrl: './participant-import-dialog.html',
  imports: [CommonModule, DialogModule, ButtonModule, FileUploadModule, MessageModule],
})
export class ParticipantImportDialog {
  visible = model<boolean>(false);
  isUploading = input<boolean>(false);
  importResponse = input<ImportResponse | null>(null);

  importRequested = output<File>();
  resetClicked = output<void>();
  closed = output<void>();

  selectedFile = signal<File | null>(null);

  onFileSelect(event: { files: File[] }): void {
    if (event.files && event.files.length > 0) {
      this.selectedFile.set(event.files[0]);
    }
  }

  import(): void {
    const file = this.selectedFile();
    if (file) {
      this.importRequested.emit(file);
    }
  }

  clearFile(): void {
    this.selectedFile.set(null);
  }

  reset(): void {
    this.selectedFile.set(null);
    this.resetClicked.emit();
  }

  close(): void {
    if (!this.isUploading()) {
      this.selectedFile.set(null);
      this.visible.set(false);
      this.closed.emit();
    }
  }
}
