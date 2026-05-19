import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';

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

  importRequested = output<File>();
  closed = output<void>();

  selectedFile = signal<File | null>(null);

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
