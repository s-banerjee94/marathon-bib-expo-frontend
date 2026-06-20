import { inject, Pipe, PipeTransform } from '@angular/core';
import { UserCacheService, UserSummary } from '../../core/services/user-cache.service';

/**
 * Resolves an audit username (`createdBy` / `lastModifiedBy`) to its display summary
 * (name + avatar + id) via the shared {@link UserCacheService} (lazy fetch + in-memory
 * cache). Impure so the cell flips from the raw-username placeholder to the resolved
 * name/avatar once the lookup lands; the cache keeps the steady state a cheap synchronous
 * map read. Returns null for an empty value so the cell can render `--`.
 *
 * For org-scoped roles the lookup may 404/403 (out-of-org or ROOT/ADMIN user); in that
 * case the summary stays unresolved (`id === null`) and the template falls back to plain
 * username text — no error is surfaced.
 *
 * Usage: @let s = user.createdBy | userSummary;
 */
@Pipe({
  name: 'userSummary',
  pure: false,
})
export class UserSummaryPipe implements PipeTransform {
  private cache = inject(UserCacheService);

  transform(username: string | null | undefined): UserSummary | null {
    if (!username) return null;
    return this.cache.resolve(username)();
  }
}
