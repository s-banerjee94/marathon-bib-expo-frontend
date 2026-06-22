import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ConfirmationService } from 'primeng/api';
import { concat, filter, first, interval } from 'rxjs';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours (per Angular guidance)

/**
 * Keeps a cache-first PWA from getting stuck on a stale build. Follows the Angular
 * service-worker guidance: prompt (never auto-`activateUpdate()`, which can break
 * lazy-chunk loading) to reload when a new version is ready, surface unrecoverable
 * SW states, and poll for updates after the app stabilizes. No-op when the service
 * worker is disabled (dev / unsupported browsers).
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly appRef = inject(ApplicationRef);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() =>
        this.promptReload(
          'Update available',
          'A new version of the app is ready. Reload now to update?',
        ),
      );

    this.swUpdate.unrecoverable.subscribe(() =>
      this.promptReload(
        'Reload required',
        'The app reached a state it cannot recover from. Reload to continue.',
      ),
    );

    // ngsw already checks on startup and each navigation; also poll on a schedule
    // for long-lived sessions. Wait for stability first, otherwise constant polling
    // delays the service worker registration (Angular "Stabilization" guidance).
    const appStable$ = this.appRef.isStable.pipe(first((stable) => stable));
    concat(appStable$, interval(UPDATE_CHECK_INTERVAL_MS)).subscribe(async () => {
      try {
        await this.swUpdate.checkForUpdate();
      } catch {
        // A failed check is non-fatal; the next scheduled check retries.
      }
    });
  }

  private promptReload(header: string, message: string): void {
    this.confirmationService.confirm({
      header,
      message,
      icon: 'pi pi-sync',
      acceptLabel: 'Reload',
      rejectLabel: 'Later',
      accept: () => document.location.reload(),
    });
  }
}
