import { Injectable, signal } from '@angular/core';

/**
 * Single source of truth for the app-wide mobile viewport flag. One `matchMedia`
 * listener is created for the whole application (this is a root singleton) and its
 * result is exposed as a shared, read-only `isMobile` signal — replacing the many
 * per-component listeners that previously duplicated this logic.
 *
 * The default breakpoint is 768px (Tailwind's `md`). Consumers should read
 * `isMobile` directly, or via the {@link injectIsMobile} helper which delegates here.
 */
@Injectable({
  providedIn: 'root',
})
export class BreakpointService {
  private static readonly MOBILE_MAX_WIDTH_PX = 768;

  private readonly mobile = signal(false);
  /** True when the viewport width is at or below the mobile breakpoint (768px). */
  readonly isMobile = this.mobile.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mq = window.matchMedia(`(max-width: ${BreakpointService.MOBILE_MAX_WIDTH_PX}px)`);
    this.mobile.set(mq.matches);
    // App-lifetime singleton: the single listener intentionally lives for the whole
    // session, so there is nothing to tear down.
    mq.addEventListener('change', (e) => this.mobile.set(e.matches));
  }
}
