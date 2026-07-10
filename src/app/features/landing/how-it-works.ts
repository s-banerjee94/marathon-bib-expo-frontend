import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterRenderEffect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LetterPop } from './letter-pop';
import { ScrollReveal } from './scroll-reveal';

gsap.registerPlugin(ScrollTrigger);

interface Step {
  num: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-how-it-works',
  imports: [ScrollReveal, LetterPop],
  templateUrl: './how-it-works.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorks {
  private readonly zone = inject(NgZone);
  private readonly stageBox = viewChild.required<ElementRef<HTMLElement>>('stageBox');

  readonly activeStep = signal(0);
  /** Bumped on every step click so re-selecting the active step replays its visual. */
  private readonly stageNonce = signal(0);

  private stageTl?: gsap.core.Timeline;
  private firstPlayTrigger?: ScrollTrigger;
  private hasScheduled = false;

  constructor() {
    // Runs after the @switch content is in the DOM but before paint, so items
    // can be hidden without a visible flash.
    afterRenderEffect(() => {
      this.stageNonce();
      untracked(() => this.setupStage());
    });
    inject(DestroyRef).onDestroy(() => {
      this.stageTl?.kill();
      this.firstPlayTrigger?.kill();
    });
  }

  selectStep(index: number): void {
    this.activeStep.set(index);
    this.stageNonce.update((n) => n + 1);
  }

  private setupStage(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.firstPlayTrigger?.kill();
      this.firstPlayTrigger = undefined;
      if (!this.hasScheduled) {
        this.hasScheduled = true;
        this.hideItems();
        this.firstPlayTrigger = ScrollTrigger.create({
          trigger: this.stageBox().nativeElement,
          start: 'top 80%',
          once: true,
          onEnter: () => this.playStage(),
        });
        return;
      }
      this.playStage();
    });
  }

  private hideItems(): { items: HTMLElement[]; sweep: HTMLElement | null } {
    const box = this.stageBox().nativeElement;
    const items = Array.from(box.querySelectorAll<HTMLElement>('[data-stage-item]'));
    const sweep = box.querySelector<HTMLElement>('[data-stage-sweep]');
    this.stageTl?.kill();
    gsap.set(items, { opacity: 0, y: 12, scale: 0.92 });
    if (sweep) {
      gsap.set(sweep, { opacity: 0 });
    }
    return { items, sweep };
  }

  /** Grows the stage's pieces in one by one; in the scan stage the QR modules
   *  scatter-assemble and the sweep line crosses before the rest of the flow. */
  private playStage(): void {
    const { items, sweep } = this.hideItems();
    const qrRects = Array.from(
      this.stageBox().nativeElement.querySelectorAll<SVGRectElement>('[data-stage-qr] rect'),
    );
    const tl = gsap.timeline();
    items.forEach((item, i) => {
      tl.to(
        item,
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' },
        i === 0 ? 0 : '+=0.3',
      );
      if (i === 0 && qrRects.length > 0) {
        tl.fromTo(
          qrRects,
          {
            x: () => gsap.utils.random(-34, 34),
            y: () => gsap.utils.random(-30, 30),
            opacity: 0,
            scale: 0,
            transformOrigin: 'center',
          },
          {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(2)',
            stagger: { each: 0.02, from: 'random' },
          },
          '-=0.2',
        );
      }
      if (i === 0 && sweep) {
        tl.set(sweep, { top: '0%', opacity: 1 })
          .to(sweep, { top: '97%', duration: 0.7, ease: 'power1.inOut' })
          .to(sweep, { opacity: 0, duration: 0.15 });
      }
    });
    this.stageTl = tl;
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
