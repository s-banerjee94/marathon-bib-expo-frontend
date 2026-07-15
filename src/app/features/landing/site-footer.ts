import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  NgZone,
  signal,
} from '@angular/core';
import { ApiHealthService } from '../../core/services/api-health.service';

/** How often the footer takes the backend's pulse. */
const PULSE_INTERVAL_MS = 180_000;

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  private readonly apiHealth = inject(ApiHealthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  /** null until the first pulse answers — the chip stays green until proven red. */
  readonly apiLive = signal<boolean | null>(null);

  constructor() {
    afterNextRender(() => this.startPulse());
  }

  // Every 3 minutes, silently. Hidden tabs skip their tick — the next visible
  // one reconciles — so background tabs don't ping the backend for hours.
  private startPulse(): void {
    const check = (): void => {
      if (document.hidden) {
        return;
      }
      this.apiHealth.pulse().subscribe((live) => {
        this.zone.run(() => this.apiLive.set(live));
      });
    };
    this.zone.runOutsideAngular(() => {
      check();
      const timerId = setInterval(check, PULSE_INTERVAL_MS);
      this.destroyRef.onDestroy(() => clearInterval(timerId));
    });
  }
}
