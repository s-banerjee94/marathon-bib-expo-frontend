import { Injectable, signal } from '@angular/core';

/**
 * Coordinates cross-tab side effects in the routed distribution feature.
 * Routed tabs cannot be reached via @ViewChild from the parent, so the parent
 * bumps `reloadTrigger` after a mutating action and each tab effect()s on it.
 */
@Injectable()
export class DistributionDialogState {
  private reloadTriggerSignal = signal(0);
  readonly reloadTrigger = this.reloadTriggerSignal.asReadonly();

  triggerReload(): void {
    this.reloadTriggerSignal.update((v) => v + 1);
  }
}
