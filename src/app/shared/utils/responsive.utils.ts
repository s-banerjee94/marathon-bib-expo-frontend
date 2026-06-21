import { DestroyRef, inject, signal, Signal } from '@angular/core';
import { BreakpointService } from '../../core/services/breakpoint.service';

/**
 * Reactive signal that tracks whether the viewport is at or below the given
 * mobile breakpoint.
 *
 * For the default 768px breakpoint (Tailwind's `md`) this delegates to the shared
 * {@link BreakpointService} so the whole app reads one signal backed by a single
 * `matchMedia` listener. A custom width still gets its own listener, torn down
 * when the injection context is destroyed.
 *
 * Must be called in an injection context (constructor or field initializer).
 *
 * @param maxWidthPx breakpoint in px; defaults to 768 (md in Tailwind)
 */
export function injectIsMobile(maxWidthPx = 768): Signal<boolean> {
  if (maxWidthPx === 768) {
    return inject(BreakpointService).isMobile;
  }

  const destroyRef = inject(DestroyRef);
  const isMobile = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return isMobile.asReadonly();
  }

  const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
  isMobile.set(mq.matches);
  const handler = (e: MediaQueryListEvent) => isMobile.set(e.matches);
  mq.addEventListener('change', handler);
  destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

  return isMobile.asReadonly();
}
