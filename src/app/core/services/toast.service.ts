import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

type RawMessage = Parameters<MessageService['add']>[0];

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

export const ACTION_TOAST_KEY = 'action';

const DEFAULT_LIFE: Record<ToastSeverity, number> = {
  success: 3000,
  info: 3000,
  warn: 5000,
  error: 6000,
};

// Hold a dedupe key slightly past the toast's life so a late duplicate from the
// same burst is still swallowed.
const DEDUPE_BUFFER_MS = 400;

// sessionStorage namespace for the persisted, cross-document dedupe window. Keyed
// per-tab, so it survives a reload / bfcache restore but not a fresh tab, and is
// untouched by the logout localStorage wipe.
const PERSIST_DEDUPE_PREFIX = 'toast:persist:';

export interface ToastAction {
  label: string;
  run: () => void;
  /** primary = filled button, else text button. */
  emphasis?: 'primary' | 'secondary';
  /** Dismiss the toast after running (default true). */
  closeAfter?: boolean;
}

export interface ToastOptions {
  summary?: string;
  detail?: string;
  severity?: ToastSeverity;
  /** Auto-dismiss ms; ignored when sticky. */
  life?: number;
  sticky?: boolean;
  closable?: boolean;
  /** Dedupe identity; defaults to severity|summary|detail. */
  dedupeKey?: string;
  /**
   * Persist a cross-document dedupe window (ms) in sessionStorage. The in-memory
   * dedupe map resets whenever a new document is created (a reload or bfcache
   * restore in the same tab); this makes a one-shot notice — e.g. the session
   * eviction toast — show at most once per tab across those document boundaries.
   */
  persistDedupeMs?: number;
  /** Emit even while error-suppression is active. */
  force?: boolean;
  /** Presence routes the toast to the headless action outlet. */
  actions?: ToastAction[];
  /** Reserved hook: not yet rendered as blocking; overridable later without touching call sites. */
  blocking?: boolean;
}

type ResolvedToast = ToastOptions & { severity: ToastSeverity };

// Named defaults so a whole class of notification is configured — and overridable at
// runtime — in one place.
const INTENT_DEFAULTS: Record<string, ToastOptions> = {
  'session-ended': {
    severity: 'warn',
    summary: 'Signed out',
    detail: 'Your account was signed in on another device. Please log in again.',
    life: 8000,
    dedupeKey: 'session-ended',
    // Survive a reload / bfcache restore in the same tab, comfortably past the
    // toast's own life, so the eviction burst can't stack across documents.
    persistDedupeMs: 15000,
  },
};

