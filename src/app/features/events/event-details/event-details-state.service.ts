import { computed, Injectable, signal } from '@angular/core';
import { Event } from '../../../core/models/event.model';
import { Race } from '../../../core/models/race.model';

@Injectable()
export class EventDetailsState {
  private eventSignal = signal<Event | null>(null);
  private selectedRaceSignal = signal<Race | null>(null);

  readonly event = this.eventSignal.asReadonly();
  readonly selectedRace = this.selectedRaceSignal.asReadonly();

  /** Parses the JSON-string `eventGoodies` field into a typed string array. */
  readonly goodiesArray = computed<string[]>(() => {
    const s = this.event()?.eventGoodies;
    if (!s) return [];
    try {
      return JSON.parse(s) as string[];
    } catch {
      return [];
    }
  });

  setEvent(event: Event | null): void {
    this.eventSignal.set(event);
  }

  setSelectedRace(race: Race | null): void {
    this.selectedRaceSignal.set(race);
  }
}
