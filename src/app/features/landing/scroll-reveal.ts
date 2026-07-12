import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type RevealVariant = '' | 'up' | 'left' | 'right' | 'zoom' | 'bar';

const VARIANTS: Record<
  Exclude<RevealVariant, ''>,
  { hidden: gsap.TweenVars; shown: gsap.TweenVars }
> = {
  up: { hidden: { y: 40, opacity: 0 }, shown: { y: 0, opacity: 1 } },
  left: { hidden: { x: -48, opacity: 0 }, shown: { x: 0, opacity: 1 } },
  right: { hidden: { x: 48, opacity: 0 }, shown: { x: 0, opacity: 1 } },
  zoom: { hidden: { scale: 0.94, opacity: 0 }, shown: { scale: 1, opacity: 1 } },
  bar: { hidden: { scaleX: 0, transformOrigin: 'left center' }, shown: { scaleX: 1 } },
};

/**
 * One-shot GSAP entrance when the element scrolls into view. With `revealStagger`
 * the element's direct children animate instead, each on its own trigger
 * (ScrollTrigger.batch) so single-column mobile layouts reveal row by row rather
 * than all at once. Inline styles are cleared on completion so Tailwind hover
 * transforms keep working afterwards.
 */
@Directive({
  selector: '[appScrollReveal]',
})
export class ScrollReveal {
  readonly variant = input<RevealVariant>('', { alias: 'appScrollReveal' });
  readonly revealStagger = input(0, { transform: numberAttribute });
  readonly revealDelay = input(0, { transform: numberAttribute });

  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const { hidden, shown } = VARIANTS[this.variant() || 'up'];
          const base: gsap.TweenVars = {
            duration: 0.9,
            ease: 'power3.out',
            delay: this.revealDelay(),
            clearProps: 'opacity,transform',
          };

          if (this.revealStagger() > 0) {
            const children = Array.from(el.children);
            gsap.set(children, hidden);
            ScrollTrigger.batch(children, {
              start: 'top 88%',
              once: true,
              onEnter: (batch) =>
                gsap.to(batch, { ...shown, ...base, stagger: this.revealStagger() }),
            });
          } else {
            gsap.from(el, {
              ...hidden,
              ...base,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
          }
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
