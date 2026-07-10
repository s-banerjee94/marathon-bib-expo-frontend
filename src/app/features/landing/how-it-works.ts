import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

interface Step {
  num: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-how-it-works',
  templateUrl: './how-it-works.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorks {
  private readonly destroyRef = inject(DestroyRef);
  private holdTimeoutId?: ReturnType<typeof setTimeout>;

  readonly activeStep = signal(0);

  /** How far the active step's mini-visual has revealed. Each stage's element only enters
   *  the DOM once the previous one's `animationend` actually fires — not a guessed delay —
   *  so the reveal is genuinely one-by-one regardless of how long any stage takes. */
  readonly stageProgress = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.holdTimeoutId));
  }

  selectStep(index: number): void {
    this.activeStep.set(index);
    this.stageProgress.set(0);
    clearTimeout(this.holdTimeoutId);
  }

  /** Advances to the next stage once the triggering element's own animation finishes.
   *  `holdMs` adds a deliberate pause after that so the just-revealed stage has a moment
   *  to register before the next one starts growing in — without it, stages chain into
   *  each other instantly and the sequence feels rushed. */
  advanceStage(stage: number, event: AnimationEvent, holdMs = 0): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (holdMs > 0) {
      this.holdTimeoutId = setTimeout(() => this.stageProgress.set(stage), holdMs);
    } else {
      this.stageProgress.set(stage);
    }
  }

  readonly steps: readonly Step[] = [
    {
      num: '01',
      title: 'Spin up your event',
      body: 'Create the event, define races (Full, Half, 10K), add categories (age × gender), and set participant limits. Minutes, not a ticket to IT.',
    },
    {
      num: '02',
      title: 'Map and import the roster',
      body: 'Drag CSV columns onto bib, chip, size, and goodie fields in the visual mapper — or add walk-ins one at a time at the table. Validation runs in the background; errors come back itemized.',
    },
    {
      num: '03',
      title: 'Scan at the expo',
      body: 'Distributors open the QR scanner or search by bib, name, or phone. Tick the kit, move on — the same screen works if the venue wifi drops.',
    },
    {
      num: '04',
      title: 'Review the trail',
      body: 'Pull the collection report, replay the audit log entry by entry, and see who picked up, who didn’t, and who swapped a bib.',
    },
  ];
}
