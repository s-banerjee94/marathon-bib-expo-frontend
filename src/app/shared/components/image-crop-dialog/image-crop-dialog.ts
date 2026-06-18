import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { TooltipModule } from 'primeng/tooltip';
import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';

/**
 * Reusable crop dialog. Takes a picked `File`, lets the user drag/zoom/rotate to
 * select a (square by default) area, then emits the cropped result as a JPEG `File`
 * on save. The parent still runs its normal upload flow with the emitted file.
 */
@Component({
  selector: 'app-image-crop-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    SliderModule,
    TooltipModule,
    ImageCropperComponent,
  ],
  templateUrl: './image-crop-dialog.html',
  styleUrl: './image-crop-dialog.css',
})
export class ImageCropDialog {
  /** Source image to crop. The cropper (re)loads whenever this changes. */
  @Input() file: File | null = null;
  /** Two-way visibility. */
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Crop aspect ratio (width / height). 1 = square. */
  @Input() aspectRatio = 1;
  /** Show a circular crop overlay (display only — output is still rectangular). */
  @Input() round = true;
  /** Longest output edge in px. */
  @Input() resizeToWidth = 512;
  /** Dialog header. */
  @Input() title = 'Crop image';

  /** Emits the cropped JPEG file when the user saves. */
  @Output() cropped = new EventEmitter<File>();

  protected readonly transform = signal<ImageTransform>({ scale: 1, rotate: 0 });
  protected readonly zoom = signal(1);
  protected readonly minScale = 1;
  protected readonly maxScale = 3;
  private readonly scaleStep = 0.1;
  private latest: ImageCroppedEvent | null = null;

  protected onCropped(event: ImageCroppedEvent): void {
    this.latest = event;
  }

  protected onZoomChange(value: number): void {
    this.setScale(value);
  }

  /** Mouse-wheel zoom over the cropper (scroll up = zoom in). */
  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setScale(this.zoom() + (event.deltaY < 0 ? this.scaleStep : -this.scaleStep));
  }

  private setScale(value: number): void {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, Math.round(value * 10) / 10));
    this.zoom.set(clamped);
    this.transform.update((t) => ({ ...t, scale: clamped }));
  }

  protected rotate(): void {
    this.transform.update((t) => ({ ...t, rotate: ((t.rotate ?? 0) + 90) % 360 }));
  }

  protected save(): void {
    const blob = this.latest?.blob;
    if (!blob) return;
    const name = (this.file?.name ?? 'image').replace(/\.[^.]+$/, '') + '.jpg';
    this.cropped.emit(new File([blob], name, { type: 'image/jpeg' }));
    this.onVisibleChange(false);
  }

  protected onVisibleChange(value: boolean): void {
    if (!value) this.resetState();
    this.visibleChange.emit(value);
  }

  private resetState(): void {
    this.transform.set({ scale: 1, rotate: 0 });
    this.zoom.set(1);
    this.latest = null;
  }
}
