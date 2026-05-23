import { DestroyRef, inject, signal, WritableSignal } from '@angular/core';

/**
 * Reactive signal that tracks whether the viewport is at or below the given
 * mobile breakpoint. Updates automatically when the viewport crosses the
 * breakpoint and tears down the matchMedia listener when the injection
 * context is destroyed.
 *
 * Must be called in an injection context (constructor or field initializer).
 *
 * @param maxWidthPx breakpoint in px; defaults to 768 (md in Tailwind)
 */
export function injectIsMobile(maxWidthPx = 768): WritableSignal<boolean> {
  const destroyRef = inject(DestroyRef);
  const isMobile = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return isMobile;
  }

  const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
  isMobile.set(mq.matches);
  const handler = (e: MediaQueryListEvent) => isMobile.set(e.matches);
  mq.addEventListener('change', handler);
  destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

  return isMobile;
}
