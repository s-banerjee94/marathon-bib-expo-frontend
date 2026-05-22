import { Injectable, signal } from '@angular/core';

/**
 * Coordinates cross-tab reloads inside the Participants feature.
 * The parent triggers a reload (e.g., after batch import completes),
 * each tab effect()s on the trigger and refreshes its own data.
 */
@Injectable()
export class ParticipantListState {
  private reloadTriggerSignal = signal(0);
  readonly reloadTrigger = this.reloadTriggerSignal.asReadonly();

  triggerReload(): void {
    this.reloadTriggerSignal.update((v) => v + 1);
  }
}
