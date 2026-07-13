import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ExpoCard } from '../expo-card/expo-card';
import { ParticipantVerificationResponse } from '../../../core/models/participant-verification.model';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { renderExpoCardPng } from '../expo-card-canvas.util';

// "Download Expo Card" dialog: live preview + optional selfie/upload photo +
// deterministic canvas render to PNG + Web Share fallback. The photo stays
// client-side and is never sent to the backend.
@Component({
  selector: 'app-download-card-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, ExpoCard],
  templateUrl: './download-card-dialog.html',
})
export class DownloadCardDialog {
  visible = model<boolean>(false);
  data = input.required<ParticipantVerificationResponse>();
  dateLine = input<string>(''); // pre-formatted event date range (date only)
  qrSrc = input<string | null>(null);

  private errorHandler = inject(ErrorHandlerService);

  photoSrc = signal<string | null>(null);
  isBusy = signal(false);
  canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  onPhotoSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = ''; // allow re-picking the same file
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => this.photoSrc.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoSrc.set(null);
  }

  close(): void {
    if (!this.isBusy()) this.visible.set(false);
  }

  async download(): Promise<void> {
    if (this.isBusy()) return;
    this.isBusy.set(true);
    try {
      const dataUrl = await this.renderPng();
      if (dataUrl) this.triggerDownload(dataUrl);
    } catch (err) {
      this.errorHandler.showError(err, 'Could not generate the card image');
    } finally {
      this.isBusy.set(false);
    }
  }

  async share(): Promise<void> {
    if (this.isBusy()) return;
    this.isBusy.set(true);
    try {
      const dataUrl = await this.renderPng();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], this.fileName(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: this.data().eventName,
          text: `${this.data().eventName} — Bib ${this.data().bibNumber}`,
        });
      } else {
        this.triggerDownload(dataUrl);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        this.errorHandler.showError(err, 'Could not share the card');
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  // Deterministic canvas render — the card is painted onto a fixed 540x340 canvas, so
  // the PNG is identical on every device/viewport/theme with no capture-frame or
  // scale/aspect conflicts (the source of the old transparent border).
  private renderPng(): Promise<string> {
    const d = this.data();
    return renderExpoCardPng({
      eventName: d.eventName,
      dateLine: this.dateLine(),
      bibNumber: d.bibNumber,
      fullName: d.fullName,
      chipNumber: d.chipNumber,
      gender: d.gender,
      raceName: d.raceName,
      categoryName: d.categoryName,
      qrSrc: this.qrSrc(),
      photoSrc: this.photoSrc(),
    });
  }

  private triggerDownload(dataUrl: string): void {
    const link = document.createElement('a');
    link.download = this.fileName();
    link.href = dataUrl;
    link.click();
  }

  private fileName(): string {
    return `expo-card-${this.data().bibNumber || 'card'}.png`;
  }
}
