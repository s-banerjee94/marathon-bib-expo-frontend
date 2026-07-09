import { Injectable, signal } from '@angular/core';

/**
 * Single source of truth for browser online/offline state. Backed by one pair of
 * window listeners so the rest of the app reads a signal instead of wiring its own.
 */
@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private readonly onlineSignal = signal(navigator.onLine);
  readonly isOnline = this.onlineSignal.asReadonly();

  constructor() {
    window.addEventListener('online', () => this.onlineSignal.set(true));
    window.addEventListener('offline', () => this.onlineSignal.set(false));
  }
}
