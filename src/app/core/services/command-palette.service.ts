import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { EventService } from './event.service';
import { OrganizationService } from './organization.service';
import { UserService } from './user.service';
import {
  EVENT_MANAGEMENT_ROLES,
  PLATFORM_ADMIN_ROLES,
  ROLE_LABELS,
  User,
  UserRole,
} from '../models/user.model';

/** Entity kinds the palette can surface, each navigating to its own detail route. */
export type CommandResultType = 'event' | 'organization' | 'user';

export interface CommandResult {
  type: CommandResultType;
  /** Stable key for template tracking (type + id). */
  key: string;
  title: string;
  subtitle: string;
  /** PrimeIcon class — a role icon for users, an entity icon otherwise. */
  icon: string;
  /** Router commands array, passed straight to Router.navigate(). */
  commands: (string | number)[];
}

export interface CommandResultGroup {
  type: CommandResultType;
  label: string;
  icon: string;
  results: CommandResult[];
}

// As-you-type debounce and the floor below which we don't hit the backend.
const SEARCH_DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;
const MAX_PER_GROUP = 5;

const ROLE_ICONS: Record<UserRole, string> = {
  [UserRole.ROOT]: 'pi pi-crown',
  [UserRole.ADMIN]: 'pi pi-shield',
  [UserRole.ORGANIZER_ADMIN]: 'pi pi-briefcase',
  [UserRole.ORGANIZER_USER]: 'pi pi-user',
  [UserRole.DISTRIBUTOR]: 'pi pi-box',
};

