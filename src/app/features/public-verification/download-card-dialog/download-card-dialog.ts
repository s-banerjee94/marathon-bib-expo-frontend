import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ExpoCard } from '../expo-card/expo-card';
import { ParticipantVerificationResponse } from '../../../core/models/participant-verification.model';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';

// "Download Expo Card" dialog: live preview + optional selfie/upload photo +
// rasterize-to-PNG (html-to-image, lazy-loaded) + Web Share fallback. The photo
// stays client-side and is never sent to the backend.
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

  private cardRef = viewChild('card', { read: ElementRef });
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

  // Rasterize the fixed 540x340 card host. The preview may be CSS-scaled on small
  // screens, so transform is reset and explicit dimensions are forced for crisp output.
  private async renderPng(): Promise<string | null> {
    const host = this.cardRef()?.nativeElement;
    if (!host) return null;
    const { toPng } = await import('html-to-image');
    return toPng(host, {
      width: 540,
      height: 340,
      pixelRatio: 3,
      cacheBust: true,
      // The app ships no web font; skip embedding to avoid reading cross-origin
      // stylesheets (e.g. the flag-icons CDN) and speed up rasterization.
      skipFonts: true,
      style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
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
