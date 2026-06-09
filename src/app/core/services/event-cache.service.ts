import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { EventService } from './event.service';

/** Minimal event display info resolved on demand for bill rows (name + logo). */
export interface EventSummary {
  name: string;
  /** Short-lived presigned logo URL, or null when the event has no logo set. */
  logoUrl: string | null;
}

/**
 * In-memory event cache — the "memory" behind {@link EventLogoPipe}, mirroring
 * {@link OrgNameCacheService}.
 *
 * Bill rows carry the `eventName` but never the event logo. This root singleton
 * resolves each event on demand and remembers both its name and logo: the first
 * request for an id seeds a placeholder signal and fires a single `getEventById`;
 * every later request reuses the cached signal, so each id is fetched at most once.
 */
@Injectable({ providedIn: 'root' })
export class EventCacheService {
  private eventService = inject(EventService);

  // id → live event-summary signal. Created synchronously on first access, which
  // also dedupes concurrent lookups for the same id (only one HTTP call).
  private readonly events = new Map<number, WritableSignal<EventSummary>>();

  /**
   * Resolve an event's display summary. Returns a signal holding an `Event #id`
   * placeholder (no logo) until the lookup lands, then updating to the real name
   * and logo. The fetch runs only on the first miss; a failed lookup keeps the
   * placeholder.
   */
  resolve(id: number): Signal<EventSummary> {
    let event = this.events.get(id);
    if (!event) {
      event = signal<EventSummary>({ name: `Event #${id}`, logoUrl: null });
      this.events.set(id, event);
      this.eventService.getEventById(id).subscribe({
        next: (e) => event!.set({ name: e.eventName, logoUrl: e.logoUrl ?? null }),
        error: () => {
          /* non-fatal: keep the placeholder */
        },
      });
    }
    return event;
  }
}
