import { inject, Pipe, PipeTransform } from '@angular/core';
import { OrgNameCacheService } from '../../core/services/org-name-cache.service';

/**
 * Resolves an organization id to its display name via the shared
 * {@link OrgNameCacheService} (lazy fetch + in-memory cache). Impure so the cell
 * flips from the `Org #id` placeholder to the real name once the lookup lands;
 * the cache keeps the steady state a cheap synchronous map read.
 *
 * Usage: {{ bill.organizationId | orgName }}
 */
@Pipe({
  name: 'orgName',
  pure: false,
})
export class OrgNamePipe implements PipeTransform {
  private cache = inject(OrgNameCacheService);

  transform(id: number | null | undefined): string {
    if (id === null || id === undefined) return '--';
    return this.cache.resolve(id)().name;
  }
}