/**
 * Backs the global Cmd/Ctrl+K command palette. A root singleton that owns the
 * open/close state, registers the keyboard shortcut once, and orchestrates the
 * as-you-type search across events, organizations and users.
 *
 * Each entity search is role-gated (only types the user can reach are queried)
 * and fault-isolated (a 403/500 on one type yields an empty group rather than
 * failing the whole result set).
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly eventService = inject(EventService);
  private readonly organizationService = inject(OrganizationService);
  private readonly userService = inject(UserService);

  private readonly openSignal = signal(false);
  private readonly querySignal = signal('');
  private readonly loadingSignal = signal(false);
  private readonly resultsSignal = signal<CommandResultGroup[]>([]);

  readonly isOpen = this.openSignal.asReadonly();
  readonly query = this.querySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly results = this.resultsSignal.asReadonly();

  /** Flat, in-display order — drives keyboard ↑↓ selection in the component. */
  readonly flatResults = computed(() => this.resultsSignal().flatMap((group) => group.results));
  readonly hasResults = computed(() => this.flatResults().length > 0);

  /** Available to every signed-in role except DISTRIBUTOR (who can reach none of these areas). */
  readonly available = computed(
    () => this.auth.isAuthenticated() && !this.auth.hasRole(UserRole.DISTRIBUTOR),
  );

  /**
   * The entity types the current user can actually search, in display order — drives
   * the placeholder and empty-state copy so org-scoped roles (who can't search
   * organizations) aren't told they can.
   */
  readonly searchableScopes = computed<string[]>(() => {
    const scopes: string[] = [];
    if (this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES)) scopes.push('events');
    if (this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES)) scopes.push('organizations');
    if (this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES)) scopes.push('users');
    return scopes;
  });

  /** Placeholder reflecting the user's searchable scope, e.g. "Search events, users…". */
  readonly searchPlaceholder = computed(() => {
    const scopes = this.searchableScopes();
    return scopes.length ? `Search ${scopes.join(', ')}…` : 'Search…';
  });

  /** Empty-state hint, e.g. "Find events and users". */
  readonly searchHint = computed(() => {
    const scopes = this.searchableScopes();
    if (scopes.length === 0) return '';
    if (scopes.length === 1) return `Find ${scopes[0]}`;
    return `Find ${scopes.slice(0, -1).join(', ')} and ${scopes[scopes.length - 1]}`;
  });

  /** Platform-aware shortcut label shown on the navbar trigger (⌘ on Apple, Ctrl elsewhere). */
  readonly shortcutLabel =
    isPlatformBrowser(this.platformId) && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
      ? '⌘ K'
      : 'Ctrl + K';

  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        switchMap((term) => {
          if (term.length < MIN_QUERY_LENGTH) {
            this.loadingSignal.set(false);
            return of<CommandResultGroup[]>([]);
          }
          return this.runSearch(term);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.resultsSignal.set(groups);
        this.loadingSignal.set(false);
      });

    if (isPlatformBrowser(this.platformId)) {
      this.document.addEventListener('keydown', this.onGlobalKeydown, { capture: true });
    }
  }

  open(): void {
    if (!this.available()) return;
    this.reset();
    this.openSignal.set(true);
  }

  close(): void {
    this.openSignal.set(false);
    this.reset();
  }

  toggle(): void {
    if (this.openSignal()) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Called on every keystroke; debounced and dispatched to the backend. */
  search(query: string): void {
    const term = query.trim();
    this.querySignal.set(query);
    this.loadingSignal.set(term.length >= MIN_QUERY_LENGTH);
    if (term.length < MIN_QUERY_LENGTH) {
      this.resultsSignal.set([]);
    }
    this.searchInput$.next(term);
  }

  /** Navigate to a result and dismiss the palette. */
  navigateTo(result: CommandResult): void {
    this.close();
    this.router.navigate(result.commands);
  }

  private reset(): void {
    this.querySignal.set('');
    this.resultsSignal.set([]);
    this.loadingSignal.set(false);
  }

  private readonly onGlobalKeydown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key.toLowerCase() !== 'k') return;
    if (!this.available()) return;
    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  };

  private runSearch(term: string): Observable<CommandResultGroup[]> {
    const streams: Observable<CommandResultGroup | null>[] = [];

    if (this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES)) streams.push(this.searchEvents(term));
    if (this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES)) streams.push(this.searchOrganizations(term));
    if (this.auth.hasAnyRole(EVENT_MANAGEMENT_ROLES)) streams.push(this.searchUsers(term));

    if (streams.length === 0) return of([]);
    return forkJoin(streams).pipe(
      map((groups) =>
        groups.filter((g): g is CommandResultGroup => g !== null && g.results.length > 0),
      ),
    );
  }

  private searchEvents(term: string): Observable<CommandResultGroup | null> {
    return this.eventService.searchEvents({ page: 0, size: MAX_PER_GROUP, search: term }).pipe(
      map((response) => ({
        type: 'event' as const,
        label: 'Events',
        icon: 'pi pi-calendar',
        results: response.content.map((event) => ({
          type: 'event' as const,
          key: `event-${event.id}`,
          title: event.eventName,
          subtitle: event.venueName || event.city || event.status,
          icon: 'pi pi-calendar',
          commands: ['/events', event.id],
        })),
      })),
      catchError(() => of(null)),
    );
  }

  private searchOrganizations(term: string): Observable<CommandResultGroup | null> {
    return this.organizationService
      .searchOrganizations({ page: 0, size: MAX_PER_GROUP, search: term })
      .pipe(
        map((response) => ({
          type: 'organization' as const,
          label: 'Organizations',
          icon: 'pi pi-building',
          results: response.content.map((org) => ({
            type: 'organization' as const,
            key: `organization-${org.id}`,
            title: org.organizerName,
            subtitle: org.email || org.city || '',
            icon: 'pi pi-building',
            commands: ['/organizations', org.id, 'edit'],
          })),
        })),
        catchError(() => of(null)),
      );
  }

  private searchUsers(term: string): Observable<CommandResultGroup | null> {
    return this.userService.searchUsers({ page: 0, size: MAX_PER_GROUP, search: term }).pipe(
      map((response) => ({
        type: 'user' as const,
        label: 'Users',
        icon: 'pi pi-users',
        results: response.content.map((user) => ({
          type: 'user' as const,
          key: `user-${user.id}`,
          title: user.fullName || user.username,
          subtitle: this.userSubtitle(user),
          icon: ROLE_ICONS[user.role] ?? 'pi pi-user',
          commands: ['/users', user.id, 'edit'],
        })),
      })),
      catchError(() => of(null)),
    );
  }

  private userSubtitle(user: User): string {
    const role = ROLE_LABELS[user.role] ?? user.role;
    return user.username ? `@${user.username} · ${role}` : role;
  }
}
