import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CardFly } from './card-fly';
import { LetterPop } from './letter-pop';
import { Magnetic } from './magnetic';

gsap.registerPlugin(ScrollTrigger);

interface DemoRunner {
  bib: string;
  category: string;
}

const SCAN_DURATION_MS = 700;
const COLLECTED_HOLD_MS = 750;

@Component({
  selector: 'app-hero',
  imports: [RouterLink, ButtonModule, DecimalPipe, Magnetic, LetterPop, CardFly],
  templateUrl: './hero.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('heroSection');
  private readonly bg = viewChild.required<ElementRef<HTMLElement>>('heroBg');
  private readonly demoCol = viewChild.required<ElementRef<HTMLElement>>('demoCol');
  private readonly meltWrap = viewChild.required<ElementRef<HTMLElement>>('meltWrap');
  private readonly cardFly = viewChild.required(CardFly);
  private mm?: gsap.MatchMedia;

  /** Non-breaking space keeps the gap between words inside inline-block letter spans. */
  readonly meltChars: readonly string[] = Array.from('melt\u00A0down');

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
  readonly busy = signal(false);
  readonly collectedCount = signal(1284);
  readonly current = computed(() => this.runners[this.runnerIndex()]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.scanTimeoutId);
      this.mm?.revert();
    });

    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.mm = gsap.matchMedia();
        this.mm.add('(prefers-reduced-motion: no-preference)', () => {
          const scrub: ScrollTrigger.Vars = {
            trigger: this.section().nativeElement,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          };
          gsap.to(this.bg().nativeElement, { yPercent: 18, ease: 'none', scrollTrigger: scrub });
          gsap.to(this.demoCol().nativeElement, { y: -60, ease: 'none', scrollTrigger: scrub });

          const wrap = this.meltWrap().nativeElement;
          const chars = Array.from(wrap.querySelectorAll<HTMLElement>('[data-melt-char]'));
          const line = wrap.querySelector<HTMLElement>('[data-melt-line]');
          let unmeltTimerId: ReturnType<typeof setTimeout> | undefined;
          const melt = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              clearTimeout(unmeltTimerId);
              unmeltTimerId = setTimeout(unmelt, 1200);
            }
            gsap.to(chars, {
              y: () => gsap.utils.random(12, 26),
              rotation: () => gsap.utils.random(-12, 12),
              scaleY: () => gsap.utils.random(1.15, 1.4),
              transformOrigin: 'top center',
              duration: 0.5,
              ease: 'power2.in',
              stagger: { each: 0.03, from: 'random' },
              overwrite: true,
            });
            if (line) {
              gsap.to(line, {
                y: 7,
                rotation: -2.5,
                duration: 0.5,
                ease: 'power2.in',
                overwrite: true,
              });
            }
          };
          const unmelt = (): void => {
            gsap.to(chars, {
              y: 0,
              rotation: 0,
              scaleY: 1,
              duration: 1,
              ease: 'elastic.out(1, 0.4)',
              stagger: 0.02,
              overwrite: true,
            });
            if (line) {
              gsap.to(line, {
                y: 0,
                rotation: 0,
                duration: 0.8,
                ease: 'elastic.out(1, 0.5)',
                overwrite: true,
              });
            }
          };
          // A tap fires pointerleave right after pointerup, which would undo the
          // melt instantly — on touch the timer above springs it back instead.
          const onLeave = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              return;
            }
            unmelt();
          };
          wrap.addEventListener('pointerenter', melt);
          wrap.addEventListener('pointerleave', onLeave);
          return () => {
            clearTimeout(unmeltTimerId);
            wrap.removeEventListener('pointerenter', melt);
            wrap.removeEventListener('pointerleave', onLeave);
          };
        });
      });
    });
  }

  scan(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);

    if (this.prefersReducedMotion) {
      this.markCollected();
      this.scanTimeoutId = setTimeout(() => {
        this.nextRunner();
        this.busy.set(false);
      }, COLLECTED_HOLD_MS);
      return;
    }

    this.isScanning.set(true);
    this.scanTimeoutId = setTimeout(() => {
      this.isScanning.set(false);
      this.markCollected();
      this.scanTimeoutId = setTimeout(() => {
        void this.cardFly()
          .swap(() => this.nextRunner())
          .then(() => this.busy.set(false));
      }, COLLECTED_HOLD_MS);
    }, SCAN_DURATION_MS);
  }

  private markCollected(): void {
    this.isCollected.set(true);
    this.collectedCount.update((c) => c + 1);
  }

  private nextRunner(): void {
    this.runnerIndex.update((i) => (i + 1) % this.runners.length);
    this.isCollected.set(false);
  }
}
