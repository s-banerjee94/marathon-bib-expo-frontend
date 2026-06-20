import { inject, Pipe, PipeTransform } from '@angular/core';
import { EventCacheService } from '../../core/services/event-cache.service';

/**
 * Resolves an event id to its display name via the shared {@link EventCacheService}
 * (lazy fetch + in-memory cache, shared with {@link EventLogoPipe} so name and logo
 * cost a single fetch). Impure so the cell flips from the `Event #id` placeholder to
 * the real name once the lookup lands; the cache keeps the steady state a cheap
 * synchronous map read.
 *
 * Usage: {{ user.eventId | eventName }}
 */
@Pipe({
  name: 'eventName',
  pure: false,
})
export class EventNamePipe implements PipeTransform {
  private cache = inject(EventCacheService);

  transform(id: number | null | undefined): string {
    if (id === null || id === undefined) return '--';
    return this.cache.resolve(id)().name;
  }
}