/**
 * Single chokepoint for PrimeNG toasts — never call MessageService.add() directly.
 * Adds de-duplication, an error-suppression window (session teardown), sticky and
 * interactive "action" toasts, and named intents on top of MessageService.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messageService = inject(MessageService);

  // dedupeKey -> auto-clear timer, or null for sticky/action toasts (freed on close).
  private readonly active = new Map<string, ReturnType<typeof setTimeout> | null>();
  private readonly intents = new Map<string, ToastOptions>(Object.entries(INTENT_DEFAULTS));

  // Error/warn toasts are swallowed until this timestamp; always lapses, so it can
  // never get stuck silent.
  private suppressErrorsUntil = 0;

  success(detail: string, summary: string = 'Success', options?: ToastOptions): void {
    this.dispatch({ severity: 'success', summary, detail, ...options });
  }

  error(detail: string, summary: string = 'Error', options?: ToastOptions): void {
    this.dispatch({ severity: 'error', summary, detail, ...options });
  }

  info(detail: string, summary: string = 'Info', options?: ToastOptions): void {
    this.dispatch({ severity: 'info', summary, detail, ...options });
  }

  warn(detail: string, summary: string = 'Warning', options?: ToastOptions): void {
    this.dispatch({ severity: 'warn', summary, detail, ...options });
  }

  /** Show a named intent (INTENT_DEFAULTS), optionally overriding fields; unknown intents fall back to info. */
  emit(intent: string, override?: ToastOptions): void {
    const base = this.intents.get(intent) ?? {};
    const merged = { ...base, ...override };
    this.dispatch({ ...merged, severity: merged.severity ?? 'info' });
  }

  /** Interactive toast carrying action buttons; sticky by default. */
  action(options: ToastOptions & { actions: ToastAction[] }): void {
    this.dispatch({
      ...options,
      severity: options.severity ?? 'info',
      sticky: options.sticky ?? true,
    });
  }

  /** Override an intent's defaults at runtime (e.g. from a backend response or flag). */
  configureIntent(intent: string, patch: ToastOptions): void {
    this.intents.set(intent, { ...(this.intents.get(intent) ?? {}), ...patch });
  }

  /** Swallow error/warn toasts for the next `ms` (used during session teardown). */
  suppressErrorsFor(ms: number): void {
    this.suppressErrorsUntil = Math.max(this.suppressErrorsUntil, Date.now() + ms);
  }

  /** Escape hatch for a pre-built message; still de-duped and lifetime-normalized. */
  show(message: RawMessage): void {
    this.dispatch({
      severity: this.asSeverity(message.severity),
      summary: typeof message.summary === 'string' ? message.summary : undefined,
      detail: typeof message.detail === 'string' ? message.detail : undefined,
      life: typeof message.life === 'number' ? message.life : undefined,
      sticky: message.sticky ?? undefined,
      closable: message.closable ?? undefined,
    });
  }

  clear(key?: string): void {
    this.messageService.clear(key);
    // A keyed clear only wipes that outlet; leave the other dedupe keys registered.
    if (key) return;
    for (const timer of this.active.values()) if (timer) clearTimeout(timer);
    this.active.clear();
  }

  /** Free a dedupe key when its toast closes (called by the outlet). */
  release(dedupeKey: string | undefined): void {
    if (!dedupeKey) return;
    const timer = this.active.get(dedupeKey);
    if (timer) clearTimeout(timer);
    this.active.delete(dedupeKey);
  }

  /**
   * Forget an intent's dedupe state — the in-memory key and the persisted
   * cross-document window — so its next emit is guaranteed to surface. Called
   * when a fresh session re-arms a one-shot notice (e.g. session eviction).
   */
  resetIntent(intent: string): void {
    const dedupeKey = this.intents.get(intent)?.dedupeKey ?? intent;
    this.release(dedupeKey);
    this.clearPersisted(dedupeKey);
  }

  private dispatch(options: ResolvedToast): void {
    const severity = options.severity;
    const sticky = options.sticky ?? false;
    const hasActions = !!options.actions?.length;
    const dedupeKey =
      options.dedupeKey ?? `${severity}|${options.summary ?? ''}|${options.detail ?? ''}`;

    if (!options.force && this.isSuppressed(severity)) return;
    if (this.active.has(dedupeKey)) return;
    if (options.persistDedupeMs && this.isPersistDeduped(dedupeKey, options.persistDedupeMs))
      return;

    const life = sticky ? undefined : (options.life ?? DEFAULT_LIFE[severity]);

    this.registerActive(dedupeKey, life);
    if (options.persistDedupeMs) this.markPersisted(dedupeKey);
    this.messageService.add({
      severity,
      summary: options.summary,
      detail: options.detail,
      life,
      sticky,
      closable: options.closable ?? true,
      key: hasActions ? ACTION_TOAST_KEY : undefined,
      data: { dedupeKey, severity, actions: options.actions, blocking: options.blocking },
    });
  }

  private registerActive(dedupeKey: string, life: number | undefined): void {
    if (life && life > 0) {
      this.active.set(
        dedupeKey,
        setTimeout(() => this.active.delete(dedupeKey), life + DEDUPE_BUFFER_MS),
      );
    } else {
      this.active.set(dedupeKey, null); // sticky/action: freed on close
    }
  }

  private isSuppressed(severity: ToastSeverity): boolean {
    return (severity === 'error' || severity === 'warn') && Date.now() < this.suppressErrorsUntil;
  }

  private isPersistDeduped(dedupeKey: string, windowMs: number): boolean {
    const shownAt = this.readPersistedAt(dedupeKey);
    return shownAt !== null && Date.now() - shownAt < windowMs;
  }

  private markPersisted(dedupeKey: string): void {
    const store = this.sessionStore();
    try {
      store?.setItem(PERSIST_DEDUPE_PREFIX + dedupeKey, String(Date.now()));
    } catch {
      // storage full/disabled — the in-memory dedupe still applies
    }
  }

  private readPersistedAt(dedupeKey: string): number | null {
    const store = this.sessionStore();
    try {
      const raw = store?.getItem(PERSIST_DEDUPE_PREFIX + dedupeKey) ?? null;
      if (raw === null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private clearPersisted(dedupeKey: string): void {
    const store = this.sessionStore();
    try {
      store?.removeItem(PERSIST_DEDUPE_PREFIX + dedupeKey);
    } catch {
      // ignore
    }
  }

  private sessionStore(): Storage | null {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    } catch {
      return null;
    }
  }

  private asSeverity(value: unknown): ToastSeverity {
    return value === 'success' || value === 'info' || value === 'warn' || value === 'error'
      ? value
      : 'info';
  }
}
