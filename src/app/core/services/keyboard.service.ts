import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { EVENT_MANAGEMENT_ROLES, PLATFORM_ADMIN_ROLES, UserRole } from '../models/user.model';

/** Logical grouping of shortcuts, used as section headings in the help overlay. */
export type ShortcutGroup = 'Navigation' | 'Actions' | 'General';

export interface Shortcut {
  /**
   * The key sequence as `KeyboardEvent.key` values (letters lowercased). A single
   * entry is a plain key (`/`, `?`); two entries form a chord (`g` then `d`).
   */
  sequence: string[];
  /** The chips rendered in the help overlay — e.g. `['g', 'd']` or `['Esc']`. */
  keys: string[];
  label: string;
  group: ShortcutGroup;
  /** Role/auth gate: a shortcut only fires (and only appears in help) when true. */
  available: () => boolean;
  run: () => void;
}

// How long after a prefix key (`g`, `n`) we keep waiting for the second key.
const CHORD_TIMEOUT_MS = 500;

// Marker the in-page primary search field opts in with, focused by `/`.
const SEARCH_FIELD_SELECTOR = 'input[data-keyboard-search]';

/**
 * Owns the app-wide keyboard shortcut system. A root singleton that attaches a
 * single document-level `keydown` listener and runs a small chord-detection
 * state machine: a prefix key (`g`, `n`) arms a 500ms window in which the next
 * key completes a two-key chord (e.g. `g d` → Dashboard); plain keys (`/`, `?`)
 * fire immediately.
 *
 * Shortcuts never fire while an `<input>`, `<textarea>` or `[contenteditable]`
 * holds focus, nor while a modifier (Ctrl/Cmd/Alt) is down — the Cmd/Ctrl+K
 * command palette and native browser shortcuts are left untouched. The whole
 * system is disabled for DISTRIBUTOR; the remaining navigation/action shortcuts
 * are role-gated to the same roles their routes allow, so a chord never bounces
 * the user to /unauthorized and the help overlay only lists what the current
 * user can actually do.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly helpOpenSignal = signal(false);
  readonly helpOpen = this.helpOpenSignal.asReadonly();

  /**
   * The whole shortcut system is available to every signed-in role except
   * DISTRIBUTOR. Gates both firing and the help overlay.
   */
  readonly available = computed(
    () => this.auth.isAuthenticated() && !this.auth.hasRole(UserRole.DISTRIBUTOR),
  );

  /**
   * The single source of truth for every shortcut — drives both behaviour and
   * the help overlay. Array order is the display order; each entry's `available`
   * gate doubles as the help filter, so org-scoped roles simply never see the
   * Organizations entries (`g o`, `n o`) they can't reach.
   */
  private readonly shortcuts: Shortcut[] = [
    {
      sequence: ['g', 'h'],
      keys: ['g', 'h'],
      label: 'Go to Dashboard',
      group: 'Navigation',
      available: () => this.auth.isAuthenticated(),
      run: () => this.router.navigate(['/dashboard']),
    },
    {
      sequence: ['g', 'u'],
      keys: ['g', 'u'],
      label: 'Go to Users',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      run: () => this.router.navigate(['/users']),
    },
    {
      sequence: ['g', 'o'],
      keys: ['g', 'o'],
      label: 'Go to Organizations',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES),
      run: () => this.router.navigate(['/organizations']),
    },
    {
      sequence: ['g', 'e'],
      keys: ['g', 'e'],
      label: 'Go to Events',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      run: () => this.router.navigate(['/events']),
    },
    {
      sequence: ['g', 'p'],
      keys: ['g', 'p'],
      label: 'Go to Participants',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      run: () => this.router.navigate(['/participants']),
    },
    {
      sequence: ['g', 'd'],
      keys: ['g', 'd'],
      label: 'Go to Distribution',
      group: 'Navigation',
      available: () => this.auth.isAuthenticated(),
      run: () => this.router.navigate(['/distribution']),
    },
    {
      sequence: ['g', 'b'],
      keys: ['g', 'b'],
      label: 'Go to Billing',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES),
      run: () => this.router.navigate(['/billing']),
    },
    {
      sequence: ['g', 'a'],
      keys: ['g', 'a'],
      label: 'Go to Audit logs',
      group: 'Navigation',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      run: () => this.router.navigate(['/audit-logs']),
    },
    {
      sequence: ['g', 'i'],
      keys: ['g', 'i'],
      label: 'Go to Profile',
      group: 'Navigation',
      available: () => this.auth.isAuthenticated(),
      run: () => this.router.navigate(['/profile']),
    },
    {
      sequence: ['n', 'u'],
      keys: ['n', 'u'],
      label: 'New user',
      group: 'Actions',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      // Quick-create travels as navigation state (see navigation-state.utils.ts);
      // 'reload' lets the chord work when the list page is already open.
      run: () =>
        this.router.navigate(['/users'], {
          state: { create: true },
          onSameUrlNavigation: 'reload',
        }),
    },
    {
      sequence: ['n', 'o'],
      keys: ['n', 'o'],
      label: 'New organization',
      group: 'Actions',
      available: () => this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES),
      run: () =>
        this.router.navigate(['/organizations'], {
          state: { create: true },
          onSameUrlNavigation: 'reload',
        }),
    },
    {
      sequence: ['n', 'e'],
      keys: ['n', 'e'],
      label: 'New event',
      group: 'Actions',
      available: () => this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES),
      run: () => this.router.navigate(['/events/new']),
    },
    {
      sequence: ['/'],
      keys: ['/'],
      label: 'Focus search',
      group: 'General',
      available: () => this.auth.isAuthenticated(),
      run: () => this.focusPrimarySearch(),
    },
    {
      sequence: ['?'],
      keys: ['?'],
      label: 'Keyboard shortcuts',
      group: 'General',
      available: () => this.auth.isAuthenticated(),
      run: () => this.openHelp(),
    },
    {
      sequence: ['Escape'],
      keys: ['Esc'],
      label: 'Close dialog',
      group: 'General',
      available: () => this.auth.isAuthenticated(),
      run: () => this.closeHelp(),
    },
  ];

  /** Prefix keys that arm a chord (the first key of any two-key sequence). */
  private readonly prefixKeys = new Set(
    this.shortcuts.filter((s) => s.sequence.length === 2).map((s) => s.sequence[0]),
  );

  /** Shortcuts the current user can use, grouped for the help overlay. */
  readonly helpGroups = computed(() => {
    // available() reads the auth signals, so this re-evaluates on login/logout/role change.
    if (!this.available()) return [];
    const order: ShortcutGroup[] = ['Navigation', 'Actions', 'General'];
    return order
      .map((group) => ({
        group,
        shortcuts: this.shortcuts.filter((s) => s.group === group && s.available()),
      }))
      .filter((section) => section.shortcuts.length > 0);
  });

  // The armed prefix key and the timer that disarms it after CHORD_TIMEOUT_MS.
  private pendingPrefix: string | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.document.addEventListener('keydown', this.onKeydown, { capture: true });
    }
  }

  openHelp(): void {
    this.helpOpenSignal.set(true);
  }

  closeHelp(): void {
    this.helpOpenSignal.set(false);
  }

  setHelpOpen(open: boolean): void {
    this.helpOpenSignal.set(open);
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    // Leave everything to the browser/command palette when a modifier is held,
    // or when the user is typing into a field.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      this.disarm();
      return;
    }
    if (this.isEditableTarget(event.target) || !this.available()) {
      this.disarm();
      return;
    }

    const key = this.normalizeKey(event.key);

    // Mid-chord: the previous key armed a prefix and we're inside the window.
    if (this.pendingPrefix) {
      const match = this.findShortcut([this.pendingPrefix, key]);
      this.disarm();
      if (match) {
        event.preventDefault();
        // A chord navigates away; don't leave the help overlay lingering on top.
        this.closeHelp();
        match.run();
      }
      return;
    }

    // A plain single-key shortcut (`/`, `?`, `Esc`).
    const single = this.findShortcut([key]);
    if (single) {
      // Esc is shared with PrimeNG dialog dismissal — never swallow it.
      if (key !== 'Escape') event.preventDefault();
      single.run();
      return;
    }

    // Arm a chord prefix and wait for the completing key.
    if (this.prefixKeys.has(key)) {
      this.pendingPrefix = key;
      this.pendingTimer = setTimeout(() => this.disarm(), CHORD_TIMEOUT_MS);
    }
  };

  private findShortcut(sequence: string[]): Shortcut | undefined {
    return this.shortcuts.find(
      (s) =>
        s.available() &&
        s.sequence.length === sequence.length &&
        s.sequence.every((k, i) => k === sequence[i]),
    );
  }

  private normalizeKey(key: string): string {
    // Letters are matched case-insensitively; punctuation (`/`, `?`) and named
    // keys (`Escape`) are matched verbatim.
    return key.length === 1 ? key.toLowerCase() : key;
  }

  private disarm(): void {
    this.pendingPrefix = null;
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  private focusPrimarySearch(): void {
    const input = this.document.querySelector<HTMLInputElement>(SEARCH_FIELD_SELECTOR);
    input?.focus();
    input?.select();
  }
}
