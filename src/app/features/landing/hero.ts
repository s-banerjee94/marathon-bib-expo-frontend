import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

interface DemoRunner {
  bib: string;
  category: string;
}

const SCAN_DURATION_MS = 700;

@Component({
  selector: 'app-hero',
  imports: [RouterLink, ButtonModule, DecimalPipe],
  templateUrl: './hero.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  private readonly destroyRef = inject(DestroyRef);

  private readonly runners: readonly DemoRunner[] = [
    { bib: '12044', category: 'M 30–34' },
    { bib: '08871', category: 'F 18–24' },
    { bib: '15532', category: 'M 45–49' },
    { bib: '03210', category: 'F 30–34' },
    { bib: '21987', category: 'M 18–24' },
  ];

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly runnerIndex = signal(0);
  private scanTimeoutId?: ReturnType<typeof setTimeout>;

  readonly isScanning = signal(false);
  readonly isCollected = signal(false);
  readonly collectedCount = signal(1284);
  readonly current = computed(() => this.runners[this.runnerIndex()]);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.scanTimeoutId));
  }

  scan(): void {
    if (this.isScanning()) {
      return;
    }
    if (this.isCollected()) {
      this.runnerIndex.update((i) => (i + 1) % this.runners.length);
      this.isCollected.set(false);
    }

    if (this.prefersReducedMotion) {
      this.isCollected.set(true);
      this.collectedCount.update((c) => c + 1);
      return;
    }

    this.isScanning.set(true);
    this.scanTimeoutId = setTimeout(() => {
      this.isScanning.set(false);
      this.isCollected.set(true);
      this.collectedCount.update((c) => c + 1);
    }, SCAN_DURATION_MS);
  }
}
