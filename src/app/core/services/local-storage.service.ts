import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Centralized localStorage access for the whole app.
 *
 * Rules:
 * - All localStorage reads/writes MUST go through this service. Never call
 *   `localStorage.*` directly elsewhere — that bypasses the logout wipe and
 *   the SSR safety check.
 * - `clear()` is called from `AuthService.logout()`. On logout, everything
 *   the app has stored is wiped.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private platformId = inject(PLATFORM_ID);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /** Read a string value. Returns null if absent or not in a browser. */
  getString(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /** Write a string value. Silently no-ops outside a browser. */
  setString(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage quota exceeded or disabled — silent fail, don't crash app
    }
  }

  /** Read and JSON-parse a value. Returns null if absent or unparseable. */
  getJSON<T>(key: string): T | null {
    const raw = this.getString(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** JSON-stringify and write a value. */
  setJSON<T>(key: string, value: T): void {
    try {
      this.setString(key, JSON.stringify(value));
    } catch {
      // unstringifiable value — silent fail
    }
  }

  /** Remove a single key. */
  remove(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  /**
   * Wipe everything this app has stored. Called by AuthService.logout().
   * Uses localStorage.clear() so any future keys are also covered without
   * us having to maintain a list.
   */
  clear(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  }
}
