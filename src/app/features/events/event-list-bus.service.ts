import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Event } from '../../core/models/event.model';

export type EventMutation =
  | { readonly action: 'created'; readonly event: Event }
  | { readonly action: 'updated'; readonly event: Event };

// Lets EventForm — whether rendered via dialog (desktop) or as a routed component
// (mobile) — push successful create/update results back to EventList. The list
// updates the table locally instead of refetching, so page/filters/sort survive the
// round-trip.
@Injectable({ providedIn: 'root' })
export class EventListBus {
  private readonly mutationSubject = new Subject<EventMutation>();
  readonly mutations$: Observable<EventMutation> = this.mutationSubject.asObservable();

  publish(mutation: EventMutation): void {
    this.mutationSubject.next(mutation);
  }
}
