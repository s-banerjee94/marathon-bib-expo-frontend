import { inject, Pipe, PipeTransform } from '@angular/core';
import { EventCacheService } from '../../core/services/event-cache.service';

/**
 * Resolves an event id to its logo URL via the shared {@link EventCacheService}
 * (lazy fetch + cache, mirroring {@link OrgLogoPipe}). Returns the presigned URL
 * only when it's a valid http(s) link, else null — so `<p-avatar [image]>` falls
 * back to the event initials when the event has no logo.
 *
 * Usage: <p-avatar [image]="bill.eventId | eventLogo" [label]="bill.eventName | initials" />
 */
@Pipe({
  name: 'eventLogo',
  pure: false,
})
export class EventLogoPipe implements PipeTransform {
  private cache = inject(EventCacheService);

  transform(id: string | number | null | undefined): string | null {
    if (id === null || id === undefined || id === '') return null;
    const url = this.cache.resolve(Number(id))().logoUrl;
    return url && /^https?:\/\//i.test(url) ? url : null;
  }
}
