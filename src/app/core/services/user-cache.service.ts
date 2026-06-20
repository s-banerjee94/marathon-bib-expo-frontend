import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { UserService } from './user.service';

/** Minimal user display info resolved on demand for audit columns (createdBy / lastModifiedBy). */
export interface UserSummary {
  /** Resolved user id — drives the row link. `null` while pending or when the lookup failed. */
  id: number | null;
  /** Display name: the resolved full name, falling back to the raw username. */
  name: string;
  /** Short-lived presigned profile-picture URL, or null when none is set. */
  avatarUrl: string | null;
  /** True once a lookup succeeds; stays false while pending or after a swallowed 404/403. */
  resolved: boolean;
}

/**
 * In-memory user cache keyed by username — the "memory" behind {@link UserSummaryPipe},
 * mirroring {@link EventCacheService}.
 *
 * Audit fields (`createdBy`, `lastModifiedBy`) carry only a username. This root singleton
 * resolves each username to its display name + avatar on demand: the first request seeds a
 * placeholder signal (showing the raw username) and fires a single `getUserByUsername`;
 * every later request reuses the cached signal, so each username is fetched at most once.
 *
 * For ORGANIZER_ADMIN / ORGANIZER_USER the backend returns 404/403 when the username belongs
 * to another organization or to a ROOT/ADMIN user. That is expected, not an error: the lookup
 * is swallowed and the placeholder (raw username, no avatar/link) is kept.
 */
@Injectable({ providedIn: 'root' })
export class UserCacheService {
  private userService = inject(UserService);

  // username → live summary signal. Created synchronously on first access, which also
  // dedupes concurrent lookups for the same username (only one HTTP call).
  private readonly users = new Map<string, WritableSignal<UserSummary>>();

  /**
   * Resolve a username's display summary. Returns a signal holding a placeholder (the raw
   * username, no id/avatar) until the lookup lands, then updating to the real name + avatar.
   * The fetch runs only on the first miss; a failed lookup (404/403) keeps the placeholder.
   */
  resolve(username: string): Signal<UserSummary> {
    let user = this.users.get(username);
    if (!user) {
      user = signal<UserSummary>({ id: null, name: username, avatarUrl: null, resolved: false });
      this.users.set(username, user);
      this.userService.getUserByUsername(username).subscribe({
        next: (u) =>
          user!.set({
            id: u.id,
            name: u.fullName || u.username,
            avatarUrl: u.profilePictureUrl ?? null,
            resolved: true,
          }),
        error: () => {
          /* non-fatal: out-of-org / admin user (404/403) — keep the username placeholder */
        },
      });
    }
    return user;
  }
}
