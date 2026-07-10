import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-logo-wall',
  templateUrl: './logo-wall.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoWall {
  readonly orgs: readonly string[] = [
    '5K & 10K',
    'HALF MARATHON',
    'FULL MARATHON',
    'TRAIL & ULTRA',
    'RELAY',
    'MULTI-DAY STAGE RACE',
  ];

  /** Three identical copies make the loop seamless; only the first is exposed to AT. */
  readonly copies = [0, 1, 2] as const;

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('marqueeTrack');

  constructor() {
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const el = this.track().nativeElement;
          const tween = gsap.to(el, {
            xPercent: -100 / this.copies.length,
            duration: 22,
            ease: 'none',
            repeat: -1,
          });
          const pause = (): void => void tween.pause();
          const resume = (): void => void tween.resume();
          el.addEventListener('pointerenter', pause);
          el.addEventListener('pointerleave', resume);
          return () => {
            el.removeEventListener('pointerenter', pause);
            el.removeEventListener('pointerleave', resume);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
