import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/**
 * Reusable image picker with preview, used for avatars and logos.
 *
 * Purely presentational: it shows the current image (or a placeholder), lets the
 * user pick a new file, and emits the raw `File` — the parent normalizes and
 * uploads it (see ImageUploadService) and toggles `pending` while in flight.
 *
 * ```html
 * <app-image-upload
 *   shape="circle"
 *   [imageUrl]="avatarUrl()"
 *   [pending]="avatarPending()"
 *   (fileSelected)="onAvatarSelected($event)"
 *   (removeRequested)="onAvatarRemove()"
 * />
 * ```
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ProgressSpinnerModule],
  templateUrl: './image-upload.html',
})
export class ImageUpload {
  /** Current image URL (presigned). Null/empty/broken shows the placeholder. */
  @Input()
  set imageUrl(value: string | null | undefined) {
    this._imageUrl = value?.trim() ? value : undefined;
    this.broken.set(false);
  }
  get imageUrl(): string | undefined {
    return this._imageUrl;
  }
  private _imageUrl?: string;
  /** Set when the current image URL fails to load, so we show the placeholder. */
  readonly broken = signal(false);
  /** 'circle' for avatars (object-cover), 'square' for logos (object-contain). */
  @Input() shape: 'circle' | 'square' = 'circle';
  /** Alt text / aria label for the preview image. */
  @Input() alt = 'Image';
  /** Optional helper line shown under the buttons. */
  @Input() helpText?: string;
  /** Disables all interaction. */
  @Input() disabled = false;
  /** Shows a spinner overlay and blocks interaction while an upload/remove runs. */
  @Input() pending = false;
  /** File picker accept filter. */
  @Input() accept = 'image/*';

  @Output() fileSelected = new EventEmitter<File>();
  @Output() removeRequested = new EventEmitter<void>();

  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  get isBusy(): boolean {
    return this.disabled || this.pending;
  }

  openPicker(): void {
    if (this.isBusy) return;
    this.fileInput.nativeElement.click();
  }

  onImageError(): void {
    this.broken.set(true);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    // Reset so picking the same file again still fires (change).
    input.value = '';
  }

  remove(): void {
    if (this.isBusy) return;
    this.removeRequested.emit();
  }
}
